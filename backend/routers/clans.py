from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import User
from models.clan import Clan, ClanMember
from routers.deps import get_current_user
from services import clan_service

router = APIRouter(prefix="/clans", tags=["clans"])


class CreateClanRequest(BaseModel):
    name: str
    description: Optional[str] = None
    emblem: Optional[str] = "⚔️"


class JoinClanRequest(BaseModel):
    clan_id: int


class ClanMemberOut(BaseModel):
    user_id: int
    role: str
    contribution: int
    joined_at: str

    model_config = {"from_attributes": True}


class ClanOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    emblem: str
    leader_id: int
    total_power: int
    wins: int
    losses: int
    members_count: int

    model_config = {"from_attributes": True}


def _clan_out(clan: Clan) -> ClanOut:
    return ClanOut(
        id=clan.id, name=clan.name, description=clan.description,
        emblem=clan.emblem, leader_id=clan.leader_id,
        total_power=clan.total_power, wins=clan.wins, losses=clan.losses,
        members_count=len(clan.members)
    )


@router.get("", response_model=list[ClanOut])
async def list_clans(
    _: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Топ кланов по силе."""
    clans = await clan_service.get_clan_list(db)
    return [_clan_out(c) for c in clans]


@router.get("/my", response_model=Optional[ClanOut])
async def my_clan(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Мой клан (None если не состою)."""
    clan = await clan_service.get_my_clan(db, current_user)
    return _clan_out(clan) if clan else None


@router.post("/create", response_model=ClanOut)
async def create_clan(
    body: CreateClanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать клан (замок 3+, стоит 500 монет)."""
    clan = await clan_service.create_clan(db, current_user, body.name, body.description or "", body.emblem or "⚔️")
    return _clan_out(clan)


@router.post("/join")
async def join_clan(
    body: JoinClanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Вступить в клан (замок 3+)."""
    await clan_service.join_clan(db, current_user, body.clan_id)
    return {"ok": True, "message": "Ты вступил в клан!"}


@router.post("/leave")
async def leave_clan(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Выйти из клана."""
    return await clan_service.leave_clan(db, current_user)
