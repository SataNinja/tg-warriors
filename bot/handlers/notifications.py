"""
Фоновый поллинг уведомлений от backend.
Каждые 10 секунд бот забирает pending-уведомления и отправляет их пользователям.

Типы уведомлений:
  - raid_attack  → inline кнопка "Отомстить 🗡" (открывает вкладку боёв в Mini App)
  - energy_full  → inline кнопка "Играть ⚡"
  - daily_ready  → inline кнопка "Забрать награду 🎁"
  - general      → просто текст
"""
import asyncio
import logging
import os

import aiohttp
from aiogram import Bot, Router
from aiogram.enums import ParseMode
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from dotenv import load_dotenv

load_dotenv()

router = Router()
logger = logging.getLogger(__name__)

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
MINI_APP_URL = os.getenv("MINI_APP_URL", "")


def _build_keyboard(notif_type: str, user_id: int) -> InlineKeyboardMarkup | None:
    """Строит клавиатуру в зависимости от типа уведомления."""
    if not MINI_APP_URL:
        return None

    # Базовая ссылка на Mini App
    base_url = MINI_APP_URL

    if notif_type == "raid_attack":
        # Открывает Mini App на вкладке боёв (fragment #raid)
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="🗡 Отомстить",
                web_app=WebAppInfo(url=f"{base_url}?tab=raid")
            )
        ]])
    elif notif_type == "energy_full":
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="⚡ В бой!",
                web_app=WebAppInfo(url=f"{base_url}?tab=raid")
            )
        ]])
    elif notif_type == "daily_ready":
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="🎁 Забрать награду",
                web_app=WebAppInfo(url=f"{base_url}?tab=main")
            )
        ]])
    elif notif_type == "passive_ready":
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="💰 Забрать доход",
                web_app=WebAppInfo(url=f"{base_url}?tab=main")
            )
        ]])
    else:
        # Для всех остальных уведомлений — кнопка "Играть"
        return InlineKeyboardMarkup(inline_keyboard=[[
            InlineKeyboardButton(
                text="⚔️ Играть",
                web_app=WebAppInfo(url=base_url)
            )
        ]])


async def poll_and_send_notifications(bot: Bot):
    """
    Фоновая задача: каждые 10 секунд забирает pending-уведомления
    и отправляет их с inline-кнопками.
    """
    secret_key = os.getenv("SECRET_KEY", "")
    headers = {"X-Internal-Token": secret_key}

    async with aiohttp.ClientSession() as session:
        while True:
            try:
                async with session.get(
                    f"{BACKEND_URL}/internal/notifications/pending",
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as resp:
                    if resp.status == 200:
                        notifications = await resp.json()
                        for notif in notifications:
                            try:
                                notif_type = notif.get("type", "general")
                                keyboard = _build_keyboard(notif_type, notif["user_id"])

                                await bot.send_message(
                                    chat_id=notif["user_id"],
                                    text=notif["message"],
                                    parse_mode=ParseMode.HTML,
                                    reply_markup=keyboard,
                                )
                                # Помечаем как отправленное
                                await session.post(
                                    f"{BACKEND_URL}/internal/notifications/{notif['id']}/sent",
                                    headers=headers,
                                )
                            except Exception as e:
                                logger.warning(f"Failed to send notification {notif['id']}: {e}")
            except Exception as e:
                logger.error(f"Notification poll error: {e}")

            await asyncio.sleep(10)
