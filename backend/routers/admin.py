"""
Админ-роутер для @SataNinjaKOT (ID: 6320200740).
Доступ только через JWT администратора — обычные эндпоинты, но с проверкой admin_id.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from core.config import settings
from core.database import get_db
from models.user import User
from models.pet import Pet
from routers.deps import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.id != settings.ADMIN_USER_ID:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Нет прав администратора")
    return current_user


# ── Запросы ───────────────────────────────────────────────────────────────────
class SetCoinsRequest(BaseModel):
    target_id: int
    coins: int

class SetCastleRequest(BaseModel):
    target_id: int
    castle_level: int

class SetIronRequest(BaseModel):
    target_id: int
    iron: int

class SetCrystalsRequest(BaseModel):
    target_id: int
    crystals: int

class SetShieldRequest(BaseModel):
    target_id: int
    hours: float  # 0 = снять щит, >0 = поставить на N часов

class GivePetRequest(BaseModel):
    target_id: int
    pet_type: str   # wolf / raven / bear / phoenix
    rarity: str     # common / rare / epic / legendary

class PetInfoItem(BaseModel):
    id: int
    name: str
    pet_type: str
    rarity: str
    level: int
    power_bonus: int
    gold_bonus: int

class PlayerInfoResponse(BaseModel):
    id: int
    name: str
    coins: int
    iron: int
    crystals: int
    castle_level: int
    win_streak: int
    energy: int
    units_count: int
    shield_until: Optional[str]   # ISO строка или null
    pets: List[PetInfoItem]

class PlayerListItem(BaseModel):
    id: int
    name: str
    coins: int
    castle_level: int


async def _get_target(db: AsyncSession, target_id: int) -> User:
    result = await db.execute(select(User).where(User.id == target_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Игрок {target_id} не найден")
    return user


# ── Эндпоинты ────────────────────────────────────────────────────────────────

@router.get("/players", response_model=List[PlayerListItem])
async def search_players(
    search: str = Query("", description="ID или часть имени"),
    limit: int = Query(20, le=50),
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Поиск игроков по ID или нику."""
    q = select(User).limit(limit)
    if search.strip():
        # Попробуем как числовой ID
        if search.strip().isdigit():
            q = q.where(User.id == int(search.strip()))
        else:
            pattern = f"%{search.strip()}%"
            q = q.where(or_(
                User.nickname.ilike(pattern),
                User.first_name.ilike(pattern),
            ))
    else:
        q = q.order_by(User.coins.desc())
    result = await db.execute(q)
    users = result.scalars().all()
    return [
        PlayerListItem(
            id=u.id,
            name=u.nickname or u.first_name,
            coins=u.coins,
            castle_level=u.castle_level,
        )
        for u in users
    ]


