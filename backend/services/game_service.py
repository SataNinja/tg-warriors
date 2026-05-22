import random
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import settings
from models.user import User
from models.unit import Unit
from models.raid import Raid
from models.referral import Referral
from models.transaction import Transaction
from schemas.game import RaidResult, PveRaidResult, ShieldResult, DailyRewardResult, ReferralClaimResult
from services.notification_service import create_notification

# ── Константы энергии ────────────────────────────────────────────────────────
MAX_ENERGY = 50
ENERGY_PER_RAID = 5
ENERGY_REGEN_SECONDS = 360  # +1 энергии каждые 6 минут


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── Энергия ───────────────────────────────────────────────────────────────────
def get_current_energy(user: User) -> int:
    """Считает актуальный запас энергии с учётом регенерации."""
    if user.energy_updated_at is None:
        return user.energy

    elapsed = (now_utc() - user.energy_updated_at).total_seconds()
    regenerated = int(elapsed // ENERGY_REGEN_SECONDS)
    current = min(MAX_ENERGY, user.energy + regenerated)
    return current


def energy_regen_eta(user: User) -> int:
    """Секунд до следующего +1 энергии."""
    if user.energy_updated_at is None:
        return 0
    elapsed = (now_utc() - user.energy_updated_at).total_seconds()
    remainder = elapsed % ENERGY_REGEN_SECONDS
    return max(0, int(ENERGY_REGEN_SECONDS - remainder))


async def _spend_energy(db: AsyncSession, user: User, amount: int = ENERGY_PER_RAID):
    """Списывает энергию, обновляет метку времени."""
    current = get_current_energy(user)
    if current < amount:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Недостаточно энергии ({current}/{MAX_ENERGY}). Она восстанавливается: +1 каждые 6 минут."
        )
    # Синхронизируем energy с реальным значением перед списанием
    user.energy = current - amount
    user.energy_updated_at = now_utc()


# ── Юниты ─────────────────────────────────────────────────────────────────────
def _total_power(units: list[Unit]) -> int:
    return sum(u.power for u in units)


def _total_defense(units: list[Unit]) -> int:
    return sum(u.defense for u in units)


async def buy_unit(db: AsyncSession, user: User) -> Unit:
    if user.coins < settings.UNIT_BUY_COST:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Недостаточно монет")

    user.coins -= settings.UNIT_BUY_COST
    unit = Unit(owner_id=user.id)
    db.add(unit)
    db.add(Transaction(user_id=user.id, amount=-settings.UNIT_BUY_COST,
                       type="buy_unit", description="Покупка юнита Warrior"))
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
                       description=f"Прокачка юнита до уровня {unit.level}"))
    await db.commit()
    await db.refresh(unit)
    return unit


# ── PvP Рейд ──────────────────────────────────────────────────────────────────
async def do_raid(db: AsyncSession, attacker: User, target_id: int) -> RaidResult:
    if attacker.id == target_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя атаковать себя")

    if attacker.last_raid_at:
        elapsed = (now_utc() - attacker.last_raid_at).total_seconds()
        if elapsed < settings.RAID_COOLDOWN_SECONDS:
            remaining = int(settings.RAID_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                                f"Следующий рейд через {remaining} секунд")

    await _spend_energy(db, attacker)

    result = await db.execute(select(User).where(User.id == target_id))
    defender: Optional[User] = result.scalar_one_or_none()
    if not defender:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Игрок не найден")

    if defender.shield_until and defender.shield_until > now_utc():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Цель защищена щитом")

    attacker_power = _total_power(attacker.units)
    defender_power = _total_defense(defender.units)

    if attacker_power == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нужен хотя бы один юнит")

    success = attacker_power > defender_power
    coins_stolen = 0

    if success:
        steal_amount = max(1, min(int(defender.coins * settings.RAID_STEAL_PERCENT), defender.coins))
        defender.coins -= steal_amount
        attacker.coins += steal_amount
        coins_stolen = steal_amount
        db.add(Transaction(user_id=attacker.id, amount=steal_amount, type="steal",
                           description=f"Рейд на {defender.nickname or defender.first_name}"))
        db.add(Transaction(user_id=defender.id, amount=-steal_amount, type="lose",
                           description=f"Рейд от {attacker.nickname or attacker.first_name}"))
        await create_notification(db, defender.id,
            f"⚔️ <b>{attacker.nickname or attacker.first_name}</b> украл у тебя <b>{steal_amount}</b> монет!")
    else:
        await create_notification(db, defender.id,
            f"🛡 <b>{attacker.nickname or attacker.first_name}</b> пытался атаковать, но провалился!")

    db.add(Raid(attacker_id=attacker.id, defender_id=defender.id,
                attacker_power=attacker_power, defender_power=defender_power,
                success=success, coins_stolen=coins_stolen))
    attacker.last_raid_at = now_utc()
    await db.commit()
    await db.refresh(attacker)

    return RaidResult(
        success=success,
        coins_stolen=coins_stolen,
        attacker_power=attacker_power,
        defender_power=defender_power,
        message="Успех! Украдено " + str(coins_stolen) + " монет" if success else "Рейд провален — противник сильнее",
        energy_left=get_current_energy(attacker)
    )


