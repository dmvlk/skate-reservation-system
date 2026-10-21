from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Admin
from app.utils.security import verify_password


def authenticate_admin(db: Session, username: str, password: str) -> Admin:
    admin = db.execute(
        select(Admin).where(Admin.username == username)
    ).scalar_one_or_none()

    if admin is None:
        raise HTTPException(401, "Неверный логин или пароль")

    if not verify_password(password, admin.password_hash):
        raise HTTPException(401, "Неверный логин или пароль")

    return admin
