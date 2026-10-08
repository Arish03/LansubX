import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import get_db, engine, Base
from app.routers import (
    auth,
    users,
    templates,
    gateways,
    devices,
    telemetry,
    rules,
    alarms,
    commands,
    dashboard,
    ws,
)
from app.routers.commands import sweep_stale_commands
from app.services.mqtt_worker import start_mqtt_worker, stop_mqtt_worker
from app.services.redis_bus import close_redis

logger = logging.getLogger("lansubx")
logging.basicConfig(level=logging.INFO)

settings = get_settings()

_sweep_task: asyncio.Task = None


async def run_command_timeout_sweeper():
    """Periodically sweeps unanswered commands that exceed timeout (FR-C4)."""
    while True:
        try:
            await asyncio.sleep(10)
            await sweep_stale_commands()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Error in command timeout sweeper: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _sweep_task
    logger.info("Starting Lansub X Backend Application...")

    # Ensure database schema is initialized
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized.")

    # Start the embedded asynchronous MQTT worker (ADR-2)
    start_mqtt_worker()
    logger.info("Embedded MQTT ingestion worker started.")

    # Start the periodic command timeout sweeper
    _sweep_task = asyncio.create_task(run_command_timeout_sweeper(), name="command_sweeper")

    yield

    logger.info("Shutting down Lansub X Backend Application...")
    if _sweep_task:
        _sweep_task.cancel()
        try:
            await _sweep_task
        except asyncio.CancelledError:
            pass

    await stop_mqtt_worker()
    await close_redis()
    await engine.dispose()
    logger.info("All background tasks and connections closed.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    description="Lansub X Industrial IoT Telemetry, Alarms & Control Platform",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(templates.router)
app.include_router(gateways.router)
app.include_router(devices.router)
app.include_router(telemetry.router)
app.include_router(rules.router)
app.include_router(alarms.router)
app.include_router(commands.router)
app.include_router(dashboard.router)
app.include_router(ws.router)


@app.get("/health", tags=["System"])
async def health_check(db: AsyncSession = Depends(get_db)):
    db_status = "ok"
    try:
        await db.execute(text("SELECT 1"))
    except Exception as e:
        logger.error("Database health check failed: %s", e)
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
    }
