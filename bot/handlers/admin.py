"""
Админ-команды для бота. Доступны только пользователю с ADMIN_USER_ID.
"""
import os
import logging
import aiohttp

from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message

router = Router()
logger = logging.getLogger(__name__)

ADMIN_USER_ID = int(os.getenv("ADMIN_USER_ID", "6320200740"))
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")


@router.message(Command("token"))
async def cmd_token(message: Message):
    """
    Отправляет JWT-токен администратору.
    Используй для авторизации в Swagger (/docs).
    """
    if message.from_user.id != ADMIN_USER_ID:
        return  # тихо игнорируем — не говорим что команда существует

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{BACKEND_URL}/internal/token/{ADMIN_USER_ID}",
                headers={"X-Internal-Token": os.getenv("SECRET_KEY", "")},
                timeout=aiohttp.ClientTimeout(total=5)
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    token = data["access_token"]
                    await message.answer(
                        f"🔑 <b>Твой JWT-токен для Swagger:</b>\n\n"
                        f"<code>Bearer {token}</code>\n\n"
                        f"📋 Скопируй и вставь в поле <b>Authorize 🔓</b> на:\n"
                        f"<code>https://tg-warriors-production.up.railway.app/docs</code>",
                        parse_mode="HTML"
                    )
                else:
                    await message.answer("❌ Ошибка получения токена. Проверь backend.")
    except Exception as e:
        logger.error(f"Token fetch error: {e}")
        await message.answer(f"❌ Не удалось подключиться к backend: {e}")
