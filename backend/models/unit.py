import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))

    name: Mapped[str] = mapped_column(String(64), default="Warrior")
    unit_type: Mapped[str] = mapped_column(String(32), default="warrior")
    level: Mapped[int] = mapped_column(Integer, default=1)
    power: Mapped[int] = mapped_column(Integer, default=10)   # влияет на урон в рейде
    defense: Mapped[int] = mapped_column(Integer, default=5)  # влияет на защиту при рейде

    is_for_sale: Mapped[bool] = mapped_column(Boolean, default=False)
    sale_price: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner: Mapped["User"] = relationship("User", back_populates="units")
