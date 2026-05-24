import random
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from core.config import settings
from models.user import User
from models.unit import Unit
from models.raid import Raid
from models.referral import Referral
from models.transaction import Transaction
from schemas.game import RaidResult, PveRaidResult, ShieldResult, DailyRewardResult, ReferralClaimResult, BattleEntry
from services.notification_service import create_notification

MAX_ENERGY = 50
ENERGY_PER_RAID = 5
ENERGY_REGEN_SECONDS = 360  # +1 энергия каждые 6 минут


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── Энергия ───────────────────────────────────────────────────────────────────
def get_current_energy(user: User) -> int:
    if user.energy_updated_at is None:
        return user.energy
    elapsed = (now_utc() - user.energy_updated_at).total_seconds()
    regenerated = int(elapsed // ENERGY_REGEN_SECONDS)
    return min(MAX_ENERGY, user.energy + regenerated)


def energy_regen_eta(user: User) -> int:
    if user.energy_updated_at is None:
        return 0
    elapsed = (now_utc() - user.energy_updated_at).total_seconds()
    return max(0, int(ENERGY_REGEN_SECONDS - (elapsed % ENERGY_REGEN_SECONDS)))


async def _spend_energy(db: AsyncSession, user: User, amount: int = ENERGY_PER_RAID):
    current = get_current_energy(user)
    if current < amount:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Недостаточно энергии ({current}/{MAX_ENERGY}). +1 каждые 6 минут."
        )
    user.energy = current - amount
    user.energy_updated_at = now_utc()


# ── Вспомогательные ───────────────────────────────────────────────────────────
_PET_MAX_ENERGY = 20
_PET_MAX_HUNGER = 100
_PET_ENERGY_REGEN_SECONDS = 600

# ── Matchup-матрица (атакующий тип → защитник тип → множитель силы) ───────────
_MATCHUP: dict[str, dict[str, float]] = {
    "infantry": {"cavalry": 1.15, "ranged": 0.90, "magic": 1.00, "divine": 0.95, "siege": 1.00, "special": 1.00, "infantry": 1.00},
    "ranged":   {"infantry": 1.15,"cavalry": 0.85, "magic": 1.00, "divine": 1.00, "siege": 0.90, "special": 1.00, "ranged": 1.00},
    "cavalry":  {"ranged": 1.15,  "infantry": 0.90,"magic": 0.80, "divine": 0.90, "siege": 1.00, "special": 1.00, "cavalry": 1.00},
    "magic":    {"cavalry": 1.20, "infantry": 1.00,"ranged": 1.00,"divine": 0.85, "siege": 0.90, "special": 1.00, "magic": 1.00},
    "siege":    {"infantry": 1.10,"ranged": 1.10,  "cavalry": 1.10,"magic": 0.80, "divine": 0.90,"special": 1.00, "siege": 1.00},
    "divine":   {"magic": 1.20,   "siege": 1.10,   "infantry": 1.05,"ranged": 1.00,"cavalry": 1.10,"special": 1.00,"divine": 1.00},
    "special":  {"infantry": 1.05,"ranged": 1.05,  "cavalry": 1.05,"magic": 1.05, "divine": 0.95,"siege": 1.00,  "special": 1.00},
}


