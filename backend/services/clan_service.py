from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.clan import Clan, ClanMember
from models.user import User
from models.transaction import Transaction

MIN_CASTLE_LEVEL = 3    # минимальный уровень замка для вступления в клан
CLAN_CREATE_COST = 500  # монет за создание клана
MAX_CLAN_MEMBERS = 30


async def create_clan(db: AsyncSession, user: User, name: str, description: str, emblem: str) -> Clan:
    if user.castle_level < MIN_CASTLE_LEVEL:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Нужен уровень замка {MIN_CASTLE_LEVEL}+. У тебя: {user.castle_level}")

    # Проверяем, не состоит ли уже в клане
    existing = await db.execute(select(ClanMember).where(ClanMember.user_id == user.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ты уже состоишь в клане")

    if user.coins < CLAN_CREATE_COST:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Нужно {CLAN_CREATE_COST} монет для создания клана")

    # Проверяем уникальность имени
    name_check = await db.execute(select(Clan).where(Clan.name == name))
    if name_check.scalar_one_or_none():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Клан с таким названием уже существует")

    user.coins -= CLAN_CREATE_COST
    db.add(Transaction(user_id=user.id, amount=-CLAN_CREATE_COST, type="clan",
                       description=f"Создание клана {name}"))

    clan = Clan(name=name, description=description, leader_id=user.id, emblem=emblem or "⚔️")
    db.add(clan)
    await db.flush()

    member = ClanMember(clan_id=clan.id, user_id=user.id, role="leader")
    db.add(member)
    await db.commit()
    await db.refresh(clan)
    return clan


async def join_clan(db: AsyncSession, user: User, clan_id: int) -> ClanMember:
    if user.castle_level < MIN_CASTLE_LEVEL:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Нужен уровень замка {MIN_CASTLE_LEVEL}+ для вступления")

    existing = await db.execute(select(ClanMember).where(ClanMember.user_id == user.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ты уже в клане")

    clan_result = await db.execute(select(Clan).where(Clan.id == clan_id))
    clan = clan_result.scalar_one_or_none()
    if not clan:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Клан не найден")

    if len(clan.members) >= MAX_CLAN_MEMBERS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Клан заполнен (макс. 30 игроков)")

    member = ClanMember(clan_id=clan_id, user_id=user.id, role="member")
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


async def leave_clan(db: AsyncSession, user: User) -> dict:
    result = await db.execute(select(ClanMember).where(ClanMember.user_id == user.id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ты не состоишь в клане")

    if member.role == "leader":
        # Если лидер уходит и есть другие — передаём роль офицеру/первому участнику
        clan_result = await db.execute(select(Clan).where(Clan.id == member.clan_id))
        clan = clan_result.scalar_one_or_none()
        other_members = [m for m in clan.members if m.user_id != user.id]
        if not other_members:
            # Последний участник — удаляем клан
            await db.delete(clan)
        else:
            new_leader = next((m for m in other_members if m.role == "officer"), other_members[0])
            new_leader.role = "leader"
            clan.leader_id = new_leader.user_id

    await db.delete(member)
    await db.commit()
    return {"ok": True, "message": "Ты вышел из клана"}


async def get_clan_list(db: AsyncSession, limit: int = 20) -> list[Clan]:
    result = await db.execute(select(Clan).order_by(Clan.total_power.desc()).limit(limit))
    return list(result.scalars().all())


async def get_my_clan(db: AsyncSession, user: User):
    result = await db.execute(select(ClanMember).where(ClanMember.user_id == user.id))
    member = result.scalar_one_or_none()
    if not member:
        return None
    clan_result = await db.execute(select(Clan).where(Clan.id == member.clan_id))
    return clan_result.scalar_one_or_none()
