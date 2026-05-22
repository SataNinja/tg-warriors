from pydantic import BaseModel


class RaidRequest(BaseModel):
    target_user_id: int


class RaidResult(BaseModel):
    success: bool
    coins_stolen: int
    attacker_power: int
    defender_power: int
    message: str


class ShieldRequest(BaseModel):
    pass  # просто активируем щит


class ShieldResult(BaseModel):
    shield_until: str
    cost: int


class DailyRewardResult(BaseModel):
    coins_earned: int
    new_balance: int


class ReferralClaimResult(BaseModel):
    claimed_count: int
    coins_earned: int
    new_balance: int


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str | None
    first_name: str
    coins: int
    total_power: int


class NotificationOut(BaseModel):
    id: str
    user_id: int
    message: str
    is_sent: bool
