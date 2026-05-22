from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import validate_telegram_init_data
from schemas.auth import TelegramAuthRequest, TokenResponse
from services.auth_service import get_or_create_user, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/telegram", response_model=TokenResponse)
async def auth_telegram(body: TelegramAuthRequest, db: AsyncSession = Depends(get_db)):
    """
    Принимает initData из Telegram.WebApp.initData,
    верифицирует подпись и возвращает JWT.
    """
    parsed = validate_telegram_init_data(body.init_data)
    if not parsed:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Невалидные данные Telegram")

    telegram_user = parsed.get("user")
    if not telegram_user:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Нет данных пользователя")

    user = await get_or_create_user(db, telegram_user, referrer_id=body.referrer_id)
    token = create_access_token(user.id)

    return TokenResponse(access_token=token, user_id=user.id)
