from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from schemas.unit import UnitOut


class UserOut(BaseModel):
    id: int
    username: Optional[str]
    first_name: str
    last_name: Optional[str]
    coins: int
    shield_until: Optional[datetime]
    last_daily_reward: Optional[datetime]
    units: list[UnitOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class GameStateOut(BaseModel):
    user: UserOut
    can_claim_daily: bool
    daily_reward_coins: int
    raid_cooldown_remaining: int  # секунды до следующего возможного рейда
    shield_active: bool
