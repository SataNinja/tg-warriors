from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.shop import PetOut, PetBattleRequest, PetBattleResult
from services import pet_service

router = APIRouter(prefix="/pets", tags=["pets"])


@router.get("", response_model=list[PetOut])
async def get_pets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await pet_service.get_user_pets(db, current_user)


@router.post("/battle", response_model=PetBattleResult)
async def pet_battle(
    body: PetBattleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await pet_service.do_pet_battle(db, current_user, body.pet_id)
