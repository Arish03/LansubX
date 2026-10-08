# Provision a new MQTT user for direct devices or gateways on Windows
# Usage: .\scripts\add_mqtt_user.ps1 <username> <password>

param (
    [Parameter(Mandatory=$true)][string]$Username,
    [Parameter(Mandatory=$true)][string]$Password
)

Write-Host "Provisioning MQTT user: $Username..." -ForegroundColor Cyan

docker compose exec mosquitto mosquitto_passwd -b /mosquitto/data/passwd $Username $Password
if ($LASTEXITCODE -eq 0) {
    docker compose exec mosquitto kill -HUP 1
    Write-Host "MQTT user '$Username' successfully provisioned and reloaded." -ForegroundColor Green
} else {
    Write-Host "Failed to provision MQTT user." -ForegroundColor Red
}