@router.get("/player/{target_id}", response_model=PlayerInfoResponse)
async def get_player_info(
    target_id: int,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Получить полную инфу об игроке."""
    u = await _get_target(db, target_id)
    pets_result = await db.execute(select(Pet).where(Pet.owner_id == target_id))
    pets = pets_result.scalars().all()
    shield_str = u.shield_until.isoformat() if u.shield_until else None
    return PlayerInfoResponse(
        id=u.id, name=u.nickname or u.first_name,
        coins=u.coins, iron=u.iron, crystals=getattr(u, 'crystals', 0),
        castle_level=u.castle_level, win_streak=u.win_streak,
        energy=u.energy, units_count=len(u.units),
        shield_until=shield_str,
        pets=[
            PetInfoItem(
                id=p.id, name=p.name, pet_type=p.pet_type,
                rarity=p.rarity, level=p.level,
                power_bonus=p.power_bonus, gold_bonus=p.gold_bonus,
            )
            for p in pets
        ],
    )


@router.post("/set-coins")
async def set_coins(
    body: SetCoinsRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Установить количество монет игроку."""
    u = await _get_target(db, body.target_id)
    old = u.coins
    u.coins = body.coins
    await db.commit()
    return {"ok": True, "target": body.target_id, "old_coins": old, "new_coins": body.coins}


@router.post("/set-castle")
async def set_castle(
    body: SetCastleRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Установить уровень замка игроку."""
    if not 1 <= body.castle_level <= 20:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Уровень замка 1-20")
    u = await _get_target(db, body.target_id)
    old = u.castle_level
    u.castle_level = body.castle_level
    await db.commit()
    return {"ok": True, "target": body.target_id, "old_level": old, "new_level": body.castle_level}


@router.post("/set-iron")
async def set_iron(
    body: SetIronRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    u = await _get_target(db, body.target_id)
    u.iron = body.iron
    await db.commit()
    return {"ok": True, "target": body.target_id, "iron": body.iron}


@router.post("/set-crystals")
async def set_crystals(
    body: SetCrystalsRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    u = await _get_target(db, body.target_id)
    u.crystals = body.crystals
    await db.commit()
    return {"ok": True, "target": body.target_id, "crystals": body.crystals}


@router.post("/set-shield")
async def set_shield(
    body: SetShieldRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Поставить или снять щит. hours=0 — снять."""
    u = await _get_target(db, body.target_id)
    if body.hours <= 0:
        u.shield_until = None
        msg = "Щит снят"
    else:
        u.shield_until = datetime.now(timezone.utc) + timedelta(hours=body.hours)
        msg = f"Щит поставлен на {body.hours}ч"
    await db.commit()
    return {"ok": True, "target": body.target_id, "message": msg, "shield_until": u.shield_until}


@router.post("/give-pet")
async def give_pet(
    body: GivePetRequest,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Выдать питомца игроку."""
    await _get_target(db, body.target_id)  # проверяем что игрок есть
    valid_types = {"wolf", "raven", "bear", "phoenix"}
    valid_rarities = {"common", "rare", "epic", "legendary"}
    if body.pet_type not in valid_types:
        raise HTTPException(400, f"Неверный тип питомца. Допустимы: {valid_types}")
    if body.rarity not in valid_rarities:
        raise HTTPException(400, f"Неверная редкость. Допустимы: {valid_rarities}")

    PET_NAMES = {"wolf": "Волк", "raven": "Ворон", "bear": "Медведь", "phoenix": "Феникс"}
    RARITY_BONUS = {"common": (0, 0), "rare": (5, 5), "epic": (10, 10), "legendary": (20, 15)}
    power_b, gold_b = RARITY_BONUS[body.rarity]

    pet = Pet(
        owner_id=body.target_id,
        name=PET_NAMES.get(body.pet_type, body.pet_type.capitalize()),
        pet_type=body.pet_type,
        rarity=body.rarity,
        level=1,
        power_bonus=power_b,
        gold_bonus=gold_b,
    )
    db.add(pet)
    await db.commit()
    await db.refresh(pet)
    return {"ok": True, "pet_id": pet.id, "target": body.target_id, "pet_type": body.pet_type, "rarity": body.rarity}


@router.delete("/pet/{pet_id}")
async def remove_pet(
    pet_id: int,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Удалить питомца по ID."""
    result = await db.execute(select(Pet).where(Pet.id == pet_id))
    pet = result.scalar_one_or_none()
    if not pet:
        raise HTTPException(404, f"Питомец {pet_id} не найден")
    await db.delete(pet)
    await db.commit()
    return {"ok": True, "deleted_pet_id": pet_id}


@router.post("/reset-cooldowns")
async def reset_cooldowns(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Сброс всех кулдаунов для самого администратора."""
    admin.last_raid_at = None
    admin.last_daily_reward = None
    admin.energy = 50
    await db.commit()
    return {"ok": True, "message": "Кулдауны сброшены, энергия восстановлена"}


@router.post("/reset-cooldowns/{target_id}")
async def reset_target_cooldowns(
    target_id: int,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Сброс кулдаунов для любого игрока."""
    u = await _get_target(db, target_id)
    u.last_raid_at = None
    u.last_daily_reward = None
    u.energy = 50
    await db.commit()
    return {"ok": True, "target": target_id, "message": "Кулдауны сброшены"}
