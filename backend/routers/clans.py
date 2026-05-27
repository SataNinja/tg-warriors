"""
Клановая система.
Создание клана, вступление, просмотр участников, клановая казна,
подготовка к войне, система рангов, клановые войны (мини-игры 1v1).
"""
import random
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, or_, func

from core.database import get_db
from models.user import User
from models.clan import Clan, ClanMember, ClanWar, ClanWarParticipant, ClanWarBattle
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
    item_type: str

class SetParticipationRequest(BaseModel):
    participating: bool

class SetRoleRequest(BaseModel):
    user_id: int
    role: str
    rank: Optional[str] = None

class SubmitScoreRequest(BaseModel):
    score: int = Field(..., ge=0)

class UpdateClanRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=32)
    description: Optional[str] = Field(None, max_length=256)
    emblem: Optional[str] = Field(None, max_length=8)

class MemberInfo(BaseModel):
    user_id: int
    name: str
    role: str
    rank: str
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
    war_buff_attack: bool
    war_buff_defense: bool
    war_buff_artifact: bool
    war_buff_provisions: bool
    war_stage: int
    war_prepared_at: Optional[str]

class ClanListItem(BaseModel):
    id: int
    name: str
    emblem: str
    members_count: int
    total_power: int
    wins: int
    war_stage: int

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

GAME_TYPES = ["reaction", "math", "memory", "aim"]
WAR_DURATION_DAYS = 2   # максимальная длительность войны

# ── Вспомогательные ──────────────────────────────────────────────────────────

async def _get_membership(db: AsyncSession, user_id: int) -> Optional[ClanMember]:
    r = await db.execute(select(ClanMember).where(ClanMember.user_id == user_id))
    return r.scalar_one_or_none()

async def _try_finish_war(db: AsyncSession, war: ClanWar) -> bool:
    """
    Проверяет, нужно ли завершить войну.
    Условия: все битвы сыграны ИЛИ истекло 2 дня с начала войны.
    Возвращает True если война была завершена.
    """
    if war.is_finished:
        return False

    now = datetime.now(timezone.utc)
    time_expired = (now - war.started_at).total_seconds() >= WAR_DURATION_DAYS * 86400
    all_played = all(
        b.score_a is not None and b.score_b is not None
        for b in war.battles
    )

    if not (all_played or time_expired):
        return False

    # Считаем победы по кланам
    clan_a_r = await db.execute(select(ClanMember.user_id).where(ClanMember.clan_id == war.clan_a_id))
    clan_a_set = set(clan_a_r.scalars().all())
    score_a = sum(1 for b in war.battles if b.winner_id and b.winner_id in clan_a_set)
    score_b = sum(1 for b in war.battles if b.winner_id and b.winner_id not in clan_a_set)

    war.is_finished = True
    war.finished_at = now
    if score_a > score_b:
        war.winner_clan_id = war.clan_a_id
    elif score_b > score_a:
        war.winner_clan_id = war.clan_b_id
    # иначе ничья, winner_clan_id = None

    def _reset_clan(c: Clan, won: bool):
        c.war_stage = 0
        # current_war_id намеренно НЕ сбрасываем — чтобы фронт мог показать итоги войны
        c.war_prepared_at = None
        c.war_buff_attack = False
        c.war_buff_defense = False
        c.war_buff_artifact = False
        c.war_buff_provisions = False
        if won:
            c.wins += 1
        else:
            c.losses += 1

    clan_a_obj_r = await db.execute(select(Clan).where(Clan.id == war.clan_a_id))
    clan_a_obj = clan_a_obj_r.scalar_one_or_none()
    clan_b_obj_r = await db.execute(select(Clan).where(Clan.id == war.clan_b_id))
    clan_b_obj = clan_b_obj_r.scalar_one_or_none()

    if clan_a_obj:
        _reset_clan(clan_a_obj, war.winner_clan_id == war.clan_a_id)
    if clan_b_obj:
        _reset_clan(clan_b_obj, war.winner_clan_id == war.clan_b_id)

    await db.commit()
    return True


