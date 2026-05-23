import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UnitOut(BaseModel):
    id: uuid.UUID
    owner_id: int
    name: str
    unit_type: str = "warrior"
    level: int
    power: int
    defense: int
    is_for_sale: bool
    sale_price: Optional[int]
    created_at: datetime

    model_config = {"from_attributes": True}


class BuyUnitRequest(BaseModel):
    pass  # покупка стандартного юнита, без параметров


class UpgradeUnitRequest(BaseModel):
    unit_id: uuid.UUID


class SellUnitRequest(BaseModel):
    unit_id: uuid.UUID
    price: int
