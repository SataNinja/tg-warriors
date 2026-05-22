from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.game import ShieldResult
from services.game_service import activate_shield

router = APIRouter(prefix="/shield", tags=["shield"])


@router.post("", response_model=ShieldResult)
async def buy_shield(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Активировать щит на 8 часов за монеты."""
    return await activate_shield(db, current_user)
