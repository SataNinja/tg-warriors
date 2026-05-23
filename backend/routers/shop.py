from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.shop import (
    CastleInfo, CastleUpgradeResult,
    WeaponInfo, WeaponBuyResult, WeaponUpgradeResult,
    BuyEggRequest, BuyEggResult, FoodItem,
)
from services import shop_service

router = APIRouter(prefix="/shop", tags=["shop"])


# ── Замок ─────────────────────────────────────────────────────────────────────
@router.get("/castle", response_model=CastleInfo)
async def castle_info(current_user: User = Depends(get_current_user)):
    return await shop_service.get_castle_info(current_user)


@router.post("/castle/upgrade", response_model=CastleUpgradeResult)
async def castle_upgrade(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shop_service.upgrade_castle(db, current_user)


# ── Оружие ────────────────────────────────────────────────────────────────────
@router.get("/weapon", response_model=WeaponInfo)
async def weapon_info(current_user: User = Depends(get_current_user)):
    return shop_service.get_weapon_info(current_user)


@router.post("/weapon/buy", response_model=WeaponBuyResult)
async def weapon_buy(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shop_service.buy_weapon(db, current_user)


@router.post("/weapon/upgrade", response_model=WeaponUpgradeResult)
async def weapon_upgrade(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shop_service.upgrade_weapon(db, current_user)


# ── Питомцы — яйца ───────────────────────────────────────────────────────────
@router.post("/egg/buy", response_model=BuyEggResult)
async def buy_egg(
    body: BuyEggRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await shop_service.buy_egg(db, current_user, body.egg_type)


# ── Еда для питомцев ─────────────────────────────────────────────────────────
@router.get("/food", response_model=list[FoodItem])
async def food_list():
    """Список доступной еды для питомцев."""
    return shop_service.get_food_list()
