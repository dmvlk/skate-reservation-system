from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers.deps import get_current_admin
from app.schemas.auth import AdminRead, LoginRequest, TokenResponse
from app.services.auth import authenticate_admin
from app.utils.jwt import create_access_token


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/login", 
    response_model=TokenResponse,
    summary="Вход для администратора",
    description="Авторизует администратора и возвращает JWT-токен. Токен нужно передавать в заголовке `Authorization: Bearer <token>`."
)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    admin = authenticate_admin(db, payload.username, payload.password)
    token = create_access_token(admin.username)

    parts = [admin.last_name, admin.first_name, admin.middle_name]
    full_name = " ".join(p for p in parts if p)

    return TokenResponse(
        access_token=token,
        username=admin.username,
        full_name=full_name,
    )


@router.get(
    "/me", 
    response_model=AdminRead,
    summary="Профиль администратора",
    description="Возвращает данные текущего администратора (требуется авторизация)."
)
def me(admin=Depends(get_current_admin)):
    return admin
