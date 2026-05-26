from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import BigInteger, Integer, String, DateTime, Text, func, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from models.user import User


class Clan(Base):
    __tablename__ = "clans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(32), unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    leader_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    emblem: Mapped[str] = mapped_column(String(8), default="⚔️")

    # Статистика
    total_power: Mapped[int] = mapped_column(Integer, default=0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)

    # Война: 0=нет, 1=подготовка, 2=идёт война
    war_stage: Mapped[int] = mapped_column(Integer, default=0)
    war_prepared_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    current_war_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Казна и предметы войны
    treasury: Mapped[int] = mapped_column(Integer, default=0)
    war_buff_attack: Mapped[bool] = mapped_column(Boolean, default=False)
    war_buff_defense: Mapped[bool] = mapped_column(Boolean, default=False)
    war_buff_artifact: Mapped[bool] = mapped_column(Boolean, default=False)
    war_buff_provisions: Mapped[bool] = mapped_column(Boolean, default=False)
    max_members: Mapped[int] = mapped_column(Integer, default=10)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    members: Mapped[list["ClanMember"]] = relationship("ClanMember", back_populates="clan", lazy="selectin")


class ClanMember(Base):
    __tablename__ = "clan_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clan_id: Mapped[int] = mapped_column(Integer, ForeignKey("clans.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    role: Mapped[str] = mapped_column(String(16), default="member")   # leader / officer / member
    rank: Mapped[str] = mapped_column(String(32), default="Новобранец")
    contribution: Mapped[int] = mapped_column(Integer, default=0)

    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    clan: Mapped["Clan"] = relationship("Clan", back_populates="members")


class ClanWar(Base):
    """Клановая война (2 дня, по 2 битвы в день на пару)."""
    __tablename__ = "clan_wars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clan_a_id: Mapped[int] = mapped_column(Integer, ForeignKey("clans.id"))
    clan_b_id: Mapped[int] = mapped_column(Integer, ForeignKey("clans.id"))

    stage: Mapped[int] = mapped_column(Integer, default=1)
    stage_1_score_a: Mapped[int] = mapped_column(Integer, default=0)
    stage_2_score_a: Mapped[int] = mapped_column(Integer, default=0)
    stage_3_score_a: Mapped[int] = mapped_column(Integer, default=0)
    stage_1_score_b: Mapped[int] = mapped_column(Integer, default=0)
    stage_2_score_b: Mapped[int] = mapped_column(Integer, default=0)
    stage_3_score_b: Mapped[int] = mapped_column(Integer, default=0)

    winner_clan_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_finished: Mapped[bool] = mapped_column(Boolean, default=False)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    battles: Mapped[list["ClanWarBattle"]] = relationship(
        "ClanWarBattle", back_populates="war", lazy="selectin"
    )


class ClanWarParticipant(Base):
    """Статус участия игрока в надвигающейся войне клана."""
    __tablename__ = "clan_war_participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clan_id: Mapped[int] = mapped_column(Integer, ForeignKey("clans.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))
    is_participating: Mapped[bool] = mapped_column(Boolean, default=True)
    set_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClanWarBattle(Base):
    """Одна 1v1 мини-игра в рамках клановой войны."""
    __tablename__ = "clan_war_battles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    war_id: Mapped[int] = mapped_column(Integer, ForeignKey("clan_wars.id", ondelete="CASCADE"))
    player_a_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    player_b_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    game_type: Mapped[str] = mapped_column(String(32))    # reaction / math / memory / aim
    day: Mapped[int] = mapped_column(Integer)             # 1 или 2
    battle_num: Mapped[int] = mapped_column(Integer)      # 1 или 2 в рамках дня
    score_a: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    score_b: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    winner_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    played_at_a: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    played_at_b: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    war: Mapped["ClanWar"] = relationship("ClanWar", back_populates="battles")
