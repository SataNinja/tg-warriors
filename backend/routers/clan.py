"""
Клановая система.
Создание клана, вступление, просмотр участников, клановая казна, подготовка к войне.
"""
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db
from models.user import User
from models.clan import Clan, ClanMember
from routers.deps import get_current_user

router = APIRouter(prefix="/clans", tags=["clans"])

# ── Схемы ─────────────────────────────────────────────────────────────────────

class CreateClanRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=32)
    description: Optional[str] = Field(None, max_length=256)
    emblem: str = Field("⚔️", max_length=8)

class ContributeRequest(BaseModel):
    amount: int = Field(..., ge=10, le=100_000)

class BuyWarItemRequest(BaseModel):
    item_type: str   # attack / defense / artifact / provisions

class MemberInfo(BaseModel):
    user_id: int
    name: str
    role: str
    contribution: int

class ClanInfo(BaseModel):
    id: int
    name: str
    description: Optional[str]
    emblem: str
    leader_id: int
    total_power: int
    wins: int
    losses: int
    treasury: int
    members_count: int
    max_members: int
    members: List[MemberInfo]
    # Предметы подготовки к войне
    war_buff_attack: bool
    war_buff_defense: bool
    war_buff_artifact: bool
    war_buff_provisions: bool

class ClanListItem(BaseModel):
    id: int
    name: str
    emblem: str
    members_count: int
    total_power: int
    wins: int

# ── Предметы войны ────────────────────────────────────────────────────────────

WAR_ITEMS = {
    "attack": {
        "name": "⚔️ Клинок Войны",
        "cost": 500,
        "desc": "+20% к атаке в клановой войне",
        "field": "war_buff_attack",
    },
    "defense": {
        "name": "🛡 Стена Защиты",
        "cost": 400,
        "desc": "+20% к защите в клановой войне",
        "field": "war_buff_defense",
    },
    "artifact": {
        "name": "🔮 Магический Артефакт",
        "cost": 800,
        "desc": "+15% к атаке и защите в клановой войне",
        "field": "war_buff_artifact",
    },
    "provisions": {
        "name": "🍖 Провиант",
        "cost": 300,
        "desc": "Восстанавливает 20 энергии всем членам клана",
        "field": "war_buff_provisions",
    },
}

# ── Вспомогательные ──────────────────────────────────────────────────────────

async def _get_membership(db: AsyncSession, user_id: int) -> Optional[ClanMember]:
    r = await db.execute(select(ClanMember).where(ClanMember.user_id == user_id))
    return r.scalar_one_or_none()

async def _get_clan(db: AsyncSession, clan_id: int) -> Clan:
    r = await db.execute(select(Clan).where(Clan.id == clan_id))
    clan = r.scalar_one_or_none()
    if not clan:
        raise HTTPException(404, "Клан не найден")
    return clan

def _clan_to_info(clan: Clan) -> ClanInfo:
    return ClanInfo(
        id=clan.id,
        name=clan.name,
        description=clan.description,
        emblem=clan.emblem,
        leader_id=clan.leader_id,
        total_power=clan.total_power,
        wins=clan.wins,
        losses=clan.losses,
        treasury=clan.treasury,
        members_count=len(clan.members),
        max_members=clan.max_members,
        members=[
            MemberInfo(
                user_id=m.user_id,
                name=str(m.user_id),   # имя подставляем ниже в эндпоинте
                role=m.role,
                contribution=m.contribution,
            )
            for m in clan.members
        ],
        war_buff_attack=clan.war_buff_attack,
        war_buff_defense=clan.war_buff_defense,
        war_buff_artifact=clan.war_buff_artifact,
        war_buff_provisions=clan.war_buff_provisions,
    )

# ── Эндпоинты ────────────────────────────────────────────────────────────────

