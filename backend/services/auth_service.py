"""
Сервис аутентификации: создание/получение пользователя,
генерация и валидация JWT-токена на основе Telegram user_id.
"""
import time
import hmac
import hashlib
import base64
import json
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.config import settings
from models.user import User
from models.referral import Referral
from models.transaction import Transaction


# ── Простой JWT без внешних библиотек ──────────────────────────────────────
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def create_access_token(user_id: int) -> str:
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps({"sub": user_id, "iat": int(time.time())}).encode())
    signature = _b64url(
        hmac.new(
            settings.SECRET_KEY.encode(),
            f"{header}.{payload}".encode(),
            hashlib.sha256
        ).digest()
    )
    return f"{header}.{payload}.{signature}"


def decode_access_token(token: str) -> Optional[int]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, payload, signature = parts
        expected_sig = _b64url(
            hmac.new(
                settings.SECRET_KEY.encode(),
                f"{header}.{payload}".encode(),
                hashlib.sha256
            ).digest()
        )
        if not hmac.compare_digest(expected_sig, signature):
            return None
        # Добавляем padding обратно
        payload += "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(payload))
        return data.get("sub")
    except Exception:
        return None


# ── Работа с пользователем ─────────────────────────────────────────────────
async def get_or_create_user(
    db: AsyncSession,
    telegram_user: dict,
    referrer_id: Optional[int] = None
) -> User:
    user_id = telegram_user["id"]

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user:
        # Обновляем имя на случай если пользователь его менял
        user.first_name = telegram_user.get("first_name", user.first_name)
        user.username = telegram_user.get("username", user.username)
        await db.commit()
        await db.refresh(user)
        return user

    # Новый пользователь
    user = User(
        id=user_id,
        username=telegram_user.get("username"),
        first_name=telegram_user.get("first_name", ""),
        last_name=telegram_user.get("last_name"),
        coins=settings.STARTING_COINS,
        iron=10,        # стартовый запас железа для первой прокачки оружия
        crystals=0,
        referrer_id=referrer_id if referrer_id != user_id else None
    )
    db.add(user)
    await db.flush()

    # Записываем реферала и сразу начисляем награду рефереру
    if referrer_id and referrer_id != user_id:
        ref_check = await db.execute(
            select(Referral).where(Referral.referred_id == user_id)
        )
        if not ref_check.scalar_one_or_none():
            referral = Referral(
                referrer_id=referrer_id,
                referred_id=user_id,
                reward_claimed=True   # уже начислено ниже
            )
            db.add(referral)

            # Автоматически начисляем монеты рефереру
            referrer_result = await db.execute(select(User).where(User.id == referrer_id))
            referrer = referrer_result.scalar_one_or_none()
            if referrer:
                referrer.coins += settings.REFERRAL_REWARD_COINS
                db.add(Transaction(
                    user_id=referrer_id,
                    amount=settings.REFERRAL_REWARD_COINS,
                    type="referral",
                    description=f"Реферал зарегистрировался: {telegram_user.get('first_name', '')}"
                ))

    # Стартовая транзакция
    db.add(Transaction(
        user_id=user_id,
        amount=settings.STARTING_COINS,
        type="earn",
        description="Стартовые монеты"
    ))

    await db.commit()
    await db.refresh(user)
    return user
