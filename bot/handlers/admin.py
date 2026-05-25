"""
Админ-команды для бота. Доступны только пользователю с ADMIN_USER_ID.

Список команд:
  /token                       — получить JWT для Swagger
  /player <id>                 — полная инфа об игроке
  /setcoins <id> <сумма>       — установить монеты
  /setiron <id> <сумма>        — установить железо
  /setcrystals <id> <сумма>    — установить кристаллы
  /setcastle <id> <уровень>    — установить уровень замка (1-20)
  /setshield <id> <часы>       — поставить щит на N часов (0 = снять)
  /resetcd <id>                — сбросить кулдауны игрока
  /givepet <id> <тип> <ред.>   — выдать питомца (wolf/raven/bear/phoenix, common/rare/epic/legendary)
  /removepet <pet_id>          — удалить питомца по ID
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


def _is_admin(message: Message) -> bool:
    return message.from_user is not None and message.from_user.id == ADMIN_USER_ID


async def _get_token() -> str:
    """Получить JWT-токен администратора через internal endpoint."""
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{BACKEND_URL}/internal/token/{ADMIN_USER_ID}",
            headers={"X-Internal-Token": os.getenv("SECRET_KEY", "")},
            timeout=aiohttp.ClientTimeout(total=5),
        ) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Token endpoint returned {resp.status}")
            data = await resp.json()
            return data["access_token"]


async def _admin_request(method: str, path: str, **kwargs):
    """Выполнить запрос к /admin/* с JWT администратора."""
    token = await _get_token()
    async with aiohttp.ClientSession() as session:
        req = getattr(session, method)
        async with req(
            f"{BACKEND_URL}{path}",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=aiohttp.ClientTimeout(total=10),
            **kwargs,
        ) as resp:
            text = await resp.text()
            if resp.status >= 400:
                raise RuntimeError(f"HTTP {resp.status}: {text}")
            return await resp.json() if text.strip() else {}


def _args(message: Message, expected_count: int, usage: str):
    """Распарсить аргументы команды. Вернуть список или None (+ отправить подсказку)."""
    parts = (message.text or "").split()
    args = parts[1:]
    if len(args) < expected_count:
        return None, f"❌ Использование: {usage}"
    return args, None


# ─────────────────────────────────────────────────────────────────────────────
# /token
# ─────────────────────────────────────────────────────────────────────────────

@router.message(Command("token"))
async def cmd_token(message: Message):
    if not _is_admin(message):
        return
    try:
        token = await _get_token()
        await message.answer(
            f"🔑 <b>Твой JWT-токен для Swagger:</b>\n\n"
            f"<code>Bearer {token}</code>\n\n"
            f"📋 Вставь в <b>Authorize 🔓</b> на:\n"
            f"<code>https://tg-warriors-production.up.railway.app/docs</code>",
            parse_mode="HTML",
        )
    except Exception as e:
        logger.error(f"Token fetch error: {e}")
        await message.answer(f"❌ Не удалось получить токен: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /player <id>
# ─────────────────────────────────────────────────────────────────────────────

@router.message(Command("player"))
async def cmd_player(message: Message):
    if not _is_admin(message):
        return
    args, err = _args(message, 1, "/player <id>")
    if err:
        await message.answer(err)
        return
    try:
        p = await _admin_request("get", f"/admin/player/{args[0]}")
        shield = p.get("shield_until") or "нет"
        pets = p.get("pets", [])
        pets_text = "\n".join(
            f"  • [{pet['id']}] {pet['name']} ({pet['pet_type']}, {pet['rarity']}, Lv{pet['level']})"
            for pet in pets
        ) or "  нет питомцев"
        await message.answer(
            f"👤 <b>{p['name']}</b> (ID: <code>{p['id']}</code>)\n"
            f"🪙 Монеты: <b>{p['coins']}</b>\n"
            f"⚙️ Железо: <b>{p['iron']}</b>\n"
            f"💎 Кристаллы: <b>{p['crystals']}</b>\n"
            f"🏰 Замок: <b>{p['castle_level']}</b>\n"
            f"⚡ Энергия: <b>{p['energy']}</b>\n"
            f"🏆 Побед: <b>{p['win_streak']}</b>\n"
            f"⚔️ Юнитов: <b>{p['units_count']}</b>\n"
            f"🛡 Щит до: <b>{shield}</b>\n"
            f"🐾 Питомцы:\n{pets_text}",
            parse_mode="HTML",
        )
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /setcoins <id> <сумма>
# ─────────────────────────────────────────────────────────────────────────────

@router.message(Command("setcoins"))
async def cmd_setcoins(message: Message):
    if not _is_admin(message):
        return
    args, err = _args(message, 2, "/setcoins <id> <сумма>")
    if err:
        await message.answer(err)
        return
    try:
        r = await _admin_request("post", "/admin/set-coins", json={"target_id": int(args[0]), "coins": int(args[1])})
        await message.answer(f"✅ Монеты игрока {args[0]}: {r['old_coins']} → {r['new_coins']}")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /setiron <id> <сумма>
# ─────────────────────────────────────────────────────────────────────────────

@router.message(Command("setiron"))
async def cmd_setiron(message: Message):
    if not _is_admin(message):
        return
    args, err = _args(message, 2, "/setiron <id> <сумма>")
    if err:
        await message.answer(err)
        return
    try:
        await _admin_request("post", "/admin/set-iron", json={"target_id": int(args[0]), "iron": int(args[1])})
        await message.answer(f"✅ Железо игрока {args[0]} установлено: {args[1]}")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /setcrystals <id> <сумма>
# ─────────────────────────────────────────────────────────────────────────────

@router.message(Command("setcrystals"))
async def cmd_setcrystals(message: Message):
    if not _is_admin(message):
        return
    args, err = _args(message, 2, "/setcrystals <id> <сумма>")
    if err:
        await message.answer(err)
        return
    try:
        await _admin_request("post", "/admin/set-crystals", json={"target_id": int(args[0]), "crystals": int(args[1])})
        await message.answer(f"✅ Кристаллы игрока {args[0]} установлены: {args[1]}")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /setcastle <id> <уровень>
# ─────────────────────────────────────────────────────────────────────────────

@router.message(Command("setcastle"))
async def cmd_setcastle(message: Message):
    if not _is_admin(message):
        return
    args, err = _args(message, 2, "/setcastle <id> <уровень 1-20>")
    if err:
        await message.answer(err)
        return
    try:
        r = await _admin_request("post", "/admin/set-castle", json={"target_id": int(args[0]), "castle_level": int(args[1])})
        await message.answer(f"✅ Замок игрока {args[0]}: Lv{r['old_level']} → Lv{r['new_level']}")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /setshield <id> <часы>   (0 = снять щит)
# ─────────────────────────────────────────────────────────────────────────────

@router.message(Command("setshield"))
async def cmd_setshield(message: Message):
    if not _is_admin(message):
        return
    args, err = _args(message, 2, "/setshield <id> <часы> (0 = снять)")
    if err:
        await message.answer(err)
        return
    try:
        r = await _admin_request("post", "/admin/set-shield", json={"target_id": int(args[0]), "hours": float(args[1])})
        await message.answer(f"✅ {r['message']} для игрока {args[0]}")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /resetcd <id>
# ─────────────────────────────────────────────────────────────────────────────

@router.message(Command("resetcd"))
async def cmd_resetcd(message: Message):
    if not _is_admin(message):
        return
    args, err = _args(message, 1, "/resetcd <id>")
    if err:
        await message.answer(err)
        return
    try:
        await _admin_request("post", f"/admin/reset-cooldowns/{args[0]}")
        await message.answer(f"✅ Кулдауны игрока {args[0]} сброшены, энергия восстановлена")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /givepet <id> <тип> <редкость>
# ─────────────────────────────────────────────────────────────────────────────

@router.message(Command("givepet"))
async def cmd_givepet(message: Message):
    if not _is_admin(message):
        return
    args, err = _args(message, 3, "/givepet <id> <wolf|raven|bear|phoenix> <common|rare|epic|legendary>")
    if err:
        await message.answer(err)
        return
    try:
        r = await _admin_request("post", "/admin/give-pet", json={
            "target_id": int(args[0]),
            "pet_type": args[1].lower(),
            "rarity": args[2].lower(),
        })
        await message.answer(
            f"✅ Питомец выдан игроку {args[0]}\n"
            f"Тип: {r['pet_type']} · Редкость: {r['rarity']} · ID питомца: {r['pet_id']}"
        )
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# /removepet <pet_id>
# ─────────────────────────────────────────────────────────────────────────────

@router.message(Command("removepet"))
async def cmd_removepet(message: Message):
    if not _is_admin(message):
        return
    args, err = _args(message, 1, "/removepet <pet_id>")
    if err:
        await message.answer(err)
        return
    try:
        await _admin_request("delete", f"/admin/pet/{args[0]}")
        await message.answer(f"✅ Питомец #{args[0]} удалён")
    except Exception as e:
        await message.answer(f"❌ Ошибка: {e}")
