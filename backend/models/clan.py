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
    emblem: Mapped[str] = mapped_column(String(8), default="⚔️")  # эмодзи герба

    # Статистика
    total_power: Mapped[int] = mapped_column(Integer, default=0)
    wins: Mapped[int] = mapped_column(Integer, default=0)
    losses: Mapped[int] = mapped_column(Integer, default=0)

    # Клановая война
    war_stage: Mapped[int] = mapped_column(Integer, default=0)   # 0=нет войны, 1-3=этап

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    members: Mapped[list["ClanMember"]] = relationship("ClanMember", back_populates="clan", lazy="selectin")


class ClanMember(Base):
    __tablename__ = "clan_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clan_id: Mapped[int] = mapped_column(Integer, ForeignKey("clans.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    role: Mapped[str] = mapped_column(String(16), default="member")  # leader / officer / member
    contribution: Mapped[int] = mapped_column(Integer, default=0)    # монеты вклада

    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    clan: Mapped["Clan"] = relationship("Clan", back_populates="members")


class ClanWar(Base):
    """Заготовка для клановых войн (3 этапа)."""
    __tablename__ = "clan_wars"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clan_a_id: Mapped[int] = mapped_column(Integer, ForeignKey("clans.id"))
    clan_b_id: Mapped[int] = mapped_column(Integer, ForeignKey("clans.id"))

    # Этапы: 1=разведка (разведчики), 2=осада (атака замка), 3=финал (лидеры)
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
