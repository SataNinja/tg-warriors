from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.game import RaidRequest, RaidResult
from services.game_service import do_raid

router = APIRouter(prefix="/raid", tags=["raid"])


@router.post("", response_model=RaidResult)
async def raid_player(
    body: RaidRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Совершить рейд на другого игрока.
    Успех определяется сравнением суммарной силы юнитов.
    Кулдаун между рейдами: 1 час.
    """
    return await do_raid(db, current_user, body.target_user_id)
