from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)  # Telegram user_id
    username: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    first_name: Mapped[str] = mapped_column(String(128))
    last_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    coins: Mapped[int] = mapped_column(BigInteger, default=100)
    shield_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_daily_reward: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_raid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    referrer_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    units: Mapped[list["Unit"]] = relationship("Unit", back_populates="owner", lazy="selectin")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="user", lazy="noload")
    notifications: Mapped[list["Notification"]] = relationship("Notification", back_populates="user", lazy="noload")
