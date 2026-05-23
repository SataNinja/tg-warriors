from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Integer, String, DateTime, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base

if TYPE_CHECKING:
    from models.user import User


class Weapon(Base):
    __tablename__ = "weapons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), unique=True)

    name: Mapped[str] = mapped_column(String(64), default="Железный меч")
    rarity: Mapped[str] = mapped_column(String(16), default="common")   # common/rare/epic/legendary
    level: Mapped[int] = mapped_column(Integer, default=1)
    attack_bonus: Mapped[int] = mapped_column(Integer, default=5)       # Плоский бонус к силе

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship("User", back_populates="weapon")
