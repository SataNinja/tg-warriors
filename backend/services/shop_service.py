import random
from datetime import datetime, timezone, timedelta

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User
from models.weapon import Weapon
from models.pet import Pet
from models.egg import Egg
from models.transaction import Transaction
from schemas.shop import (
    CastleInfo, CastleUpgradeResult,
    WeaponInfo, WeaponBuyResult, WeaponUpgradeResult,
    BuyEggResult, FoodItem, FeedPetResult,
)

# ── Данные замка ──────────────────────────────────────────────────────────────
CASTLE_DATA = {
    1:  {"name": "Деревня",                 "max_units": 3,  "income_bonus": 0},
    2:  {"name": "Крепость",                "max_units": 4,  "income_bonus": 0,   "cost": 200},
    3:  {"name": "Замок",                   "max_units": 5,  "income_bonus": 5,   "cost": 360},
    4:  {"name": "Цитадель",                "max_units": 6,  "income_bonus": 5,   "cost": 648},
    5:  {"name": "Бастион",                 "max_units": 7,  "income_bonus": 10,  "cost": 1166},
    6:  {"name": "Крепость Дракона",        "max_units": 8,  "income_bonus": 10,  "cost": 2099},
    7:  {"name": "Твердыня",                "max_units": 9,  "income_bonus": 15,  "cost": 3778},
    8:  {"name": "Легендарный Замок",       "max_units": 10, "income_bonus": 15,  "cost": 6800},
    9:  {"name": "Небесная Цитадель",       "max_units": 12, "income_bonus": 20,  "cost": 12240},
    10: {"name": "Вечная Твердыня",         "max_units": 15, "income_bonus": 25,  "cost": 22032},
    11: {"name": "Алмазная Крепость",       "max_units": 16, "income_bonus": 30,  "cost": 40000},
    12: {"name": "Эбонитовый Замок",        "max_units": 17, "income_bonus": 30,  "cost": 72000},
    13: {"name": "Замок Грома",             "max_units": 18, "income_bonus": 35,  "cost": 130000},
    14: {"name": "Обитель Гигантов",        "max_units": 19, "income_bonus": 35,  "cost": 234000},
    15: {"name": "Замок Богов",             "max_units": 20, "income_bonus": 40,  "cost": 421000},
    16: {"name": "Звёздная Твердыня",       "max_units": 21, "income_bonus": 40,  "cost": 758000},
    17: {"name": "Крепость Вечности",       "max_units": 22, "income_bonus": 45,  "cost": 1364000},
    18: {"name": "Вселенский Бастион",      "max_units": 23, "income_bonus": 45,  "cost": 2455000},
    19: {"name": "Замок Создателя",         "max_units": 24, "income_bonus": 50,  "cost": 4419000},
    20: {"name": "Ультимативная Твердыня",  "max_units": 25, "income_bonus": 50,  "cost": 7954000},
}
MAX_CASTLE_LEVEL = 20

# ── Данные оружия ──────────────────────────────────────────────────────────────
WEAPON_BUY_COST = 100
WEAPON_UPGRADE_IRON_BASE = 5
MAX_WEAPON_LEVEL = 10

WEAPON_NAMES = {
    "common":    "Железный меч",
    "rare":      "Стальной клинок",
    "epic":      "Клинок Судьбы",
    "legendary": "Меч Дракона",
}

