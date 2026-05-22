"""
Проверка Telegram WebApp initData согласно официальной документации:
https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""
import hashlib
import hmac
import json
from typing import Optional
from urllib.parse import parse_qsl, unquote

from core.config import settings


def validate_telegram_init_data(init_data: str) -> Optional[dict]:
    """
    Валидирует строку initData из Telegram WebApp.

    Алгоритм:
    1. Разбираем строку как query string
    2. Извлекаем и убираем поле hash
    3. Сортируем оставшиеся поля по ключу (A-Z)
    4. Создаём data_check_string = join('\\n', 'key=value' pairs)
    5. secret_key = HMAC-SHA256('WebAppData', bot_token)
    6. hash = HMAC-SHA256(secret_key, data_check_string).hexdigest()
    7. Сравниваем с исходным hash (constant-time)

    Возвращает dict с полями initData (включая user как dict) или None если невалидно.
    """
    try:
        params = dict(parse_qsl(init_data, keep_blank_values=True))

        received_hash = params.pop("hash", None)
        if not received_hash:
            return None

        data_check_string = "\n".join(
            f"{k}={v}" for k, v in sorted(params.items())
        )

        secret_key = hmac.new(
            b"WebAppData",
            settings.BOT_TOKEN.encode("utf-8"),
            hashlib.sha256
        ).digest()

        expected_hash = hmac.new(
            secret_key,
            data_check_string.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(expected_hash, received_hash):
            return None

        # Парсим вложенный JSON поля user
        if "user" in params:
            params["user"] = json.loads(unquote(params["user"]))

        return params

    except Exception:
        return None
