from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Integer, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)  # Telegram user_id
    username: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str] = mapped_column(String(128))
    last_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    nickname: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    coins: Mapped[int] = mapped_column(BigInteger, default=100)

    # Энергия: макс 50, каждые 6 минут +1 (полный реген за 5 часов)
    energy: Mapped[int] = mapped_column(Integer, default=50)
    energy_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    shield_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_daily_reward: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    daily_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_raid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    referrer_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # Замок и прогрессия
    castle_level: Mapped[int] = mapped_column(Integer, default=1)
    win_streak: Mapped[int] = mapped_column(Integer, default=0)
    iron: Mapped[int] = mapped_column(Integer, default=10)       # стартуют с 10 железа
    crystals: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    units: Mapped[list["Unit"]] = relationship("Unit", back_populates="owner", lazy="selectin")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="user", lazy="noload")
    notifications: Mapped[list["Notification"]] = relationship("Notification", back_populates="user", lazy="noload")
    weapon: Mapped[Optional["Weapon"]] = relationship("Weapon", back_populates="owner", uselist=False, lazy="selectin")
    pets: Mapped[list["Pet"]] = relationship("Pet", back_populates="owner", lazy="selectin")
