from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.game import RaidRequest, RaidResult, PveRaidResult, BattleEntry
from services.game_service import do_raid, do_pve_raid, get_battle_journal

router = APIRouter(prefix="/raid", tags=["raid"])


@router.post("", response_model=RaidResult)
async def raid_player(
    body: RaidRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """PvP рейд на игрока по ID. Без кулдауна."""
    return await do_raid(db, current_user, body.target_user_id)


@router.post("/pve", response_model=PveRaidResult)
async def raid_pve(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """PvE бой с ботом. Без кулдауна."""
    return await do_pve_raid(db, current_user)


@router.get("/journal", response_model=list[BattleEntry])
async def battle_journal(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Журнал последних 30 боёв игрока."""
    return await get_battle_journal(db, current_user)
