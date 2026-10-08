#!/bin/sh
# Provision a new MQTT user for direct devices or gateways
# Usage: ./scripts/add_mqtt_user.sh <device_key_or_username> <password>

set -e

if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <username> <password>"
    echo "Example: $0 dev_a1b2c3d4e5f6 secret_token_xyz"
    exit 1
fi

USERNAME="$1"
PASSWORD="$2"

echo "Provisioning MQTT user: ${USERNAME}..."

# Execute mosquitto_passwd inside the running Mosquitto container
docker compose exec mosquitto mosquitto_passwd -b /mosquitto/data/passwd "${USERNAME}" "${PASSWORD}"

# Reload Mosquitto config with SIGHUP without dropping broker connections
docker compose exec mosquitto kill -HUP 1

echo "MQTT user '${USERNAME}' successfully provisioned and reloaded."
