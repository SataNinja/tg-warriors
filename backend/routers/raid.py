from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.game import RaidRequest, RaidResult, PveRaidResult
from services.game_service import do_raid, do_pve_raid

router = APIRouter(prefix="/raid", tags=["raid"])


@router.post("", response_model=RaidResult)
async def raid_player(
    body: RaidRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """PvP рейд на другого игрока по его Telegram ID."""
    return await do_raid(db, current_user, body.target_user_id)


@router.post("/pve", response_model=PveRaidResult)
async def raid_pve(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """PvE бой с ботом. Сила противника ±30% от твоей."""
    return await do_pve_raid(db, current_user)
