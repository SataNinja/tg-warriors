from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Telegram
    BOT_TOKEN: str
    MINI_APP_URL: str = ""

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Security
    SECRET_KEY: str

    # Docs Basic Auth (закрывает /docs от посторонних)
    DOCS_USERNAME: str = "admin"
    DOCS_PASSWORD: str = ""

    # Internal backend URL (используется ботом)
    BACKEND_URL: str = "http://backend:8000"

    # ── Игровые параметры ────────────────────────────────────────────────────
    UNIT_BUY_COST: int = 50
    UNIT_UPGRADE_COST_BASE: int = 30      # cost = base * level
    RAID_COOLDOWN_SECONDS: int = 3600     # 1 час между рейдами
    SHIELD_COST: int = 20
    SHIELD_DURATION_HOURS: int = 8
    DAILY_REWARD_COINS: int = 50
    REFERRAL_REWARD_COINS: int = 1000
    STARTING_COINS: int = 100
    RAID_STEAL_PERCENT: float = 0.15      # 15% монет жертвы при успешном рейде
    ADMIN_USER_ID: int = 6320200740       # @SataNinjaKOT — скрыт из топа
    NICKNAME_CHANGE_COST: int = 100       # монеты за смену ника

    model_config = {"env_file": ".env"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
