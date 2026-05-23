from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.shop import (
    PetOut, PetBattleRequest, PetBattleResult,
    EggOut, HatchEggResult, FeedPetRequest, FeedPetResult, ReleasePetResult,
)
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


@router.post("/{pet_id}/release", response_model=ReleasePetResult)
async def release_pet(
    pet_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await pet_service.release_pet(db, current_user, pet_id)
    return ReleasePetResult(**result)


@router.post("/{pet_id}/feed", response_model=FeedPetResult)
async def feed_pet(
    pet_id: int,
    body: FeedPetRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await pet_service.feed_pet(db, current_user, pet_id, body.food_type)


# ── Яйца ─────────────────────────────────────────────────────────────────────
@router.get("/eggs", response_model=list[EggOut])
async def list_eggs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await pet_service.list_user_eggs(db, current_user)


@router.post("/eggs/{egg_id}/hatch", response_model=HatchEggResult)
async def hatch_egg(
    egg_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await pet_service.hatch_egg(db, current_user, egg_id)