# ── 30 видов питомцев ─────────────────────────────────────────────────────────
PET_TYPES: dict[str, dict] = {
    # ── Обычные (common egg) ──────────────────────────────────────
    "wolf":        {"name": "Волк",          "emoji": "🐺", "power_bonus": 5,  "gold_bonus": 0,  "rarity": "common"},
    "raven":       {"name": "Ворон",         "emoji": "🪶", "power_bonus": 3,  "gold_bonus": 8,  "rarity": "common"},
    "cat":         {"name": "Кот",           "emoji": "🐱", "power_bonus": 4,  "gold_bonus": 3,  "rarity": "common"},
    "rabbit":      {"name": "Кролик",        "emoji": "🐰", "power_bonus": 2,  "gold_bonus": 6,  "rarity": "common"},
    "fox":         {"name": "Лиса",          "emoji": "🦊", "power_bonus": 6,  "gold_bonus": 2,  "rarity": "common"},
    "owl":         {"name": "Сова",          "emoji": "🦉", "power_bonus": 3,  "gold_bonus": 5,  "rarity": "common"},
    "dog":         {"name": "Пёс",           "emoji": "🐕", "power_bonus": 5,  "gold_bonus": 1,  "rarity": "common"},
    "rat":         {"name": "Крыса",         "emoji": "🐀", "power_bonus": 2,  "gold_bonus": 10, "rarity": "common"},
    "snake":       {"name": "Змея",          "emoji": "🐍", "power_bonus": 4,  "gold_bonus": 0,  "rarity": "common"},
    "turtle":      {"name": "Черепаха",      "emoji": "🐢", "power_bonus": 1,  "gold_bonus": 4,  "rarity": "common"},
    # ── Редкие (rare egg) ─────────────────────────────────────────
    "bear":        {"name": "Медведь",       "emoji": "🐻", "power_bonus": 8,  "gold_bonus": 0,  "rarity": "rare"},
    "lion":        {"name": "Лев",           "emoji": "🦁", "power_bonus": 10, "gold_bonus": 0,  "rarity": "rare"},
    "tiger":       {"name": "Тигр",          "emoji": "🐯", "power_bonus": 11, "gold_bonus": 0,  "rarity": "rare"},
    "eagle":       {"name": "Орёл",          "emoji": "🦅", "power_bonus": 7,  "gold_bonus": 4,  "rarity": "rare"},
    "shark":       {"name": "Акула",         "emoji": "🦈", "power_bonus": 8,  "gold_bonus": 3,  "rarity": "rare"},
    "panther":     {"name": "Пантера",       "emoji": "🐆", "power_bonus": 9,  "gold_bonus": 3,  "rarity": "rare"},
    "rhino":       {"name": "Носорог",       "emoji": "🦏", "power_bonus": 10, "gold_bonus": 0,  "rarity": "rare"},
    "mammoth":     {"name": "Мамонт",        "emoji": "🦣", "power_bonus": 12, "gold_bonus": 0,  "rarity": "rare"},
    "wolf_pack":   {"name": "Стая Волков",   "emoji": "🐺", "power_bonus": 9,  "gold_bonus": 2,  "rarity": "rare"},
    "crocodile":   {"name": "Крокодил",      "emoji": "🐊", "power_bonus": 8,  "gold_bonus": 2,  "rarity": "rare"},
    # ── Элитные (elite egg) ───────────────────────────────────────
    "phoenix":     {"name": "Феникс",        "emoji": "🔥", "power_bonus": 12, "gold_bonus": 5,  "rarity": "epic"},
    "dragon":      {"name": "Дракон",        "emoji": "🐲", "power_bonus": 15, "gold_bonus": 5,  "rarity": "epic"},
    "unicorn":     {"name": "Единорог",      "emoji": "🦄", "power_bonus": 10, "gold_bonus": 10, "rarity": "epic"},
    "griffin":     {"name": "Грифон",        "emoji": "🦅", "power_bonus": 14, "gold_bonus": 4,  "rarity": "epic"},
    "hydra":       {"name": "Гидра",         "emoji": "🐉", "power_bonus": 13, "gold_bonus": 3,  "rarity": "epic"},
    "cerberus":    {"name": "Цербер",        "emoji": "🔴", "power_bonus": 16, "gold_bonus": 0,  "rarity": "legendary"},
    "leviathan":   {"name": "Левиафан",      "emoji": "🌊", "power_bonus": 12, "gold_bonus": 6,  "rarity": "legendary"},
    "kraken":      {"name": "Кракен",        "emoji": "🐙", "power_bonus": 14, "gold_bonus": 5,  "rarity": "legendary"},
    "thunderbird": {"name": "Громовая Птица","emoji": "⚡", "power_bonus": 15, "gold_bonus": 8,  "rarity": "legendary"},
    "cosmic_wolf": {"name": "Космоволк",     "emoji": "🌌", "power_bonus": 18, "gold_bonus": 10, "rarity": "legendary"},
}

