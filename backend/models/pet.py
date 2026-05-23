from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import BigInteger, Integer, String, DateTime, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from models.user import User


class Pet(Base):
    __tablename__ = "pets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))

    name: Mapped[str] = mapped_column(String(64))
    pet_type: Mapped[str] = mapped_column(String(16))   # wolf / raven / bear / phoenix
    rarity: Mapped[str] = mapped_column(String(16), default="common")
    level: Mapped[int] = mapped_column(Integer, default=1)

    power_bonus: Mapped[int] = mapped_column(Integer, default=0)  # Плоский бонус к силе
    gold_bonus: Mapped[int] = mapped_column(Integer, default=0)   # % бонус к монетам

    # Энергия питомца (макс 20, тратится 5 за бой, реген +1 за 10 минут)
    energy: Mapped[int] = mapped_column(Integer, default=20)
    energy_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_battle_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Голод питомца (0-100, убывает -1 каждые 20 минут)
    hunger: Mapped[int] = mapped_column(Integer, default=100)
    hunger_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped["User"] = relationship("User", back_populates="pets")