async def _get_clan(db: AsyncSession, clan_id: int) -> Clan:
    r = await db.execute(select(Clan).where(Clan.id == clan_id))
    clan = r.scalar_one_or_none()
    if not clan:
        raise HTTPException(404, "Клан не найден")
    return clan

async def _clan_to_info(db: AsyncSession, clan: Clan) -> ClanInfo:
    user_ids = [m.user_id for m in clan.members]
    users_map: dict[int, str] = {}
    if user_ids:
        users_r = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: (u.nickname or u.first_name) for u in users_r.scalars().all()}
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
                name=users_map.get(m.user_id, str(m.user_id)),
                role=m.role,
                rank=getattr(m, "rank", "Новобранец"),
                contribution=m.contribution,
            )
            for m in sorted(clan.members, key=lambda x: x.contribution, reverse=True)
        ],
        war_buff_attack=clan.war_buff_attack,
        war_buff_defense=clan.war_buff_defense,
        war_buff_artifact=clan.war_buff_artifact,
        war_buff_provisions=clan.war_buff_provisions,
        war_stage=clan.war_stage,
        war_prepared_at=clan.war_prepared_at.isoformat() if clan.war_prepared_at else None,
    )

# ── Базовые эндпоинты ────────────────────────────────────────────────────────

@router.get("", response_model=List[ClanListItem])
async def list_clans(db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    result = await db.execute(select(Clan).order_by(Clan.total_power.desc()).limit(20))
    clans = result.scalars().all()
    return [
        ClanListItem(
            id=c.id, name=c.name, emblem=c.emblem,
            members_count=len(c.members), total_power=c.total_power,
            wins=c.wins, war_stage=c.war_stage,
        )
        for c in clans
    ]

@router.get("/my", response_model=Optional[ClanInfo])
async def my_clan(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await _get_membership(db, user.id)
    if not membership:
        return None
    clan = await _get_clan(db, membership.clan_id)
    return await _clan_to_info(db, clan)

@router.get("/war/items")
async def list_war_items(_: User = Depends(get_current_user)):
    return [{"type": k, "name": v["name"], "cost": v["cost"], "desc": v["desc"]} for k, v in WAR_ITEMS.items()]

@router.get("/{clan_id}", response_model=ClanInfo)
async def get_clan(clan_id: int, db: AsyncSession = Depends(get_db), _: User = Depends(get_current_user)):
    clan = await _get_clan(db, clan_id)
    return await _clan_to_info(db, clan)

@router.post("/create", response_model=ClanInfo)
async def create_clan(body: CreateClanRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    CLAN_CREATE_COST = 500
    if await _get_membership(db, user.id):
        raise HTTPException(400, "Ты уже состоишь в клане.")
    if user.coins < CLAN_CREATE_COST:
        raise HTTPException(400, f"Нужно {CLAN_CREATE_COST} монет.")
    if (await db.execute(select(Clan).where(Clan.name == body.name))).scalar_one_or_none():
        raise HTTPException(400, "Клан с таким именем уже существует.")
    user.coins -= CLAN_CREATE_COST
    clan = Clan(name=body.name, description=body.description, leader_id=user.id, emblem=body.emblem)
    db.add(clan)
    await db.flush()
    db.add(ClanMember(clan_id=clan.id, user_id=user.id, role="leader", rank="Лидер"))
    await db.commit()
    await db.refresh(clan)
    return await _clan_to_info(db, clan)

@router.post("/{clan_id}/join")
async def join_clan(clan_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if await _get_membership(db, user.id):
        raise HTTPException(400, "Ты уже состоишь в клане.")
    clan = await _get_clan(db, clan_id)
    if len(clan.members) >= clan.max_members:
        raise HTTPException(400, f"Клан заполнен.")
    db.add(ClanMember(clan_id=clan.id, user_id=user.id, role="member", rank="Новобранец"))
    await db.commit()
    return {"ok": True, "message": f"Добро пожаловать в клан «{clan.name}»!"}

@router.post("/leave")
async def leave_clan(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await _get_membership(db, user.id)
    if not membership:
        raise HTTPException(400, "Ты не состоишь в клане.")
    clan = await _get_clan(db, membership.clan_id)
    if membership.role == "leader" and len(clan.members) > 1:
        raise HTTPException(400, "Лидер не может покинуть клан, пока есть участники. Сначала исключи всех или назначь нового лидера.")
    clan_name = clan.name
    if membership.role == "leader":
        # Удаляем войны клана (FK без CASCADE — удаляем вручную)
        await db.execute(delete(ClanWar).where(
            or_(ClanWar.clan_a_id == clan.id, ClanWar.clan_b_id == clan.id)
        ))
        await db.delete(clan)  # CASCADE удалит всех участников и ClanWarParticipant
    else:
        await db.delete(membership)
    await db.commit()
    return {"ok": True, "message": f"Ты покинул клан «{clan_name}»."}

@router.post("/delete")
async def delete_clan(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Лидер удаляет весь клан (для всех участников)."""
    membership = await _get_membership(db, user.id)
    if not membership or membership.role != "leader":
        raise HTTPException(403, "Только лидер может удалить клан.")
    clan = await _get_clan(db, membership.clan_id)
    clan_name = clan.name
    await db.execute(delete(ClanWar).where(
        or_(ClanWar.clan_a_id == clan.id, ClanWar.clan_b_id == clan.id)
    ))
    await db.delete(clan)
    await db.commit()
    return {"ok": True, "message": f"Клан «{clan_name}» удалён."}

@router.post("/update")
async def update_clan(body: UpdateClanRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Лидер редактирует название, описание или эмблему клана."""
    membership = await _get_membership(db, user.id)
    if not membership or membership.role != "leader":
        raise HTTPException(403, "Только лидер может редактировать клан.")
    clan = await _get_clan(db, membership.clan_id)
    if body.name and body.name != clan.name:
        existing = await db.execute(select(Clan).where(Clan.name == body.name))
        if existing.scalar_one_or_none():
            raise HTTPException(400, "Клан с таким именем уже существует.")
        clan.name = body.name
    if body.description is not None:
        clan.description = body.description
    if body.emblem:
        clan.emblem = body.emblem
    await db.commit()
    await db.refresh(clan)
    return {"ok": True, "message": "✅ Информация о клане обновлена."}

@router.post("/contribute")
async def contribute_to_clan(body: ContributeRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
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
    return {"ok": True, "donated": body.amount, "treasury": clan.treasury, "my_contribution": membership.contribution}

@router.post("/war/buy-item")
async def buy_war_item(body: BuyWarItemRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await _get_membership(db, user.id)
    if not membership or membership.role != "leader":
        raise HTTPException(403, "Только лидер клана может покупать предметы войны.")
    item = WAR_ITEMS.get(body.item_type)
    if not item:
        raise HTTPException(400, f"Неизвестный предмет.")
    clan = await _get_clan(db, membership.clan_id)
    field = item["field"]
    if getattr(clan, field):
        raise HTTPException(400, f"«{item['name']}» уже куплен.")
    if clan.treasury < item["cost"]:
        raise HTTPException(400, f"Нужно {item['cost']} в казне. Сейчас: {clan.treasury}.")
    clan.treasury -= item["cost"]
    setattr(clan, field, True)
    if body.item_type == "provisions":
        member_ids = [m.user_id for m in clan.members]
        users_r = await db.execute(select(User).where(User.id.in_(member_ids)))
        for u in users_r.scalars().all():
            u.energy = min(50, u.energy + 20)
    await db.commit()
    return {"ok": True, "item": item["name"], "treasury_left": clan.treasury,
            "message": f"✅ Куплен «{item['name']}»! {item['desc']}"}

# ── Ранги участников ─────────────────────────────────────────────────────────

@router.post("/members/set-role")
async def set_member_role(body: SetRoleRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await _get_membership(db, user.id)
    if not membership or membership.role not in ("leader", "officer"):
        raise HTTPException(403, "Только лидер или офицер может изменять роли.")
    r = await db.execute(
        select(ClanMember).where(ClanMember.user_id == body.user_id, ClanMember.clan_id == membership.clan_id)
    )
    target = r.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "Участник не найден.")
    if target.user_id == user.id:
        raise HTTPException(400, "Нельзя изменить свою роль.")
    if target.role == "leader":
        raise HTTPException(400, "Нельзя изменить роль лидера.")
    if membership.role == "officer" and body.role == "officer":
        raise HTTPException(403, "Только лидер может назначать офицеров.")
    if body.role not in ("officer", "member"):
        raise HTTPException(400, "Доступные роли: officer, member")
    target.role = body.role
    if body.rank:
        target.rank = body.rank
    await db.commit()
    return {"ok": True, "message": "Обновлено."}

# ── Война кланов ─────────────────────────────────────────────────────────────

@router.post("/war/prepare")
async def prepare_for_war(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await _get_membership(db, user.id)
    if not membership or membership.role != "leader":
        raise HTTPException(403, "Только лидер клана может начать подготовку.")
    clan = await _get_clan(db, membership.clan_id)
    if clan.war_stage != 0:
        raise HTTPException(400, "Клан уже в состоянии подготовки или войны.")
    clan.war_stage = 1
    clan.war_prepared_at = datetime.now(timezone.utc)
    clan.current_war_id = None  # сбрасываем ссылку на прошлую войну
    await db.execute(delete(ClanWarParticipant).where(ClanWarParticipant.clan_id == clan.id))
    await db.commit()
    return {"ok": True, "message": "⚔️ Подготовка начата! Участники могут подтвердить участие в течение суток."}

@router.post("/war/participate")
async def set_war_participation(body: SetParticipationRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await _get_membership(db, user.id)
    if not membership:
        raise HTTPException(400, "Ты не состоишь в клане.")
    clan = await _get_clan(db, membership.clan_id)
    if clan.war_stage != 1:
        raise HTTPException(400, "Клан не в стадии подготовки.")
    r = await db.execute(
        select(ClanWarParticipant).where(ClanWarParticipant.clan_id == clan.id, ClanWarParticipant.user_id == user.id)
    )
    participant = r.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if participant:
        participant.is_participating = body.participating
        participant.set_at = now
    else:
        db.add(ClanWarParticipant(clan_id=clan.id, user_id=user.id, is_participating=body.participating))
    await db.commit()
    status = "участвую ✅" if body.participating else "не участвую ❌"
    return {"ok": True, "message": f"Статус: {status}"}

@router.get("/war/participants")
async def get_war_participants(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await _get_membership(db, user.id)
    if not membership:
        raise HTTPException(400, "Ты не состоишь в клане.")
    clan = await _get_clan(db, membership.clan_id)
    r = await db.execute(select(ClanWarParticipant).where(ClanWarParticipant.clan_id == clan.id))
    rows = r.scalars().all()
    user_ids = [p.user_id for p in rows]
    users_map: dict[int, str] = {}
    if user_ids:
        ur = await db.execute(select(User).where(User.id.in_(user_ids)))
        users_map = {u.id: (u.nickname or u.first_name) for u in ur.scalars().all()}
    return [{"user_id": p.user_id, "name": users_map.get(p.user_id, str(p.user_id)), "is_participating": p.is_participating} for p in rows]

@router.post("/war/start")
async def start_clan_war(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await _get_membership(db, user.id)
    if not membership or membership.role != "leader":
        raise HTTPException(403, "Только лидер клана может начать войну.")
    clan = await _get_clan(db, membership.clan_id)
    if clan.war_stage != 1:
        raise HTTPException(400, "Сначала нажми «Подготовиться к войне».")

    r_p = await db.execute(
        select(ClanWarParticipant).where(ClanWarParticipant.clan_id == clan.id, ClanWarParticipant.is_participating == True)
    )
    my_participants = [p.user_id for p in r_p.scalars().all()]
    if not my_participants:
        my_participants = [m.user_id for m in clan.members]

    r_opp = await db.execute(
        select(Clan).where(Clan.id != clan.id, Clan.war_stage == 1)
        .order_by(func.abs(Clan.total_power - clan.total_power)).limit(5)
    )
    candidates = r_opp.scalars().all()
    opponent = candidates[0] if candidates else None
    if not opponent:
        raise HTTPException(400, "Нет кланов, готовых к войне. Подожди — другие лидеры тоже нажмут «Подготовиться».")

    r_op = await db.execute(
        select(ClanWarParticipant).where(ClanWarParticipant.clan_id == opponent.id, ClanWarParticipant.is_participating == True)
    )
    their_participants = [p.user_id for p in r_op.scalars().all()]
    if not their_participants:
        their_participants = [m.user_id for m in opponent.members]

    now = datetime.now(timezone.utc)
    war = ClanWar(clan_a_id=clan.id, clan_b_id=opponent.id, started_at=now)
    db.add(war)
    await db.flush()

    clan.war_stage = 2
    clan.current_war_id = war.id
    opponent.war_stage = 2
    opponent.current_war_id = war.id

    a, b = list(my_participants), list(their_participants)
    random.shuffle(a); random.shuffle(b)
    pairs = list(zip(a, b))

    for pa, pb in pairs:
        for day in (1, 2):
            for battle_num in (1, 2):
                db.add(ClanWarBattle(
                    war_id=war.id, player_a_id=pa, player_b_id=pb,
                    game_type=random.choice(GAME_TYPES),
                    day=day, battle_num=battle_num,
                    expires_at=now + timedelta(days=day + 1),
                ))

    await db.commit()
    return {
        "ok": True, "war_id": war.id,
        "opponent_clan": opponent.name, "pairs_count": len(pairs),
        "message": f"⚔️ Война против «{opponent.name}» началась! {len(pairs)} пар(ы) сформировано.",
    }

@router.get("/war/status")
async def get_war_status(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    membership = await _get_membership(db, user.id)
    if not membership:
        raise HTTPException(400, "Ты не состоишь в клане.")
    clan = await _get_clan(db, membership.clan_id)

    r_p = await db.execute(select(ClanWarParticipant).where(ClanWarParticipant.clan_id == clan.id))
    part_rows = r_p.scalars().all()
    p_ids = [p.user_id for p in part_rows]
    p_map: dict[int, str] = {}
    if p_ids:
        ur = await db.execute(select(User).where(User.id.in_(p_ids)))
        p_map = {u.id: (u.nickname or u.first_name) for u in ur.scalars().all()}
    participants_out = [
        {"user_id": p.user_id, "name": p_map.get(p.user_id, str(p.user_id)), "is_participating": p.is_participating}
        for p in part_rows
    ]
    my_participation = next((p.is_participating for p in part_rows if p.user_id == user.id), None)

    if clan.current_war_id is None:
        return {
            "war_id": None, "war_stage": clan.war_stage,
            "opponent_clan": None, "my_clan_score": 0, "opponent_clan_score": 0,
            "battles": [], "participants": participants_out, "is_finished": False,
            "war_prepared_at": clan.war_prepared_at.isoformat() if clan.war_prepared_at else None,
            "my_participation": my_participation,
            "war_expires_at": None, "winner_clan_id": None,
        }

    war_r = await db.execute(select(ClanWar).where(ClanWar.id == clan.current_war_id))
    war = war_r.scalar_one_or_none()
    if not war:
        return {"war_id": None, "war_stage": 0, "opponent_clan": None, "my_clan_score": 0,
                "opponent_clan_score": 0, "battles": [], "participants": [], "is_finished": False,
                "war_prepared_at": None, "my_participation": None,
                "war_expires_at": None, "winner_clan_id": None}

    # Проверяем авто-завершение: по таймауту или если все битвы сыграны
    await _try_finish_war(db, war)
    await db.refresh(war)  # обновляем поля после возможного commit

    opp_clan_id = war.clan_b_id if war.clan_a_id == clan.id else war.clan_a_id
    opp_r = await db.execute(select(Clan).where(Clan.id == opp_clan_id))
    opp_clan = opp_r.scalar_one_or_none()

    b_r = await db.execute(
        select(ClanWarBattle).where(
            ClanWarBattle.war_id == war.id,
            or_(ClanWarBattle.player_a_id == user.id, ClanWarBattle.player_b_id == user.id),
        )
    )
    my_battles = b_r.scalars().all()
    opp_uids = {(b.player_b_id if b.player_a_id == user.id else b.player_a_id) for b in my_battles}
    opp_u_map: dict[int, str] = {}
    if opp_uids:
        ou = await db.execute(select(User).where(User.id.in_(opp_uids)))
        opp_u_map = {u.id: (u.nickname or u.first_name) for u in ou.scalars().all()}

    battles_out = []
    for b in sorted(my_battles, key=lambda x: (x.day, x.battle_num)):
        is_a = b.player_a_id == user.id
        opp_uid = b.player_b_id if is_a else b.player_a_id
        battles_out.append({
            "id": b.id, "opponent_id": opp_uid,
            "opponent_name": opp_u_map.get(opp_uid, str(opp_uid)),
            "game_type": b.game_type, "day": b.day, "battle_num": b.battle_num,
            "my_score": b.score_a if is_a else b.score_b,
            "opponent_score": b.score_b if is_a else b.score_a,
            "winner_id": b.winner_id,
            "expires_at": b.expires_at.isoformat(),
            "played_by_me": (b.score_a if is_a else b.score_b) is not None,
        })

    all_b_r = await db.execute(select(ClanWarBattle).where(ClanWarBattle.war_id == war.id))
    all_battles = all_b_r.scalars().all()
    clan_a_r = await db.execute(select(ClanMember.user_id).where(ClanMember.clan_id == war.clan_a_id))
    clan_a_set = set(clan_a_r.scalars().all())
    score_a = sum(1 for b in all_battles if b.winner_id and b.winner_id in clan_a_set)
    score_b = sum(1 for b in all_battles if b.winner_id and b.winner_id not in clan_a_set)
    my_score = score_a if clan.id == war.clan_a_id else score_b
    opp_score = score_b if clan.id == war.clan_a_id else score_a

    return {
        "war_id": war.id, "war_stage": clan.war_stage,
        "opponent_clan": {
            "id": opp_clan.id, "name": opp_clan.name,
            "emblem": opp_clan.emblem, "total_power": opp_clan.total_power,
        } if opp_clan else None,
        "my_clan_score": my_score, "opponent_clan_score": opp_score,
        "battles": battles_out, "participants": participants_out,
        "is_finished": war.is_finished,
        "war_prepared_at": clan.war_prepared_at.isoformat() if clan.war_prepared_at else None,
        "my_participation": my_participation,
        "war_expires_at": (war.started_at + timedelta(days=WAR_DURATION_DAYS)).isoformat(),
        "winner_clan_id": war.winner_clan_id,
    }

@router.post("/war/battle/{battle_id}/submit")
async def submit_battle_score(battle_id: int, body: SubmitScoreRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(ClanWarBattle).where(
            ClanWarBattle.id == battle_id,
            or_(ClanWarBattle.player_a_id == user.id, ClanWarBattle.player_b_id == user.id),
        )
    )
    battle = r.scalar_one_or_none()
    if not battle:
        raise HTTPException(404, "Битва не найдена.")
    now = datetime.now(timezone.utc)
    if now > battle.expires_at:
        raise HTTPException(400, "Время этой битвы истекло.")
    is_a = battle.player_a_id == user.id
    if is_a and battle.score_a is not None:
        raise HTTPException(400, "Ты уже сыграл в эту битву.")
    if not is_a and battle.score_b is not None:
        raise HTTPException(400, "Ты уже сыграл в эту битву.")
    if is_a:
        battle.score_a = body.score; battle.played_at_a = now
    else:
        battle.score_b = body.score; battle.played_at_b = now
    both_played = battle.score_a is not None and battle.score_b is not None
    if both_played:
        if battle.score_a > battle.score_b:
            battle.winner_id = battle.player_a_id
        elif battle.score_b > battle.score_a:
            battle.winner_id = battle.player_b_id
    await db.commit()

    # Проверяем авто-завершение войны после каждой сыгранной битвы
    war_r2 = await db.execute(select(ClanWar).where(ClanWar.id == battle.war_id))
    war_obj = war_r2.scalar_one_or_none()
    if war_obj:
        await _try_finish_war(db, war_obj)

    return {
        "ok": True, "my_score": body.score,
        "winner_id": battle.winner_id,
        "both_played": both_played,
        "message": "✅ Результат записан!",
    }
