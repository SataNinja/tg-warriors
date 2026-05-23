from datetime import datetime

from sqlalchemy import BigInteger, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Egg(Base):
    """Яйцо питомца — вылупляется через заданное время."""
    __tablename__ = "eggs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"))

    egg_type: Mapped[str] = mapped_column(String(16))   # common / rare / elite
    pet_type: Mapped[str] = mapped_column(String(32))   # заранее определённый тип питомца

    hatches_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))  # когда готово
    is_hatched: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