@router.get("", response_model=List[ClanListItem])
async def list_clans(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    """Список всех кланов (топ-20 по силе)."""
    result = await db.execute(select(Clan).order_by(Clan.total_power.desc()).limit(20))
    clans = result.scalars().all()
    return [
        ClanListItem(
            id=c.id, name=c.name, emblem=c.emblem,
            members_count=len(c.members), total_power=c.total_power, wins=c.wins,
        )
        for c in clans
    ]


@router.get("/my", response_model=Optional[ClanInfo])
async def my_clan(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Мой клан (null если не состою)."""
    membership = await _get_membership(db, user.id)
    if not membership:
        return None
    clan = await _get_clan(db, membership.clan_id)
    # Подставляем имена участников
    info = _clan_to_info(clan)
    # Загружаем имена пользователей
    user_ids = [m.user_id for m in clan.members]
    users_r = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: (u.nickname or u.first_name) for u in users_r.scalars().all()}
    for m in info.members:
        m.name = users_map.get(m.user_id, str(m.user_id))
    return info


@router.get("/{clan_id}", response_model=ClanInfo)
async def get_clan(
    clan_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    clan = await _get_clan(db, clan_id)
    info = _clan_to_info(clan)
    user_ids = [m.user_id for m in clan.members]
    users_r = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: (u.nickname or u.first_name) for u in users_r.scalars().all()}
    for m in info.members:
        m.name = users_map.get(m.user_id, str(m.user_id))
    return info


@router.post("/create", response_model=ClanInfo)
async def create_clan(
    body: CreateClanRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать клан. Стоит 500 монет. Создатель становится лидером."""
    CLAN_CREATE_COST = 500
    membership = await _get_membership(db, user.id)
    if membership:
        raise HTTPException(400, "Ты уже состоишь в клане. Сначала покинь его.")
    if user.coins < CLAN_CREATE_COST:
        raise HTTPException(400, f"Нужно {CLAN_CREATE_COST} монет для создания клана.")
    # Проверяем уникальность
    exists = await db.execute(select(Clan).where(Clan.name == body.name))
    if exists.scalar_one_or_none():
        raise HTTPException(400, "Клан с таким именем уже существует.")

    user.coins -= CLAN_CREATE_COST
    clan = Clan(
        name=body.name,
        description=body.description,
        leader_id=user.id,
        emblem=body.emblem,
    )
    db.add(clan)
    await db.flush()  # получаем clan.id

    member = ClanMember(clan_id=clan.id, user_id=user.id, role="leader")
    db.add(member)
    await db.commit()
    await db.refresh(clan)

    info = _clan_to_info(clan)
    for m in info.members:
        m.name = user.nickname or user.first_name
    return info


@router.post("/{clan_id}/join")
async def join_clan(
    clan_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Вступить в клан."""
    membership = await _get_membership(db, user.id)
    if membership:
        raise HTTPException(400, "Ты уже состоишь в клане. Сначала покинь его.")
    clan = await _get_clan(db, clan_id)
    if len(clan.members) >= clan.max_members:
        raise HTTPException(400, f"Клан заполнен ({clan.max_members}/{clan.max_members}).")

    member = ClanMember(clan_id=clan.id, user_id=user.id, role="member")
    db.add(member)
    await db.commit()
    return {"ok": True, "message": f"Добро пожаловать в клан «{clan.name}»!"}


@router.post("/leave")
async def leave_clan(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Покинуть клан. Лидер не может покинуть клан, пока в нём есть участники."""
    membership = await _get_membership(db, user.id)
    if not membership:
        raise HTTPException(400, "Ты не состоишь в клане.")
    clan = await _get_clan(db, membership.clan_id)

    if membership.role == "leader" and len(clan.members) > 1:
        raise HTTPException(400, "Лидер не может покинуть клан, пока в нём есть участники. "
                                 "Передай лидерство или кикни всех участников.")

    clan_name = clan.name
    await db.delete(membership)
    # Если лидер уходит и он один — удаляем клан
    if membership.role == "leader":
        await db.delete(clan)
    await db.commit()
    return {"ok": True, "message": f"Ты покинул клан «{clan_name}»."}


@router.post("/contribute")
async def contribute_to_clan(
    body: ContributeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Пожертвовать монеты в клановую казну."""
    membership = await _get_membership(db, user.id)
    if not membership:
        raise HTTPException(400, "Ты не состоишь в клане.")
    if user.coins < body.amount:
        raise HTTPException(400, f"Недостаточно монет. У тебя: {user.coins}.")
    clan = await _get_clan(db, membership.clan_id)

    user.coins -= body.amount
    clan.treasury += body.amount
    membership.contribution += body.amount
    await db.commit()
    return {
        "ok": True,
        "donated": body.amount,
        "treasury": clan.treasury,
        "my_contribution": membership.contribution,
    }


@router.post("/war/buy-item")
async def buy_war_item(
    body: BuyWarItemRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Купить предмет подготовки к войне из клановой казны. Только лидер."""
    membership = await _get_membership(db, user.id)
    if not membership or membership.role != "leader":
        raise HTTPException(403, "Только лидер клана может покупать предметы войны.")

    item = WAR_ITEMS.get(body.item_type)
    if not item:
        raise HTTPException(400, f"Неизвестный предмет. Доступны: {list(WAR_ITEMS)}")

    clan = await _get_clan(db, membership.clan_id)
    field = item["field"]

    if getattr(clan, field):
        raise HTTPException(400, f"«{item['name']}» уже куплен.")
    if clan.treasury < item["cost"]:
        raise HTTPException(400, f"Нужно {item['cost']} в казне. Сейчас: {clan.treasury}.")

    clan.treasury -= item["cost"]
    setattr(clan, field, True)

    # Провиант — восстанавливаем энергию всем участникам
    if body.item_type == "provisions":
        member_ids = [m.user_id for m in clan.members]
        users_r = await db.execute(select(User).where(User.id.in_(member_ids)))
        for u in users_r.scalars().all():
            u.energy = min(50, u.energy + 20)

    await db.commit()
    return {
        "ok": True,
        "item": item["name"],
        "treasury_left": clan.treasury,
        "message": f"✅ Куплен «{item['name']}»! {item['desc']}",
    }


@router.get("/war/items", tags=["clans"])
async def list_war_items(_: User = Depends(get_current_user)):
    """Список предметов подготовки к войне."""
    return [
        {"type": k, "name": v["name"], "cost": v["cost"], "desc": v["desc"]}
        for k, v in WAR_ITEMS.items()
    ]
