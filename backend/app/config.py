from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Lansub X"
    ENVIRONMENT: str = "development"

    # JWT Authentication
    SECRET_KEY: str = "lansubx_super_secret_jwt_key_development_change_in_production_987654321"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://lansubx:lansubx_password_secure@postgres:5432/lansubx"

    # Redis Pub/Sub
    REDIS_URL: str = "redis://redis:6379/0"

    # Mosquitto MQTT
    MQTT_BROKER_HOST: str = "mosquitto"
    MQTT_BROKER_PORT: int = 1883
    MQTT_BACKEND_USERNAME: str = "backend"
    MQTT_BACKEND_PASSWORD: str = "backend_secure_pass_123"
    MQTT_GATEWAY_USERNAME: str = "gateway"
    MQTT_GATEWAY_PASSWORD: str = "gateway_secure_pass_123"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        if not self.CORS_ORIGINS:
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
