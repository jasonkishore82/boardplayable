from fastapi import APIRouter, Depends

from ..auth import User, current_user

router = APIRouter(prefix="/v1", tags=["account"])


@router.get("/me")
def me(user: User = Depends(current_user)) -> dict[str, str | None]:
    return {"id": user.id, "email": user.email, "username": user.username}
