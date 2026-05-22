import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Integer, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Raid(Base):
    __tablename__ = "raids"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attacker_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))
    defender_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"))

    attacker_power: Mapped[int] = mapped_column(Integer, default=0)
    defender_power: Mapped[int] = mapped_column(Integer, default=0)

    success: Mapped[bool] = mapped_column(Boolean, default=False)
    coins_stolen: Mapped[int] = mapped_column(BigInteger, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