def _get_pet_current_energy(pet) -> int:
    """Рассчитывает текущую энергию питомца (без импорта pet_service)."""
    if pet.energy_updated_at is None:
        return pet.energy
    elapsed = (now_utc() - pet.energy_updated_at).total_seconds()
    regenerated = int(elapsed // _PET_ENERGY_REGEN_SECONDS)
    return min(_PET_MAX_ENERGY, pet.energy + regenerated)


def _get_pet_current_hunger(pet) -> int:
    """Рассчитывает текущий голод питомца (без импорта pet_service)."""
    HUNGER_DEPLE_SECONDS = 1200  # -1% каждые 20 мин = -3%/час
    if pet.hunger_updated_at is None:
        return pet.hunger
    elapsed = (now_utc() - pet.hunger_updated_at).total_seconds()
    depleted = int(elapsed // HUNGER_DEPLE_SECONDS)
    return max(0, pet.hunger - depleted)


def _avg_pet_hunger(pets) -> float:
    """Средний голод питомцев (0-100). Если нет питомцев — 100 (нет штрафа)."""
    if not pets:
        return 100.0
    return sum(_get_pet_current_hunger(p) for p in pets) / len(pets)


def _dominant_category(units: list[Unit]) -> str:
    """Доминирующая категория юнитов в армии (по количеству)."""
    from services.shop_service import UNIT_TYPES
    counts: dict[str, int] = {}
    for u in units:
        cat = UNIT_TYPES.get(u.unit_type, {}).get("category", "infantry")
        counts[cat] = counts.get(cat, 0) + 1
    return max(counts, key=lambda c: counts[c]) if counts else "infantry"


def _matchup_multiplier(attacker_units: list[Unit], defender_units: list[Unit]) -> float:
    """Множитель силы атакующего на основе matchup типов армий."""
    if not attacker_units or not defender_units:
        return 1.0
    atk_cat = _dominant_category(attacker_units)
    def_cat = _dominant_category(defender_units)
    return _MATCHUP.get(atk_cat, {}).get(def_cat, 1.0)


def _total_power(units: list[Unit], weapon=None, pets=None) -> int:
    base = sum(u.power for u in units)
    weapon_bonus = weapon.attack_bonus if weapon else 0
    # Бонус питомца масштабируется по текущей энергии (50% энергия = 50% бонус)
    if pets:
        pet_bonus = sum(
            int(p.power_bonus * _get_pet_current_energy(p) / _PET_MAX_ENERGY)
            for p in pets
        )
    else:
        pet_bonus = 0
    return base + weapon_bonus + pet_bonus


def _apply_battle_modifiers(
    attacker: User, defender: User,
    atk_power: int, def_power: int,
    is_pve: bool = False
) -> tuple[int, int]:
    """
    Применяет дополнительные модификаторы к силам сторон:
    1. Бонус уровня замка (+2% за каждый уровень выше, макс +20%)
    2. Штраф голода питомцев (avg hunger < 30% → -15%)
    3. Matchup типов юнитов (только PvP)
    Возвращает (atk_power_modified, def_power_modified).
    """
    # 1. Бонус замка атакующего над защитником
    if not is_pve:
        castle_diff = attacker.castle_level - defender.castle_level
        castle_bonus = max(0, min(10, castle_diff)) * 0.02  # +2% за уровень, max +20%
        atk_power = int(atk_power * (1.0 + castle_bonus))

        # Аналогично для защитника (если его замок выше)
        def_castle_bonus = max(0, min(10, -castle_diff)) * 0.02
        def_power = int(def_power * (1.0 + def_castle_bonus))

    # 2. Штраф голода питомцев
    if _avg_pet_hunger(attacker.pets) < 30:
        atk_power = int(atk_power * 0.85)
    if not is_pve and _avg_pet_hunger(defender.pets) < 30:
        def_power = int(def_power * 0.85)

    # 3. Matchup типов юнитов (только PvP)
    if not is_pve:
        mult = _matchup_multiplier(attacker.units, defender.units)
        atk_power = int(atk_power * mult)

    return atk_power, def_power


def _display_name(user: User) -> str:
    return user.nickname or user.first_name


# ── Юниты ─────────────────────────────────────────────────────────────────────
async def buy_unit(db: AsyncSession, user: User, unit_type: str = "warrior") -> Unit:
    from services.shop_service import get_castle_max_units, UNIT_TYPES
    max_units = get_castle_max_units(user.castle_level)
    if len(user.units) >= max_units:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Лимит юнитов {max_units}. Улучши замок!")

    # Проверяем тип юнита
    utype = UNIT_TYPES.get(unit_type)
    if not utype:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Неизвестный тип юнита")
    if utype["castle_req"] > user.castle_level:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Для {utype['name']} нужен замок уровня {utype['castle_req']}")

    # Цена растёт с каждым купленным юнитом: base × 1.12^count
    base_cost = settings.UNIT_BUY_COST
    price = int(base_cost * (1.12 ** len(user.units)))
    if user.coins < price:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Нужно {price} монет")

    user.coins -= price
    unit = Unit(
        owner_id=user.id,
        name=utype["name"],
        unit_type=unit_type,
        power=utype["base_power"],
        defense=utype["base_defense"],
    )
    db.add(unit)
    db.add(Transaction(user_id=user.id, amount=-price,
                       type="buy_unit", description=f"Покупка юнита {utype['name']}"))
    await db.commit()
    await db.refresh(unit)
    return unit


async def upgrade_unit(db: AsyncSession, user: User, unit_id) -> Unit:
    result = await db.execute(select(Unit).where(Unit.id == unit_id, Unit.owner_id == user.id))
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Юнит не найден")
    cost = settings.UNIT_UPGRADE_COST_BASE * unit.level
    if user.coins < cost:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Нужно {cost} монет")
    user.coins -= cost
    unit.level += 1
    unit.power += 5
    unit.defense += 3
    db.add(Transaction(user_id=user.id, amount=-cost, type="upgrade",
                       description=f"Прокачка до уровня {unit.level}"))
    await db.commit()
    await db.refresh(unit)
    return unit


# ── PvP рейд ─────────────────────────────────────────────────────────────────
async def do_raid(db: AsyncSession, attacker: User, target_id: int) -> RaidResult:
    if attacker.id == target_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя атаковать себя")

    await _spend_energy(db, attacker)

    # Если атака — месть (attacker ранее проиграл этому игроку), помечаем старый рейд
    avenged_q = await db.execute(
        select(Raid).where(
            Raid.attacker_id == target_id,
            Raid.defender_id == attacker.id,
            Raid.success == True,      # noqa: E712
            Raid.is_revenged == False, # noqa: E712
        ).order_by(Raid.created_at.desc()).limit(1)
    )
    avenged_raid = avenged_q.scalar_one_or_none()
    if avenged_raid:
        avenged_raid.is_revenged = True

    result = await db.execute(select(User).where(User.id == target_id))
    defender: Optional[User] = result.scalar_one_or_none()
    if not defender:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Игрок не найден")

    if defender.shield_until and defender.shield_until > now_utc():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Цель защищена щитом")

    attacker_power = _total_power(attacker.units, attacker.weapon, attacker.pets)
    defender_power = _total_power(defender.units, defender.weapon, defender.pets)

    if attacker_power == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нужен хотя бы один юнит")

    # Применяем модификаторы: замок, голод питомцев, matchup типов юнитов
    attacker_power, defender_power = _apply_battle_modifiers(
        attacker, defender, attacker_power, defender_power, is_pve=False
    )

    # Случайный бросок: ±40% к силе каждой стороны — увеличена случайность
    attacker_roll = attacker_power * random.uniform(0.60, 1.40)
    defender_roll = defender_power * random.uniform(0.60, 1.40)
    success = attacker_roll > defender_roll
    coins_stolen = 0

    if success:
        # Базовая добыча
        base_steal = max(1, min(int(defender.coins * settings.RAID_STEAL_PERCENT), defender.coins))
        steal_amount = max(base_steal, random.randint(40, 70))
        steal_amount = min(steal_amount, defender.coins)

        defender.coins -= steal_amount
        attacker.coins += steal_amount
        coins_stolen = steal_amount

        # Win streak
        attacker.win_streak += 1
        streak_bonus = 0
        crystals_bonus = 0
        if attacker.win_streak % 3 == 0:
            streak_bonus = 50
            attacker.coins += streak_bonus
        if attacker.win_streak % 10 == 0:   # каждые 10 побед — кристалл
            crystals_bonus = 1
            attacker.crystals = getattr(attacker, 'crystals', 0) + crystals_bonus

        # Железо за PvP победу
        attacker.iron = getattr(attacker, 'iron', 0) + random.randint(2, 5)

        db.add(Transaction(user_id=attacker.id, amount=steal_amount + streak_bonus, type="steal",
                           description=f"Рейд на {_display_name(defender)}"))
        db.add(Transaction(user_id=defender.id, amount=-steal_amount, type="lose",
                           description=f"Рейд от {_display_name(attacker)}"))
        streak_msg = f" 🔥 Серия {attacker.win_streak}! +{streak_bonus} бонус!" if streak_bonus else ""
        await create_notification(db, defender.id,
            f"⚔️ <b>{_display_name(attacker)}</b> совершил рейд и украл <b>{steal_amount}</b> монет!",
            notif_type="raid_attack")
    else:
        attacker.win_streak = 0
        streak_msg = ""
        await create_notification(db, defender.id,
            f"🛡 <b>{_display_name(attacker)}</b> пытался атаковать, но провалился!",
            notif_type="general")

    db.add(Raid(attacker_id=attacker.id, defender_id=defender.id,
                attacker_power=attacker_power, defender_power=defender_power,
                success=success, coins_stolen=coins_stolen))
    attacker.last_raid_at = now_utc()
    await db.commit()
    await db.refresh(attacker)

    if success:
        msg = f"Победа! Украдено {coins_stolen} монет{streak_msg}"
    else:
        msg = "Рейд провален — противник сильнее"
    return RaidResult(
        success=success, coins_stolen=coins_stolen,
        attacker_power=attacker_power, defender_power=defender_power,
        message=msg, energy_left=get_current_energy(attacker),
        opponent_name=_display_name(defender),
    )


# ── PvE рейд ─────────────────────────────────────────────────────────────────
async def do_pve_raid(db: AsyncSession, attacker: User) -> PveRaidResult:
    await _spend_energy(db, attacker)

    attacker_power = _total_power(attacker.units, attacker.weapon, attacker.pets)
    if attacker_power == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нужен хотя бы один юнит")

    bot_power = max(1, int(attacker_power * random.uniform(0.7, 1.3)))

    # Применяем модификаторы для PvE: только голод питомцев атакующего
    attacker_power, bot_power = _apply_battle_modifiers(
        attacker, attacker, attacker_power, bot_power, is_pve=True
    )

    # Случайный бросок: ±40% к силе каждой стороны — увеличена случайность
    attacker_roll = attacker_power * random.uniform(0.60, 1.40)
    bot_roll = bot_power * random.uniform(0.60, 1.40)
    success = attacker_roll > bot_roll
    coins_earned = 0
    coins_lost = 0

    if success:
        # Случайная награда 15-25 монет + бонус замка + бонус серии
        from services.shop_service import get_castle_income_bonus
        base = random.randint(15, 25)
        income_bonus_pct = get_castle_income_bonus(attacker.castle_level)
        # Бонус от питомца-ворона (+8% монет)
        raven_bonus = sum(p.gold_bonus for p in attacker.pets)
        total_mult = 1.0 + (income_bonus_pct + raven_bonus) / 100.0
        coins_earned = int(base * total_mult)

        attacker.coins += coins_earned
        attacker.win_streak = getattr(attacker, 'win_streak', 0) + 1

        # Серия побед: каждые 3 — бонус +50, каждые 10 — кристалл
        streak_bonus = 0
        crystals_earned = 0
        if attacker.win_streak % 3 == 0:
            streak_bonus = 50
            attacker.coins += streak_bonus
        if attacker.win_streak % 10 == 0:
            crystals_earned = 1
            attacker.crystals = getattr(attacker, 'crystals', 0) + crystals_earned

        # Железо за PvE победу
        attacker.iron = getattr(attacker, 'iron', 0) + random.randint(3, 8)

        db.add(Transaction(user_id=attacker.id, amount=coins_earned + streak_bonus, type="earn",
                           description="Победа в PvE бою"))
        streak_msg = f" 🔥 Серия {attacker.win_streak}! +{streak_bonus} бонус!" if streak_bonus else ""
    else:
        coins_lost = min(random.randint(5, 15), attacker.coins)
        attacker.coins -= coins_lost
        attacker.win_streak = 0
        coins_earned = 0
        streak_msg = ""
        db.add(Transaction(user_id=attacker.id, amount=-coins_lost, type="lose",
                           description="Поражение в PvE бою"))

    attacker.last_raid_at = now_utc()
    # Логируем PvE бой в журнал (defender_id = attacker_id = признак PvE)
    db.add(Raid(attacker_id=attacker.id, defender_id=attacker.id,
                attacker_power=attacker_power, defender_power=bot_power,
                success=success, coins_stolen=coins_earned if success else 0))
    await db.commit()
    await db.refresh(attacker)

    return PveRaidResult(
        success=success, coins_earned=coins_earned, coins_lost=coins_lost,
        attacker_power=attacker_power, bot_power=bot_power,
        message=f"Победа! +{coins_earned} монет{streak_msg}" if success else f"Поражение. -{coins_lost} монет",
        energy_left=get_current_energy(attacker)
    )


# ── Случайный матчмейкинг ────────────────────────────────────────────────────
async def do_random_raid(db: AsyncSession, attacker: User) -> RaidResult:
    """Находит случайного соперника с похожей силой (±30%) и уровнем замка (±3)."""
    attacker_power = _total_power(attacker.units, attacker.weapon, attacker.pets)
    if attacker_power == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нужен хотя бы один юнит")

    min_castle = max(1, attacker.castle_level - 3)
    max_castle = attacker.castle_level + 3

    # Выбираем кандидатов: тот же диапазон замка, не в щите, не сам себя
    q = await db.execute(
        select(User).where(
            User.id != attacker.id,
            or_(User.shield_until.is_(None), User.shield_until <= now_utc()),
            User.castle_level >= min_castle,
            User.castle_level <= max_castle,
        ).order_by(func.random()).limit(30)
    )
    candidates = q.scalars().all()

    # Фильтруем по силе (±30%)
    min_power = int(attacker_power * 0.70)
    max_power = int(attacker_power * 1.30)
    valid = [u for u in candidates if min_power <= _total_power(u.units) <= max_power]

    # Если точного совпадения нет — берём любого из диапазона замка
    target = random.choice(valid) if valid else (random.choice(candidates) if candidates else None)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND,
                            "Соперников не найдено. Попробуй позже или атакуй вручную!")

    return await do_raid(db, attacker, target.id)


# ── Журнал боёв ───────────────────────────────────────────────────────────────
async def get_battle_journal(db: AsyncSession, user: User, limit: int = 10) -> list[BattleEntry]:
    result = await db.execute(
        select(Raid).where(
            or_(Raid.attacker_id == user.id, Raid.defender_id == user.id)
        ).order_by(Raid.created_at.desc()).limit(limit)
    )
    raids = result.scalars().all()

    # Собираем все нужные user_id для загрузки имён одним запросом
    opponent_ids = set()
    for r in raids:
        opp = r.defender_id if r.attacker_id == user.id else r.attacker_id
        opponent_ids.add(opp)

    opponents: dict[int, User] = {}
    if opponent_ids:
        opp_result = await db.execute(select(User).where(User.id.in_(opponent_ids)))
        for u in opp_result.scalars().all():
            opponents[u.id] = u

    entries = []
    for r in raids:
        # PvE определяется по совпадению attacker и defender
        is_pve = (r.attacker_id == r.defender_id)

        if is_pve:
            is_attack = True
            opp_id = 0
            opp_name = "🤖 Бот"
            coins_delta = r.coins_stolen if r.success else 0
            my_power = r.attacker_power
            opp_power = r.defender_power
            can_revenge = False
        else:
            is_attack = r.attacker_id == user.id
            opp_id = r.defender_id if is_attack else r.attacker_id
            opp = opponents.get(opp_id)
            opp_name = _display_name(opp) if opp else f"#{opp_id}"

            if is_attack:
                coins_delta = r.coins_stolen if r.success else 0
                my_power = r.attacker_power
                opp_power = r.defender_power
            else:
                coins_delta = -r.coins_stolen if r.success else 0
                my_power = r.defender_power
                opp_power = r.attacker_power

            # Месть: меня атаковали, победили, и я ещё не мстил
            can_revenge = (not is_attack) and r.success and not r.is_revenged

        entries.append(BattleEntry(
            id=str(r.id),
            is_attack=is_attack,
            opponent_id=opp_id,
            opponent_name=opp_name,
            success=r.success,
            coins_delta=coins_delta,
            my_power=my_power,
            opponent_power=opp_power,
            can_revenge=can_revenge,
            is_revenged=r.is_revenged,
            created_at=r.created_at
        ))

    return entries


# ── Щит ───────────────────────────────────────────────────────────────────────
async def activate_shield(db: AsyncSession, user: User) -> ShieldResult:
    if user.coins < settings.SHIELD_COST:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Недостаточно монет")
    user.coins -= settings.SHIELD_COST
    shield_until = now_utc() + timedelta(hours=settings.SHIELD_DURATION_HOURS)
    user.shield_until = shield_until
    db.add(Transaction(user_id=user.id, amount=-settings.SHIELD_COST, type="shield",
                       description=f"Щит на {settings.SHIELD_DURATION_HOURS} часов"))
    await db.commit()
    return ShieldResult(shield_until=shield_until.isoformat(), cost=settings.SHIELD_COST)


# ── Ежедневная награда ────────────────────────────────────────────────────────
DAILY_REWARDS = [50, 75, 120, 200, 240, 300, 700]  # 7-дневный цикл


def get_daily_streak_reward(streak: int) -> int:
    """Награда по текущему стрику (1-based, циклится каждые 7 дней)."""
    idx = max(0, streak - 1) % len(DAILY_REWARDS)
    return DAILY_REWARDS[idx]


def get_next_daily_reward(user: User) -> int:
    """Сколько монет получит пользователь при следующем входе."""
    next_streak = (getattr(user, 'daily_streak', 0) or 0) + 1
    return get_daily_streak_reward(next_streak)


async def claim_daily_reward(db: AsyncSession, user: User) -> DailyRewardResult:
    n = now_utc()
    if user.last_daily_reward and n < user.last_daily_reward + timedelta(hours=24):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Уже получено сегодня")

    streak = getattr(user, 'daily_streak', 0) or 0

    # Сбрасываем стрик если пропустили больше 48 часов
    if user.last_daily_reward and n > user.last_daily_reward + timedelta(hours=48):
        streak = 0

    streak += 1
    reward = get_daily_streak_reward(streak)

    user.coins += reward
    user.last_daily_reward = n
    user.daily_streak = streak

    # День 7 цикла — бонус 3 кристалла
    crystals_bonus = 0
    if streak % 7 == 0:
        crystals_bonus = 3
        user.crystals = getattr(user, 'crystals', 0) + crystals_bonus

    db.add(Transaction(user_id=user.id, amount=reward,
                       type="daily", description=f"Ежедневная награда (день {streak})"))
    await db.commit()
    await db.refresh(user)
    return DailyRewardResult(
        coins_earned=reward,
        new_balance=user.coins,
        streak=streak,
        crystals_bonus=crystals_bonus,
    )


# ── Кристаллы ─────────────────────────────────────────────────────────────────
CRYSTAL_COIN_COST = 500  # монет за 1 кристалл

async def buy_crystals(db: AsyncSession, user: User, amount: int = 1) -> dict:
    """Покупка кристаллов за монеты. 500 монет = 1 кристалл."""
    if amount < 1 or amount > 10:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Количество: от 1 до 10")
    total_cost = CRYSTAL_COIN_COST * amount
    if user.coins < total_cost:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Нужно {total_cost} монет. У тебя {user.coins}."
        )
    user.coins -= total_cost
    user.crystals = getattr(user, 'crystals', 0) + amount
    db.add(Transaction(user_id=user.id, amount=-total_cost, type="buy_crystals",
                       description=f"Покупка {amount} кристаллов"))
    await db.commit()
    await db.refresh(user)
    return {
        "crystals_bought": amount,
        "coins_spent": total_cost,
        "new_crystals": user.crystals,
        "new_coins": user.coins,
        "message": f"💎 Куплено {amount} кристалл(ов)! Потрачено {total_cost} монет."
    }


