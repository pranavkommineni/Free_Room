"""Application settings (12-factor: everything comes from environment / .env)."""
from datetime import time
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- required -------------------------------------------------------
    DATABASE_URL: str
    JWT_SECRET: str = Field(min_length=16)
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"

    # --- optional -------------------------------------------------------
    TIMEZONE: str = "Asia/Kolkata"
    CAMPUS_DAY_START: time = time(8, 0)
    CAMPUS_DAY_END: time = time(18, 0)
    WORKING_DAYS: list[int] = [0, 1, 2, 3, 4]  # Monday=0 ... Sunday=6
    BOOKING_MIN_MINUTES: int = 15
    BOOKING_MAX_MINUTES: int = 240
    BOOKING_MAX_ADVANCE_DAYS: int = 14
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 10
    MAX_IMPORT_ROWS: int = 5000
    MAX_IMPORT_BYTES: int = 2_000_000

    # recommendation weights (should sum to 1.0)
    REC_W_AVAILABILITY: float = 0.30
    REC_W_CAPACITY: float = 0.25
    REC_W_FACILITY: float = 0.20
    REC_W_UTILIZATION: float = 0.15
    REC_W_FLOOR: float = 0.10

    @field_validator("DATABASE_URL")
    @classmethod
    def _async_driver(cls, v: str) -> str:
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        if not v.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must be a PostgreSQL asyncpg URL (postgresql+asyncpg://...)")
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