# ── Яйца ──────────────────────────────────────────────────────────────────────
EGG_DATA = {
    "common": {
        "cost": 200,
        "hatch_hours": 2,
        "pool": ["wolf", "raven", "cat", "rabbit", "fox", "owl", "dog", "rat", "snake", "turtle"],
        "name": "Обычное яйцо 🥚",
        "emoji": "🥚",
    },
    "rare": {
        "cost": 500,
        "hatch_hours": 6,
        "pool": ["bear", "lion", "tiger", "eagle", "shark", "panther", "rhino", "mammoth", "wolf_pack", "crocodile"],
        "name": "Редкое яйцо 🔮",
        "emoji": "🔮",
    },
    "elite": {
        "cost": 1200,
        "hatch_hours": 12,
        "pool": ["phoenix", "dragon", "unicorn", "griffin", "hydra", "cerberus", "leviathan", "kraken", "thunderbird", "cosmic_wolf"],
        "name": "Элитное яйцо 💎",
        "emoji": "💎",
    },
}

MAX_PETS = {
    1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5,
    11: 6, 12: 6, 13: 7, 14: 7, 15: 8, 16: 8, 17: 9, 18: 9, 19: 10, 20: 10,
}

# ── Еда для питомцев ──────────────────────────────────────────────────────────
FOOD_DATA = {
    "basic":   {"name": "Базовая еда",   "emoji": "🍖", "cost": 30,  "hunger_restore": 30,  "description": "+30 к голоду"},
    "premium": {"name": "Премиум пайок", "emoji": "🍗", "cost": 75,  "hunger_restore": -1,  "description": "Полное восстановление голода"},
}


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── Замок ─────────────────────────────────────────────────────────────────────
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


# ── Яйца / питомцы ────────────────────────────────────────────────────────────
def _roll_pet_type(pool: list[str]) -> str:
    """Случайный питомец с равным шансом из пула."""
    return random.choice(pool)


async def buy_egg(db: AsyncSession, user: User, egg_type: str) -> BuyEggResult:
    egg_cfg = EGG_DATA.get(egg_type)
    if not egg_cfg:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Такого яйца нет")

    max_pets = MAX_PETS.get(user.castle_level, 1)
    if len(user.pets) >= max_pets:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Достигнут лимит питомцев ({max_pets}). Улучши замок!"
        )
    if user.coins < egg_cfg["cost"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Нужно {egg_cfg['cost']} монет")

    user.coins -= egg_cfg["cost"]
    pet_type = _roll_pet_type(egg_cfg["pool"])
    hatches_at = now_utc() + timedelta(hours=egg_cfg["hatch_hours"])

    egg = Egg(
        owner_id=user.id,
        egg_type=egg_type,
        pet_type=pet_type,
        hatches_at=hatches_at,
        is_hatched=False,
    )
    db.add(egg)
    db.add(Transaction(user_id=user.id, amount=-egg_cfg["cost"], type="egg",
                       description=f"Покупка {egg_cfg['name']}"))
    await db.commit()
    await db.refresh(egg)

    pt = PET_TYPES[pet_type]
    hatch_secs = int((hatches_at - now_utc()).total_seconds())

    return BuyEggResult(
        egg_id=egg.id,
        egg_name=egg_cfg["name"],
        pet_type=pet_type,
        rarity=pt["rarity"],
        hatches_at=hatches_at.isoformat(),
        hatch_seconds=max(0, hatch_secs),
        coins_spent=egg_cfg["cost"],
        new_balance=user.coins,
        message=f"{egg_cfg['emoji']} Яйцо куплено! Вылупится через {egg_cfg['hatch_hours']} ч. Внутри: {pt['emoji']} {pt['name']}!"
    )


def get_food_list() -> list[FoodItem]:
    from schemas.shop import FoodItem as FoodItemSchema
    return [
        FoodItemSchema(
            food_type=k,
            name=v["name"],
            emoji=v["emoji"],
            description=v["description"],
            cost=v["cost"],
            hunger_restore=v["hunger_restore"],
        )
        for k, v in FOOD_DATA.items()
    ]


# ── Утилиты для других сервисов ───────────────────────────────────────────────
def get_castle_max_units(castle_level: int) -> int:
    return CASTLE_DATA.get(castle_level, CASTLE_DATA[1])["max_units"]


def get_castle_income_bonus(castle_level: int) -> int:
    return CASTLE_DATA.get(castle_level, CASTLE_DATA[1])["income_bonus"]
