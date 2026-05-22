from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.user import User
from routers.deps import get_current_user
from schemas.game import ReferralClaimResult
from services.game_service import claim_referral_rewards

router = APIRouter(prefix="/referral", tags=["referral"])


@router.post("/claim", response_model=ReferralClaimResult)
async def claim_referrals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Забрать награды за приглашённых рефералов."""
    return await claim_referral_rewards(db, current_user)
