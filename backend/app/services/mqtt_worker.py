import asyncio
import json
import logging
from typing import Optional
import aiomqtt

from app.config import get_settings
from app.services.telemetry import process_telemetry, process_status, process_command_ack

logger = logging.getLogger("mqtt_worker")
settings = get_settings()

_worker_task: Optional[asyncio.Task] = None
_shutdown_event = asyncio.Event()
_command_client: Optional[aiomqtt.Client] = None


async def handle_message(message: aiomqtt.Message) -> None:
    try:
        topic_str = str(message.topic)
        tokens = topic_str.split("/")
        if len(tokens) < 3 or tokens[0] != "lansubx":
            return

        device_key = tokens[1]
        subtopic = "/".join(tokens[2:])

        payload_bytes = message.payload
        if isinstance(payload_bytes, (bytes, bytearray)):
            payload_str = payload_bytes.decode("utf-8", errors="replace")
        else:
            payload_str = str(payload_bytes)

        try:
            payload = json.loads(payload_str)
        except json.JSONDecodeError as err:
            logger.warning("Dropped invalid JSON on topic %s: %s", topic_str, err)
            return

        if subtopic == "telemetry":
            values = payload.get("values") if isinstance(payload, dict) else None
            ts = payload.get("ts") if isinstance(payload, dict) else None
            if values:
                await process_telemetry(device_key, values, ts)

        elif subtopic == "status":
            await process_status(device_key, payload)

        elif subtopic == "command/ack":
            await process_command_ack(device_key, payload)

    except Exception as e:
        logger.error("Unhandled error processing MQTT message: %s", e, exc_info=True)


async def run_mqtt_consumer():
    """
    Main MQTT consumer loop with exponential backoff on broker drop (FR-I5).
    """
    retry_delay = 1.0
    max_delay = 10.0

    while not _shutdown_event.is_set():
        try:
            logger.info(
                "Connecting to MQTT broker at %s:%s as user '%s'...",
                settings.MQTT_BROKER_HOST,
                settings.MQTT_BROKER_PORT,
                settings.MQTT_BACKEND_USERNAME,
            )
            async with aiomqtt.Client(
                hostname=settings.MQTT_BROKER_HOST,
                port=settings.MQTT_BROKER_PORT,
                username=settings.MQTT_BACKEND_USERNAME,
                password=settings.MQTT_BACKEND_PASSWORD,
                identifier="lansubx_backend_worker",
            ) as client:
                logger.info("Connected to MQTT broker successfully.")
                retry_delay = 1.0  # Reset backoff on successful connection

                # Subscribe to telemetry, status, and command acks
                await client.subscribe("lansubx/+/telemetry")
                await client.subscribe("lansubx/+/status")
                await client.subscribe("lansubx/+/command/ack")
                logger.info("Subscribed to lansubx/ topics.")

                async for message in client.messages:
                    if _shutdown_event.is_set():
                        break
                    await handle_message(message)

        except aiomqtt.MqttError as err:
            if _shutdown_event.is_set():
                break
            logger.warning("MQTT broker connection error: %s. Reconnecting in %.1fs...", err, retry_delay)
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, max_delay)
        except asyncio.CancelledError:
            logger.info("MQTT worker task cancelled.")
            break
        except Exception as e:
            if _shutdown_event.is_set():
                break
            logger.error("Unexpected error in MQTT worker: %s. Reconnecting in %.1fs...", e, retry_delay, exc_info=True)
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, max_delay)


async def publish_mqtt_command(device_key: str, payload: dict) -> bool:
    """
    Publishes a command frame to `lansubx/{device_key}/command`.
    """
    try:
        async with aiomqtt.Client(
            hostname=settings.MQTT_BROKER_HOST,
            port=settings.MQTT_BROKER_PORT,
            username=settings.MQTT_BACKEND_USERNAME,
            password=settings.MQTT_BACKEND_PASSWORD,
            identifier=f"lansubx_backend_cmd_{device_key}",
        ) as client:
            topic = f"lansubx/{device_key}/command"
            await client.publish(topic, json.dumps(payload), qos=1)
            logger.info("Published command to %s: %s", topic, payload)
            return True
    except Exception as e:
        logger.error("Failed to publish command to MQTT for %s: %s", device_key, e)
        return False


def start_mqtt_worker() -> asyncio.Task:
    global _worker_task
    _shutdown_event.clear()
    _worker_task = asyncio.create_task(run_mqtt_consumer(), name="lansubx_mqtt_worker")
    return _worker_task


async def stop_mqtt_worker():
    global _worker_task
    _shutdown_event.set()
    if _worker_task:
        _worker_task.cancel()
        try:
            await asyncio.wait_for(_worker_task, timeout=3.0)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            pass
        _worker_task = None
    logger.info("MQTT worker stopped.")
