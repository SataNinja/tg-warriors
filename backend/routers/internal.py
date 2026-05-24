"""
Internal endpoints — только для бота.
Защищены заголовком X-Internal-Token.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from schemas.game import NotificationOut
from services.notification_service import get_pending_notifications, mark_notification_sent
from services.auth_service import create_access_token

router = APIRouter(prefix="/internal", tags=["internal"])


def verify_internal_token(x_internal_token: str = Header(...)):
    if x_internal_token != settings.SECRET_KEY:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")


@router.get(
    "/notifications/pending",
    response_model=list[NotificationOut],
    dependencies=[Depends(verify_internal_token)]
)
async def pending_notifications(db: AsyncSession = Depends(get_db)):
    """Возвращает несколько непосланных уведомлений для бота."""
    notifications = await get_pending_notifications(db, limit=50)
    return [
        NotificationOut(
            id=str(n.id),
            user_id=n.user_id,
            message=n.message,
            type=getattr(n, 'type', 'general'),
            is_sent=n.is_sent
        )
        for n in notifications
    ]


@router.post(
    "/notifications/{notification_id}/sent",
    dependencies=[Depends(verify_internal_token)]
)
async def mark_sent(notification_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Помечает уведомление как отправленное."""
    ok = await mark_notification_sent(db, notification_id)
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification not found")
    return {"ok": True}


@router.get(
    "/token/{user_id}",
    dependencies=[Depends(verify_internal_token)]
)
async def get_user_token(user_id: int):
    """Генерирует JWT-токен для указанного user_id (только для бота/внутреннего использования)."""
    token = create_access_token(user_id)
    return {"access_token": token}
