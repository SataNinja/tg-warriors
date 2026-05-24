from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from schemas.unit import UnitOut


class UserOut(BaseModel):
    id: int
    username: Optional[str]
    first_name: str
    last_name: Optional[str]
    nickname: Optional[str]
    coins: int
    iron: int = 0
    crystals: int = 0
    energy: int
    castle_level: int = 1
    win_streak: int = 0
    daily_streak: int = 0
    shield_until: Optional[datetime]
    last_daily_reward: Optional[datetime]
    units: list[UnitOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}

    @property
    def display_name(self) -> str:
        return self.nickname or self.first_name


class GameStateOut(BaseModel):
    user: UserOut
    can_claim_daily: bool
    daily_reward_coins: int      # следующая награда (динамическая по стрику)
    daily_next_at: Optional[datetime]
    daily_streak: int = 0        # текущий стрик
    raid_cooldown_remaining: int
    shield_active: bool
    energy: int
    max_energy: int
    energy_regen_seconds: int
    energy_regen_minutes: int
    passive_income_ready: bool = False
    passive_income_amount: int = 50
    passive_income_next_in: int = 0


class NicknameRequest(BaseModel):
    nickname: str

    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Никнейм минимум 3 символа")
        if len(v) > 20:
            raise ValueError("Никнейм максимум 20 символов")
        allowed = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_- абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ")
        if not all(c in allowed for c in v):
            raise ValueError("Только буквы, цифры, пробел, _ и -")
        return v


class NicknameResponse(BaseModel):
    nickname: str
