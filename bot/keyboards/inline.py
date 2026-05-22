from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo


def get_main_keyboard(app_url: str) -> InlineKeyboardMarkup:
    """Главная клавиатура с кнопкой открытия Mini App."""
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(
                text="⚔️ Играть",
                web_app=WebAppInfo(url=app_url)
            )
        ],
        [
            InlineKeyboardButton(
                text="📊 Таблица лидеров",
                callback_data="leaderboard"
            )
        ]
    ])
