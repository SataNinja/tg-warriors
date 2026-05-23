from typing import Optional
from pydantic import BaseModel


# ── Замок ─────────────────────────────────────────────────────────────────────
class CastleInfo(BaseModel):
    level: int
    name: str
    max_units: int
    income_bonus: int       # % бонус к монетам
    next_level_cost: Optional[int]  # None если макс уровень
    next_level_name: Optional[str]
    next_level_bonus: Optional[str]


class CastleUpgradeResult(BaseModel):
    new_level: int
    new_name: str
    coins_spent: int
    new_balance: int
    message: str


# ── Оружие ────────────────────────────────────────────────────────────────────
class WeaponInfo(BaseModel):
    id: Optional[int]
    name: Optional[str]
    rarity: Optional[str]
    level: int
    attack_bonus: int
    upgrade_cost: Optional[int]   # None если нет оружия ещё (нужна покупка)
    buy_cost: Optional[int]       # None если оружие уже есть

    model_config = {"from_attributes": True}


class WeaponBuyResult(BaseModel):
    name: str
    rarity: str
    attack_bonus: int
    coins_spent: int
    new_balance: int
    message: str


class WeaponUpgradeResult(BaseModel):
    new_level: int
    new_attack_bonus: int
    iron_spent: int
    new_iron: int
    message: str


# ── Питомцы ───────────────────────────────────────────────────────────────────
class PetOut(BaseModel):
    id: int
    name: str
    pet_type: str
    rarity: str
    level: int
    power_bonus: int       # базовый бонус (при 100% энергии)
    effective_power_bonus: int  # реальный бонус (масштабируется по энергии)
    gold_bonus: int
    energy: int
    max_energy: int
    energy_regen_seconds: int
    energy_next_in: int    # секунд до следующего +1 энергии (0 = полная энергия)
    last_battle_at: Optional[str]
    can_battle: bool
    battle_cooldown_seconds: int

    model_config = {"from_attributes": True}


class BuyEggRequest(BaseModel):
    egg_type: str  # common / rare / elite


class BuyEggResult(BaseModel):
    pet_name: str
    pet_type: str
    rarity: str
    power_bonus: int
    gold_bonus: int
    coins_spent: int
    new_balance: int
    message: str


class PetBattleRequest(BaseModel):
    pet_id: int


class PetBattleResult(BaseModel):
    success: bool
    pet_name: str
    pet_power: int
    bot_power: int
    energy_gained: int          # энергия игрока (если победа)
    pet_energy_spent: int       # сколько потратил питомец
    pet_energy_left: int
    player_energy_left: int
    message: str
