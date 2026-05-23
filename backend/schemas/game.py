from datetime import datetime
from pydantic import BaseModel


class RaidRequest(BaseModel):
    target_user_id: int


class RaidResult(BaseModel):
    success: bool
    coins_stolen: int
    attacker_power: int
    defender_power: int
    message: str
    energy_left: int
    opponent_name: str = ""   # имя противника (заполняется в PvP / random)


class PveRaidResult(BaseModel):
    success: bool
    coins_earned: int
    coins_lost: int
    attacker_power: int
    bot_power: int
    message: str
    energy_left: int


class ShieldResult(BaseModel):
    shield_until: str
    cost: int


class DailyRewardResult(BaseModel):
    coins_earned: int
    new_balance: int
    streak: int = 1
    crystals_bonus: int = 0


class ReferralClaimResult(BaseModel):
    claimed_count: int
    coins_earned: int
    new_balance: int


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str | None
    first_name: str
    nickname: str | None
    coins: int
    total_power: int
    win_streak: int = 0


class BattleEntry(BaseModel):
    id: str
    is_attack: bool           # True = я атаковал, False = меня атаковали
    opponent_id: int
    opponent_name: str
    success: bool             # True = атакующий победил
    coins_delta: int          # сколько монет я получил (+ или -)
    my_power: int
    opponent_power: int
    can_revenge: bool         # кнопка мести: я проиграл как защитник и ещё не мстил
    is_revenged: bool         # True — месть уже была совершена
    created_at: datetime


class NotificationOut(BaseModel):
    id: str
    user_id: int
    message: str
    is_sent: bool
