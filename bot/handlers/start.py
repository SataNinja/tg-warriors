import os
from aiogram import Router
from aiogram.filters import CommandStart
from aiogram.types import Message

from keyboards.inline import get_main_keyboard

router = Router()

MINI_APP_URL = os.getenv("MINI_APP_URL", "https://example.com")


@router.message(CommandStart())
async def cmd_start(message: Message):
    """
    Обработчик /start.
    Если в deep link есть реферальный код — он будет вида /start ref_<user_id>.
    """
    args = message.text.split()
    ref_code = None
    if len(args) > 1 and args[1].startswith("ref_"):
        ref_code = args[1][4:]  # извлекаем id реферера

    user = message.from_user
    text = (
        f"👋 Привет, <b>{user.first_name}</b>!\n\n"
        f"⚔️ <b>TG Warriors</b> — социальная экономическая игра.\n\n"
        f"🏹 Нанимай юнитов, прокачивай их, совершай рейды на других игроков "
        f"и защищай свои ресурсы щитом.\n\n"
        f"👇 Нажми <b>Играть</b>, чтобы открыть игру:"
    )

    # Передаём реферальный код через startapp параметр Mini App
    app_url = f"{MINI_APP_URL}?startapp=ref_{user.id}"
    if ref_code:
        app_url = f"{MINI_APP_URL}?startapp=ref_{ref_code}"

    await message.answer(text, reply_markup=get_main_keyboard(app_url))
