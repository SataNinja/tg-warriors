from pydantic import BaseModel


class TelegramAuthRequest(BaseModel):
    init_data: str          # сырая строка initData из Telegram.WebApp.initData
    referrer_id: int | None = None  # опциональный реферальный код


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
