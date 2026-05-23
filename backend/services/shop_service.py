import random
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User
from models.weapon import Weapon
from models.pet import Pet
from models.transaction import Transaction
from schemas.shop import (
    CastleInfo, CastleUpgradeResult,
    WeaponInfo, WeaponBuyResult, WeaponUpgradeResult,
    BuyEggResult
)

# ── Данные замка ──────────────────────────────────────────────────────────────
CASTLE_DATA = {
    1:  {"name": "Деревня",          "max_units": 3,  "income_bonus": 0},
    2:  {"name": "Крепость",         "max_units": 4,  "income_bonus": 0,   "cost": 200},
    3:  {"name": "Замок",            "max_units": 5,  "income_bonus": 5,   "cost": 360},
    4:  {"name": "Цитадель",         "max_units": 6,  "income_bonus": 5,   "cost": 648},
    5:  {"name": "Бастион",          "max_units": 7,  "income_bonus": 10,  "cost": 1166},
    6:  {"name": "Крепость Дракона", "max_units": 8,  "income_bonus": 10,  "cost": 2099},
    7:  {"name": "Твердыня",         "max_units": 9,  "income_bonus": 15,  "cost": 3778},
    8:  {"name": "Легендарный Замок","max_units": 10, "income_bonus": 15,  "cost": 6800},
    9:  {"name": "Небесная Цитадель","max_units": 12, "income_bonus": 20,  "cost": 12240},
    10: {"name": "Вечная Твердыня",  "max_units": 15, "income_bonus": 25,  "cost": 22032},
}
MAX_CASTLE_LEVEL = 10

# ── Данные оружия ──────────────────────────────────────────────────────────────
WEAPON_BUY_COST = 100           # монеты за покупку базового оружия
WEAPON_UPGRADE_IRON_BASE = 5    # железа за прокачку (× уровень)
MAX_WEAPON_LEVEL = 10

WEAPON_NAMES = {
    "common":    "Железный меч",
    "rare":      "Стальной клинок",
    "epic":      "Клинок Судьбы",
    "legendary": "Меч Дракона",
}

# ── Данные питомцев ────────────────────────────────────────────────────────────
PET_TYPES = {
    "wolf":    {"name": "Волк",    "emoji": "🐺", "power_bonus": 5,  "gold_bonus": 0,  "rarity": "common"},
    "raven":   {"name": "Ворон",   "emoji": "🦅", "power_bonus": 3,  "gold_bonus": 8,  "rarity": "common"},
    "bear":    {"name": "Медведь", "emoji": "🐻", "power_bonus": 8,  "gold_bonus": 0,  "rarity": "rare"},
    "phoenix": {"name": "Феникс",  "emoji": "🔥", "power_bonus": 12, "gold_bonus": 5,  "rarity": "epic"},
}

EGG_DATA = {
    "common": {
        "cost": 200,
        "pool": [("wolf", 50), ("raven", 50)],
        "name": "Обычное яйцо 🥚",
    },
    "rare": {
        "cost": 500,
        "pool": [("wolf", 30), ("raven", 30), ("bear", 40)],
        "name": "Редкое яйцо 🔮",
    },
    "elite": {
        "cost": 1200,
        "pool": [("bear", 40), ("phoenix", 60)],
        "name": "Элитное яйцо 💎",
    },
}