# ── Пассивный доход (каждые 5 часов) ─────────────────────────────────────────
PASSIVE_INCOME_INTERVAL_HOURS = 5
PASSIVE_INCOME_BASE = 50  # монет за 5 часов на замке Lv.1


def get_passive_income_amount(user: User) -> int:
    """Сколько монет доступно как пассивный доход."""
    from services.shop_service import get_castle_income_bonus
    bonus_pct = get_castle_income_bonus(user.castle_level)
    return int(PASSIVE_INCOME_BASE * (1 + bonus_pct / 100))


def get_passive_income_ready(user: User) -> bool:
    """Можно ли забрать пассивный доход прямо сейчас."""
    if user.last_passive_at is None:
        return True
    return now_utc() >= user.last_passive_at + timedelta(hours=PASSIVE_INCOME_INTERVAL_HOURS)


def get_passive_income_next_in(user: User) -> int:
    """Сколько секунд до следующего пассивного дохода."""
    if user.last_passive_at is None:
        return 0
    elapsed = (now_utc() - user.last_passive_at).total_seconds()
    remaining = PASSIVE_INCOME_INTERVAL_HOURS * 3600 - elapsed
    return max(0, int(remaining))


async def claim_passive_income(db: AsyncSession, user: User) -> dict:
    """Забрать пассивный доход (раз в 5 часов)."""
    if not get_passive_income_ready(user):
        secs = get_passive_income_next_in(user)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Доход ещё не готов. Следующее начисление через {secs // 3600}ч {(secs % 3600) // 60}м"
        )
    amount = get_passive_income_amount(user)
    user.coins += amount
    user.last_passive_at = now_utc()
    db.add(Transaction(user_id=user.id, amount=amount, type="earn",
                       description="Пассивный доход замка"))
    await db.commit()
    await db.refresh(user)
    return {
        "coins_earned": amount,
        "new_balance": user.coins,
        "message": f"💰 Пассивный доход: +{amount} монет!",
        "next_in_seconds": PASSIVE_INCOME_INTERVAL_HOURS * 3600,
    }