# ── PvE Рейд (бой с ботом) ────────────────────────────────────────────────────
async def do_pve_raid(db: AsyncSession, attacker: User) -> PveRaidResult:
    if attacker.last_raid_at:
        elapsed = (now_utc() - attacker.last_raid_at).total_seconds()
        if elapsed < settings.RAID_COOLDOWN_SECONDS:
            remaining = int(settings.RAID_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS,
                                f"Следующий бой через {remaining} секунд")

    await _spend_energy(db, attacker)

    attacker_power = _total_power(attacker.units)
    if attacker_power == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нужен хотя бы один юнит")

    # Бот имеет силу ±30% от силы атакующего
    bot_power = max(1, int(attacker_power * random.uniform(0.7, 1.3)))
    success = attacker_power > bot_power

    coins_earned = 0
    coins_lost = 0

    if success:
        coins_earned = 15 + attacker_power * 2
        attacker.coins += coins_earned
        db.add(Transaction(user_id=attacker.id, amount=coins_earned, type="earn",
                           description="Победа в PvE бою"))
    else:
        coins_lost = min(10 + attacker_power, attacker.coins)
        attacker.coins -= coins_lost
        db.add(Transaction(user_id=attacker.id, amount=-coins_lost, type="lose",
                           description="Поражение в PvE бою"))

    attacker.last_raid_at = now_utc()
    await db.commit()
    await db.refresh(attacker)

    return PveRaidResult(
        success=success,
        coins_earned=coins_earned,
        coins_lost=coins_lost,
        attacker_power=attacker_power,
        bot_power=bot_power,
        message=f"Победа! +{coins_earned} монет" if success else f"Поражение. -{coins_lost} монет",
        energy_left=get_current_energy(attacker)
    )


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
async def claim_daily_reward(db: AsyncSession, user: User) -> DailyRewardResult:
    if user.last_daily_reward:
        if now_utc() < user.last_daily_reward + timedelta(hours=24):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Награда уже получена сегодня")

    user.coins += settings.DAILY_REWARD_COINS
    user.last_daily_reward = now_utc()
    db.add(Transaction(user_id=user.id, amount=settings.DAILY_REWARD_COINS,
                       type="daily", description="Ежедневная награда"))
    await db.commit()
    await db.refresh(user)
    return DailyRewardResult(coins_earned=settings.DAILY_REWARD_COINS, new_balance=user.coins)


# ── Рефералы (ручной клейм) ───────────────────────────────────────────────────
async def claim_referral_rewards(db: AsyncSession, user: User) -> ReferralClaimResult:
    result = await db.execute(
        select(Referral).where(Referral.referrer_id == user.id, Referral.reward_claimed == False)  # noqa
    )
    unclaimed = result.scalars().all()
    if not unclaimed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нет неполученных реферальных наград")

    total = len(unclaimed) * settings.REFERRAL_REWARD_COINS
    user.coins += total
    for ref in unclaimed:
        ref.reward_claimed = True
    db.add(Transaction(user_id=user.id, amount=total, type="referral",
                       description=f"Реферальная награда за {len(unclaimed)} приглашённых"))
    await db.commit()
    await db.refresh(user)
    return ReferralClaimResult(claimed_count=len(unclaimed), coins_earned=total, new_balance=user.coins)


# ── Лидерборд ─────────────────────────────────────────────────────────────────
async def get_leaderboard(db: AsyncSession, limit: int = 50) -> list[dict]:
    result = await db.execute(select(User).order_by(User.coins.desc()).limit(limit))
    users = result.scalars().all()
    return [
        {
            "rank": rank,
            "user_id": u.id,
            "username": u.username,
            "first_name": u.first_name,
            "nickname": u.nickname,
            "coins": u.coins,
            "total_power": _total_power(u.units)
        }
        for rank, u in enumerate(users, 1)
    ]
