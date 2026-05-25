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
    power_bonus: int            # базовый бонус (при 100% голода и энергии)
    effective_power_bonus: int  # реальный бонус (масштабируется по энергии и голоду)
    gold_bonus: int
    energy: int
    max_energy: int
    energy_regen_seconds: int
    energy_next_in: int         # секунд до следующего +1 энергии (0 = полная)
    last_battle_at: Optional[str]
    can_battle: bool
    battle_cooldown_seconds: int
    # Голод
    hunger: int                 # 0-100
    hunger_status: str          # "Сытый" / "Голодный" / "Умирает"
    hunger_deple_seconds: int   # секунд до следующего -1 голода
    # Статистика боёв
    wins: int = 0
    losses: int = 0

    model_config = {"from_attributes": True}


class BuyEggRequest(BaseModel):
    egg_type: str  # common / rare / elite


class BuyEggResult(BaseModel):
    egg_id: int
    egg_name: str
    pet_type: str           # предопределённый тип (показываем игроку)
    rarity: str
    hatches_at: str         # ISO datetime когда можно вылупить
    hatch_seconds: int      # секунд до вылупления
    coins_spent: int
    new_balance: int
    message: str


class EggOut(BaseModel):
    id: int
    egg_type: str           # common / rare / elite
    pet_type: str
    pet_name: str           # имя питомца который вылупится
    pet_emoji: str
    rarity: str
    hatches_at: str         # ISO datetime
    hatch_seconds_left: int # секунд до вылупления (0 = готово)
    is_ready: bool
    created_at: str


class HatchEggResult(BaseModel):
    pet_name: str
    pet_type: str
    rarity: str
    power_bonus: int
    gold_bonus: int
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
    crystal_earned: int = 0     # 1 если выпал кристалл (10% шанс)


class PetUpgradeResult(BaseModel):
    pet_name: str
    new_level: int
    new_power_bonus: int
    crystals_spent: int
    new_crystals: int
    message: str


class BuyCrystalsRequest(BaseModel):
    amount: int = 1

class BuyCrystalsResult(BaseModel):
    crystals_bought: int
    coins_spent: int
    new_crystals: int
    new_coins: int
    message: str


# ── Еда для питомцев ──────────────────────────────────────────────────────────
class FoodItem(BaseModel):
    food_type: str   # basic / premium
    name: str
    emoji: str
    description: str
    cost: int
    hunger_restore: int   # сколько голода восстанавливает (-1 = полное)


class FeedPetRequest(BaseModel):
    pet_id: int
    food_type: str   # basic / premium


class FeedPetResult(BaseModel):
    pet_name: str
    food_name: str
    hunger_before: int
    hunger_after: int
    coins_spent: int
    new_balance: int
    message: str


class ReleasePetResult(BaseModel):
    pet_name: str
    message: str
