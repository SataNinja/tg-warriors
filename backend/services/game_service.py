"""
Игровая логика: покупка/прокачка юнитов, рейды, щит, ежедневная награда, рефералы.
Все расчёты только здесь — routers лишь вызывают функции сервиса.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sql_func

from core.config import settings
from models.user import User
from models.unit import Unit
from models.raid import Raid
from models.referral import Referral
from models.transaction import Transaction
from schemas.game import RaidResult, ShieldResult, DailyRewardResult, ReferralClaimResult
from services.notification_service import create_notification


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── ЮНИТЫ ─────────────────────────────────────────────────────────────────
async def buy_unit(db: AsyncSession, user: User) -> Unit:
    if user.coins < settings.UNIT_BUY_COST:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Недостаточно монет")

    user.coins -= settings.UNIT_BUY_COST
    unit = Unit(owner_id=user.id)
    db.add(unit)
    db.add(Transaction(
        user_id=user.id,
        amount=-settings.UNIT_BUY_COST,
        type="buy_unit",
        description="Покупка юнита Warrior"
    ))
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
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Нужно {cost} монет для прокачки")

    user.coins -= cost
    unit.level += 1
    unit.power += 5
    unit.defense += 3
    db.add(Transaction(
        user_id=user.id,
        amount=-cost,
        type="upgrade",
        description=f"Прокачка юнита до уровня {unit.level}"
    ))
    await db.commit()
    await db.refresh(unit)
    return unit


def _total_power(units: list[Unit]) -> int:
    return sum(u.power for u in units)


def _total_defense(units: list[Unit]) -> int:
    return sum(u.defense for u in units)


# ── РЕЙД ──────────────────────────────────────────────────────────────────
async def do_raid(db: AsyncSession, attacker: User, target_id: int) -> RaidResult:
    if attacker.id == target_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя атаковать себя")

    # Кулдаун
    if attacker.last_raid_at:
        elapsed = (now_utc() - attacker.last_raid_at).total_seconds()
        if elapsed < settings.RAID_COOLDOWN_SECONDS:
            remaining = int(settings.RAID_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"Следующий рейд доступен через {remaining} секунд"
            )

    result = await db.execute(select(User).where(User.id == target_id))
    defender: Optional[User] = result.scalar_one_or_none()
    if not defender:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Игрок не найден")

    # Щит защищает от рейда
    if defender.shield_until and defender.shield_until > now_utc():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Цель защищена щитом")

    attacker_power = _total_power(attacker.units)
    defender_power = _total_defense(defender.units)

    # Если у атакующего нет юнитов — рейд невозможен
    if attacker_power == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нужен хотя бы один юнит для рейда")

    success = attacker_power > defender_power
    coins_stolen = 0

    if success:
        steal_amount = int(defender.coins * settings.RAID_STEAL_PERCENT)
        steal_amount = max(1, min(steal_amount, defender.coins))
        defender.coins -= steal_amount
        attacker.coins += steal_amount
        coins_stolen = steal_amount

        db.add(Transaction(user_id=attacker.id, amount=steal_amount, type="steal",
                           description=f"Рейд на {defender.first_name}"))
        db.add(Transaction(user_id=defender.id, amount=-steal_amount, type="lose",
                           description=f"Рейд от {attacker.first_name}"))

        await create_notification(
            db, defender.id,
            f"⚔️ <b>{attacker.first_name}</b> совершил рейд и украл у тебя <b>{steal_amount}</b> монет!"
        )
    else:
        await create_notification(
            db, defender.id,
            f"🛡 <b>{attacker.first_name}</b> пытался тебя атаковать, но провалился!"
        )

    raid = Raid(
        attacker_id=attacker.id,
        defender_id=defender.id,
        attacker_power=attacker_power,
        defender_power=defender_power,
        success=success,
        coins_stolen=coins_stolen
    )
    db.add(raid)
    attacker.last_raid_at = now_utc()
    await db.commit()

    msg = (
        f"Успех! Украдено {coins_stolen} монет" if success
        else "Рейд провален — противник сильнее"
    )
    return RaidResult(
        success=success,
        coins_stolen=coins_stolen,
        attacker_power=attacker_power,
        defender_power=defender_power,
        message=msg
    )


# ── ЩИТ ───────────────────────────────────────────────────────────────────
async def activate_shield(db: AsyncSession, user: User) -> ShieldResult:
    if user.coins < settings.SHIELD_COST:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Недостаточно монет для щита")

    user.coins -= settings.SHIELD_COST
    shield_until = now_utc() + timedelta(hours=settings.SHIELD_DURATION_HOURS)
    user.shield_until = shield_until

    db.add(Transaction(
        user_id=user.id,
        amount=-settings.SHIELD_COST,
        type="shield",
        description=f"Щит на {settings.SHIELD_DURATION_HOURS} часов"
    ))
    await db.commit()
    return ShieldResult(
        shield_until=shield_until.isoformat(),
        cost=settings.SHIELD_COST
    )


# ── ЕЖЕДНЕВНАЯ НАГРАДА ────────────────────────────────────────────────────
async def claim_daily_reward(db: AsyncSession, user: User) -> DailyRewardResult:
    if user.last_daily_reward:
        next_reward = user.last_daily_reward + timedelta(hours=24)
        if now_utc() < next_reward:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Награда уже получена сегодня")

    user.coins += settings.DAILY_REWARD_COINS
    user.last_daily_reward = now_utc()

    db.add(Transaction(
        user_id=user.id,
        amount=settings.DAILY_REWARD_COINS,
        type="daily",
        description="Ежедневная награда"
    ))
    await db.commit()
    await db.refresh(user)
    return DailyRewardResult(
        coins_earned=settings.DAILY_REWARD_COINS,
        new_balance=user.coins
    )


# ── РЕФЕРАЛЫ ─────────────────────────────────────────────────────────────
async def claim_referral_rewards(db: AsyncSession, user: User) -> ReferralClaimResult:
    result = await db.execute(
        select(Referral).where(
            Referral.referrer_id == user.id,
            Referral.reward_claimed == False  # noqa: E712
        )
    )
    unclaimed = result.scalars().all()

    if not unclaimed:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нет неполученных реферальных наград")

    total = len(unclaimed) * settings.REFERRAL_REWARD_COINS
    user.coins += total

    for ref in unclaimed:
        ref.reward_claimed = True

    db.add(Transaction(
        user_id=user.id,
        amount=total,
        type="referral",
        description=f"Реферальная награда за {len(unclaimed)} приглашённых"
    ))
    await db.commit()
    await db.refresh(user)
    return ReferralClaimResult(
        claimed_count=len(unclaimed),
        coins_earned=total,
        new_balance=user.coins
    )


# ── ЛИДЕРБОРД ─────────────────────────────────────────────────────────────
async def get_leaderboard(db: AsyncSession, limit: int = 50) -> list[dict]:
    result = await db.execute(
        select(User).order_by(User.coins.desc()).limit(limit)
    )
    users = result.scalars().all()

    board = []
    for rank, u in enumerate(users, 1):
        board.append({
            "rank": rank,
            "user_id": u.id,
            "username": u.username,
            "first_name": u.first_name,
            "coins": u.coins,
            "total_power": _total_power(u.units)
        })
    return board
