from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.unit import UnitOut, BuyUnitRequest, UpgradeUnitRequest
from services.game_service import buy_unit, upgrade_unit
from services.shop_service import get_available_unit_types

router = APIRouter(prefix="/unit", tags=["unit"])


@router.get("/types")
async def get_unit_types(
    current_user: User = Depends(get_current_user),
):
    """Список типов юнитов, доступных для покупки на текущем уровне замка."""
    return get_available_unit_types(current_user.castle_level)


@router.post("/buy", response_model=UnitOut)
async def buy_unit_route(
    body: BuyUnitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Купить юнита выбранного типа за монеты."""
    return await buy_unit(db, current_user, body.unit_type)


@router.post("/upgrade", response_model=UnitOut)
async def upgrade_unit_route(
    body: UpgradeUnitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Прокачать существующего юнита."""
    return await upgrade_unit(db, current_user, body.unit_id)