# ── Удаление юнита ────────────────────────────────────────────────────────────
UNIT_SELL_PERCENT = 0.5  # возврат 50% от стоимости


async def delete_unit(db: AsyncSession, user: User, unit_id: str) -> dict:
    """Продать/удалить юнита. Возвращает 50% от его стоимости."""
    result = await db.execute(select(Unit).where(Unit.id == unit_id, Unit.owner_id == user.id))
    unit = result.scalar_one_or_none()
    if not unit:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Юнит не найден")

    # Возврат монет: базовая цена × индекс × 50%
    base_cost = settings.UNIT_BUY_COST
    unit_index = len(user.units) - 1  # последний купленный — самый дорогой
    refund = int(base_cost * (1.12 ** max(0, unit_index)) * UNIT_SELL_PERCENT)

    user.coins += refund
    db.add(Transaction(user_id=user.id, amount=refund, type="earn",
                       description=f"Продажа юнита {unit.name}"))
    await db.delete(unit)
    await db.commit()
    await db.refresh(user)
    return {
        "message": f"⚔️ {unit.name} продан за {refund} монет",
        "refund": refund,
        "new_balance": user.coins,
    }


# ── Рефералы ──────────────────────────────────────────────────────────────────
async def claim_referral_rewards(db: AsyncSession, user: User) -> ReferralClaimResult:
    result = await db.execute(
        select(Referral).where(Referral.referrer_id == user.id, Referral.reward_claimed == False)  # noqa
    )
    unclaimed = result.scalars().all()
    if not unclaimed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нет неполученных наград")
    total = len(unclaimed) * settings.REFERRAL_REWARD_COINS
    user.coins += total
    for ref in unclaimed:
        ref.reward_claimed = True
    db.add(Transaction(user_id=user.id, amount=total, type="referral",
                       description=f"Реф. награда за {len(unclaimed)} игроков"))
    await db.commit()
    await db.refresh(user)
    return ReferralClaimResult(claimed_count=len(unclaimed), coins_earned=total, new_balance=user.coins)


# ── Лидерборд ─────────────────────────────────────────────────────────────────
async def get_leaderboard(db: AsyncSession, limit: int = 50, sort: str = "coins") -> list[dict]:
    from core.config import settings as _s

    if sort == "wins":
        order = User.win_streak.desc()
    else:
        order = User.coins.desc()   # "coins" и "power" — сначала берём по монетам, power сортируем в Python

    result = await db.execute(
        select(User).where(User.id != _s.ADMIN_USER_ID).order_by(order).limit(limit if sort != "power" else 200)
    )
    users = result.scalars().all()

    rows = [
        {
            "user_id": u.id, "username": u.username,
            "first_name": u.first_name, "nickname": u.nickname,
            "coins": u.coins, "total_power": _total_power(u.units),
            "win_streak": u.win_streak,
        }
        for u in users
    ]

    if sort == "power":
        rows.sort(key=lambda r: r["total_power"], reverse=True)
        rows = rows[:limit]

    return [{"rank": i + 1, **r} for i, r in enumerate(rows)]
