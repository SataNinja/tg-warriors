"""
Фоновые триггеры уведомлений.

Каждые 5 минут проверяет всех пользователей и создаёт уведомления если:
  - энергия заполнена (energy_full)
  - ежедневная награда готова (daily_ready)
  - пассивный доход готов (passive_ready)

Защита от спама: не создаём уведомление если уже есть
несколько отправленных или отправляемых за последние N часов.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from core.database import AsyncSessionLocal
from models.user import User
from models.notification import Notification
from services.game_service import (
    get_current_energy, MAX_ENERGY,
    get_passive_income_ready, get_passive_income_amount,
)

logger = logging.getLogger(__name__)

CHECK_INTERVAL_SECONDS = 300  # каждые 5 минут


async def _has_recent_notification(
    db: AsyncSession,
    user_id: int,
    notif_type: str,
    since: datetime,
) -> bool:
    """True если уведомление данного типа уже было создано после 'since'."""
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.user_id == user_id,
                Notification.type == notif_type,
                Notification.created_at >= since,
            )
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def check_and_create_notifications(db: AsyncSession) -> int:
    """
    Проходит по всем пользователям и создаёт уведомления при необходимости.
    Возвращает количество созданных уведомлений.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(select(User))
    users = result.scalars().all()

    count = 0
    for user in users:
        try:
            # ── 1. Энергия полная ────────────────────────────────────────────
            energy = get_current_energy(user)
            if energy >= MAX_ENERGY:
                # Не чаще одного раза за 6 часов
                since_energy = now - timedelta(hours=6)
                if not await _has_recent_notification(db, user.id, "energy_full", since_energy):
                    notif = Notification(
                        user_id=user.id,
                        message="⚡ Энергия полная! Самое время совершить рейд и пополнить казну.",
                        type="energy_full",
                    )
                    db.add(notif)
                    count += 1

            # ── 2. Ежедневная награда готова ─────────────────────────────────
            daily_ready = (
                user.last_daily_reward is None
                or (now - user.last_daily_reward) >= timedelta(hours=24)
            )
            if daily_ready:
                # Не чаще одного раза за 24 часа
                since_daily = now - timedelta(hours=24)
                if not await _has_recent_notification(db, user.id, "daily_ready", since_daily):
                    notif = Notification(
                        user_id=user.id,
                        message="🎁 Ежедневная награда готова! Заходи и забирай монеты.",
                        type="daily_ready",
                    )
                    db.add(notif)
                    count += 1

            # ── 3. Пассивный доход готов ─────────────────────────────────────
            if get_passive_income_ready(user):
                # Не чаще одного раза за 5 часов
                since_passive = now - timedelta(hours=5)
                if not await _has_recent_notification(db, user.id, "passive_ready", since_passive):
                    amount = get_passive_income_amount(user)
                    notif = Notification(
                        user_id=user.id,
                        message=f"💰 Пассивный доход замка готов! +{amount} монет ждут тебя.",
                        type="passive_ready",
                    )
                    db.add(notif)
                    count += 1

        except Exception as e:
            logger.warning(f"Error checking notifications for user {user.id}: {e}")

    if count > 0:
        await db.commit()
        logger.info(f"Notification triggers: created {count} notifications")

    return count


async def notification_trigger_loop():
    """Фоновая задача: каждые 5 минут проверяет условия для уведомлений."""
    logger.info("Notification trigger loop started")
    # Небольшая задержка при старте чтобы БД успела инициализироваться
    await asyncio.sleep(30)

    while True:
        try:
            async with AsyncSessionLocal() as db:
                await check_and_create_notifications(db)
        except Exception as e:
            logger.error(f"Notification trigger loop error: {e}")

        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
