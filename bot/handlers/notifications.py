"""
Этот роутер отвечает за входящие webhook-уведомления от backend.
Backend делает POST /notify на специальный endpoint бота (если используется webhook),
либо бот сам периодически опрашивает backend — здесь реализован второй вариант
через внутренний HTTP-запрос к backend.

Для прямой отправки уведомлений из backend в бот — см. notification_service.py в backend.
Backend обращается к Telegram Bot API напрямую через httpx.
"""
import asyncio
import logging
import os

import aiohttp
from aiogram import Bot, Router
from aiogram.enums import ParseMode
from dotenv import load_dotenv

load_dotenv()

router = Router()
logger = logging.getLogger(__name__)

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")
BOT_TOKEN = os.getenv("BOT_TOKEN")


async def poll_and_send_notifications(bot: Bot):
    """
    Фоновая задача: каждые 10 секунд запрашивает у backend
    несколько уведомлений и отправляет их пользователям.
    """
    async with aiohttp.ClientSession() as session:
        while True:
            try:
                async with session.get(
                    f"{BACKEND_URL}/internal/notifications/pending",
                    headers={"X-Internal-Token": os.getenv("SECRET_KEY", "")},
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as resp:
                    if resp.status == 200:
                        notifications = await resp.json()
                        for notif in notifications:
                            try:
                                await bot.send_message(
                                    chat_id=notif["user_id"],
                                    text=notif["message"],
                                    parse_mode=ParseMode.HTML
                                )
                                # Помечаем уведомление как отправленное
                                await session.post(
                                    f"{BACKEND_URL}/internal/notifications/{notif['id']}/sent",
                                    headers={"X-Internal-Token": os.getenv("SECRET_KEY", "")}
                                )
                            except Exception as e:
                                logger.warning(f"Failed to send notification {notif['id']}: {e}")
            except Exception as e:
                logger.error(f"Notification poll error: {e}")

            await asyncio.sleep(10)
