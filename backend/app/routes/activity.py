from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.core.mongo import get_recent_activity
from app.models.models import User

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("")
def list_activity(current_user: User = Depends(get_current_user)):
    return get_recent_activity(str(current_user.id))
