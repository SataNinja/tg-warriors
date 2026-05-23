import random
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

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
def _total_power(units: list[Unit]) -> int:
    return sum(u.power for u in units)


def _display_name(user: User) -> str:
    return user.nickname or user.first_name


# ── Юниты ─────────────────────────────────────────────────────────────────────
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
                       description=f"Прокачка до уровня {unit.level}"))
    await db.commit()
    await db.refresh(unit)
    return unit


# ── PvP рейд ─────────────────────────────────────────────────────────────────
async def do_raid(db: AsyncSession, attacker: User, target_id: int) -> RaidResult:
    if attacker.id == target_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нельзя атаковать себя")

    await _spend_energy(db, attacker)

    result = await db.execute(select(User).where(User.id == target_id))
    defender: Optional[User] = result.scalar_one_or_none()
    if not defender:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Игрок не найден")

    if defender.shield_until and defender.shield_until > now_utc():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Цель защищена щитом")

    attacker_power = _total_power(attacker.units)
    defender_power = _total_power(defender.units)  # используем power, не defense

    if attacker_power == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нужен хотя бы один юнит")

    success = attacker_power > defender_power
    coins_stolen = 0

    if success:
        # Защитник теряет ровно столько, сколько атакующий получает
        steal_amount = max(1, min(int(defender.coins * settings.RAID_STEAL_PERCENT), defender.coins))
        defender.coins -= steal_amount
        attacker.coins += steal_amount
        coins_stolen = steal_amount
        db.add(Transaction(user_id=attacker.id, amount=steal_amount, type="steal",
                           description=f"Рейд на {_display_name(defender)}"))
        db.add(Transaction(user_id=defender.id, amount=-steal_amount, type="lose",
                           description=f"Рейд от {_display_name(attacker)}"))
        await create_notification(db, defender.id,
            f"⚔️ <b>{_display_name(attacker)}</b> совершил рейд и украл <b>{steal_amount}</b> монет!")
    else:
        await create_notification(db, defender.id,
            f"🛡 <b>{_display_name(attacker)}</b> пытался атаковать, но провалился!")

    db.add(Raid(attacker_id=attacker.id, defender_id=defender.id,
                attacker_power=attacker_power, defender_power=defender_power,
                success=success, coins_stolen=coins_stolen))
    attacker.last_raid_at = now_utc()
    await db.commit()
    await db.refresh(attacker)

    msg = f"Победа! Украдено {coins_stolen} монет" if success else "Рейд провален — противник сильнее"
    return RaidResult(
        success=success, coins_stolen=coins_stolen,
        attacker_power=attacker_power, defender_power=defender_power,
        message=msg, energy_left=get_current_energy(attacker)
    )


# ── PvE рейд ─────────────────────────────────────────────────────────────────
async def do_pve_raid(db: AsyncSession, attacker: User) -> PveRaidResult:
    await _spend_energy(db, attacker)

    attacker_power = _total_power(attacker.units)
    if attacker_power == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нужен хотя бы один юнит")

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
        success=success, coins_earned=coins_earned, coins_lost=coins_lost,
        attacker_power=attacker_power, bot_power=bot_power,
        message=f"Победа! +{coins_earned} монет" if success else f"Поражение. -{coins_lost} монет",
        energy_left=get_current_energy(attacker)
    )


# ── Журнал боёв ───────────────────────────────────────────────────────────────
async def get_battle_journal(db: AsyncSession, user: User, limit: int = 30) -> list[BattleEntry]:
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
        is_attack = r.attacker_id == user.id
        opp_id = r.defender_id if is_attack else r.attacker_id
        opp = opponents.get(opp_id)
        opp_name = _display_name(opp) if opp else f"#{opp_id}"

        # Сколько монет изменилось у меня
        if is_attack:
            coins_delta = r.coins_stolen if r.success else 0
            my_power = r.attacker_power
            opp_power = r.defender_power
        else:
            coins_delta = -r.coins_stolen if r.success else 0
            my_power = r.defender_power
            opp_power = r.attacker_power

        # Кнопка мести: меня атаковали и победили
        can_revenge = (not is_attack) and r.success

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
async def claim_daily_reward(db: AsyncSession, user: User) -> DailyRewardResult:
    if user.last_daily_reward and now_utc() < user.last_daily_reward + timedelta(hours=24):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Уже получено сегодня")
    user.coins += settings.DAILY_REWARD_COINS
    user.last_daily_reward = now_utc()
    db.add(Transaction(user_id=user.id, amount=settings.DAILY_REWARD_COINS,
                       type="daily", description="Ежедневная награда"))
    await db.commit()
    await db.refresh(user)
    return DailyRewardResult(coins_earned=settings.DAILY_REWARD_COINS, new_balance=user.coins)


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
async def get_leaderboard(db: AsyncSession, limit: int = 50) -> list[dict]:
    result = await db.execute(select(User).order_by(User.coins.desc()).limit(limit))
    users = result.scalars().all()
    return [{"rank": rank, "user_id": u.id, "username": u.username,
             "first_name": u.first_name, "nickname": u.nickname,
             "coins": u.coins, "total_power": _total_power(u.units)}
            for rank, u in enumerate(users, 1)]
