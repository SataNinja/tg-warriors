"""
Сервис уведомлений.

Схема работы:
  1. Backend создаёт запись в таблице notifications (is_sent=False).
  2. Бот каждые 10 секунд запрашивает GET /internal/notifications/pending.
  3. Бот отправляет сообщения в Telegram и помечает их через POST /internal/notifications/{id}/sent.

Это позволяет backend не зависеть от бота напрямую.
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.notification import Notification


async def create_notification(db: AsyncSession, user_id: int, message: str) -> Notification:
    notif = Notification(user_id=user_id, message=message)
    db.add(notif)
    # Не делаем commit здесь — вызывающий код сделает это сам
    return notif


async def get_pending_notifications(db: AsyncSession, limit: int = 50) -> list[Notification]:
    result = await db.execute(
        select(Notification)
        .where(Notification.is_sent == False)  # noqa: E712
        .order_by(Notification.created_at)
        .limit(limit)
    )
    return result.scalars().all()


async def mark_notification_sent(db: AsyncSession, notification_id: uuid.UUID) -> bool:
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    notif = result.scalar_one_or_none()
    if not notif:
        return False
    notif.is_sent = True
    await db.commit()
    return True