MAX_PETS = {1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _castle_info(user: User) -> CastleInfo:
    lvl = user.castle_level
    data = CASTLE_DATA[lvl]
    next_lvl = lvl + 1 if lvl < MAX_CASTLE_LEVEL else None
    next_data = CASTLE_DATA.get(next_lvl) if next_lvl else None
    return CastleInfo(
        level=lvl,
        name=data["name"],
        max_units=data["max_units"],
        income_bonus=data["income_bonus"],
        next_level_cost=next_data.get("cost") if next_data else None,
        next_level_name=next_data["name"] if next_data else None,
        next_level_bonus=(f"+{next_data['income_bonus']}% монет, {next_data['max_units']} юнитов"
                          if next_data else None),
    )


# ── Замок ─────────────────────────────────────────────────────────────────────
async def get_castle_info(user: User) -> CastleInfo:
    return _castle_info(user)


async def upgrade_castle(db: AsyncSession, user: User) -> CastleUpgradeResult:
    if user.castle_level >= MAX_CASTLE_LEVEL:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Замок уже на максимальном уровне")
    next_lvl = user.castle_level + 1
    cost = CASTLE_DATA[next_lvl]["cost"]
    if user.coins < cost:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Нужно {cost} монет. У тебя {user.coins}.")
    user.coins -= cost
    user.castle_level = next_lvl
    db.add(Transaction(user_id=user.id, amount=-cost, type="castle",
                       description=f"Улучшение замка до уровня {next_lvl}"))
    await db.commit()
    return CastleUpgradeResult(
        new_level=next_lvl,
        new_name=CASTLE_DATA[next_lvl]["name"],
        coins_spent=cost,
        new_balance=user.coins,
        message=f"🏰 Замок улучшен до «{CASTLE_DATA[next_lvl]['name']}»!"
    )


# ── Оружие ────────────────────────────────────────────────────────────────────
def get_weapon_info(user: User) -> WeaponInfo:
    w = user.weapon
    if not w:
        return WeaponInfo(
            id=None, name=None, rarity=None, level=0, attack_bonus=0,
            upgrade_cost=None, buy_cost=WEAPON_BUY_COST
        )
    upgrade_iron = WEAPON_UPGRADE_IRON_BASE * w.level if w.level < MAX_WEAPON_LEVEL else None
    return WeaponInfo(
        id=w.id, name=w.name, rarity=w.rarity, level=w.level,
        attack_bonus=w.attack_bonus,
        upgrade_cost=upgrade_iron,
        buy_cost=None
    )


async def buy_weapon(db: AsyncSession, user: User) -> WeaponBuyResult:
    if user.weapon:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Оружие уже куплено. Улучшай существующее!")
    if user.coins < WEAPON_BUY_COST:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Нужно {WEAPON_BUY_COST} монет")
    user.coins -= WEAPON_BUY_COST
    weapon = Weapon(owner_id=user.id, name="Железный меч", rarity="common", level=1, attack_bonus=5)
    db.add(weapon)
    db.add(Transaction(user_id=user.id, amount=-WEAPON_BUY_COST, type="weapon",
                       description="Покупка оружия"))
    await db.commit()
    await db.refresh(weapon)
    return WeaponBuyResult(
        name=weapon.name, rarity=weapon.rarity, attack_bonus=weapon.attack_bonus,
        coins_spent=WEAPON_BUY_COST, new_balance=user.coins,
        message="⚔️ Железный меч куплен! +5 к силе."
    )


async def upgrade_weapon(db: AsyncSession, user: User) -> WeaponUpgradeResult:
    w = user.weapon
    if not w:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Сначала купи оружие")
    if w.level >= MAX_WEAPON_LEVEL:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Оружие на максимальном уровне")
    iron_cost = WEAPON_UPGRADE_IRON_BASE * w.level
    if user.iron < iron_cost:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Нужно {iron_cost} железа. У тебя {user.iron}.")
    user.iron -= iron_cost
    w.level += 1
    w.attack_bonus += 3

    # Повышаем редкость на определённых уровнях
    if w.level == 4 and w.rarity == "common":
        w.rarity = "rare"; w.name = WEAPON_NAMES["rare"]
    elif w.level == 7 and w.rarity == "rare":
        w.rarity = "epic"; w.name = WEAPON_NAMES["epic"]
    elif w.level == 10 and w.rarity == "epic":
        w.rarity = "legendary"; w.name = WEAPON_NAMES["legendary"]

    await db.commit()
    return WeaponUpgradeResult(
        new_level=w.level, new_attack_bonus=w.attack_bonus,
        iron_spent=iron_cost, new_iron=user.iron,
        message=f"⚔️ Оружие прокачано до уровня {w.level}! +3 к силе."
    )


# ── Питомцы ───────────────────────────────────────────────────────────────────
def _roll_pet_type(pool: list[tuple[str, int]]) -> str:
    """Случайный питомец по весам."""
    total = sum(w for _, w in pool)
    r = random.randint(1, total)
    for pet_type, weight in pool:
        r -= weight
        if r <= 0:
            return pet_type
    return pool[-1][0]


async def buy_egg(db: AsyncSession, user: User, egg_type: str) -> BuyEggResult:
    egg = EGG_DATA.get(egg_type)
    if not egg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Такого яйца нет")

    max_pets = MAX_PETS.get(user.castle_level, 1)
    if len(user.pets) >= max_pets:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Достигнут лимит питомцев ({max_pets}). Улучши замок!"
        )
    if user.coins < egg["cost"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Нужно {egg['cost']} монет")

    user.coins -= egg["cost"]
    pet_type = _roll_pet_type(egg["pool"])
    pt = PET_TYPES[pet_type]
    pet = Pet(
        owner_id=user.id,
        name=f"{pt['emoji']} {pt['name']}",
        pet_type=pet_type,
        rarity=pt["rarity"],
        level=1,
        power_bonus=pt["power_bonus"],
        gold_bonus=pt["gold_bonus"],
        energy=20,
    )
    db.add(pet)
    db.add(Transaction(user_id=user.id, amount=-egg["cost"], type="egg",
                       description=f"Покупка {egg['name']}"))
    await db.commit()
    await db.refresh(pet)
    return BuyEggResult(
        pet_name=pet.name, pet_type=pet_type, rarity=pt["rarity"],
        power_bonus=pt["power_bonus"], gold_bonus=pt["gold_bonus"],
        coins_spent=egg["cost"], new_balance=user.coins,
        message=f"🎉 Получен {pet.name}! +{pt['power_bonus']} к силе."
    )


def get_castle_max_units(castle_level: int) -> int:
    return CASTLE_DATA.get(castle_level, CASTLE_DATA[1])["max_units"]


def get_castle_income_bonus(castle_level: int) -> int:
    return CASTLE_DATA.get(castle_level, CASTLE_DATA[1])["income_bonus"]
