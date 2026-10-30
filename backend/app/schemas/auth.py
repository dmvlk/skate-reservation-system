from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Данные для входа администратора"""
    username: str = Field(..., min_length=1, max_length=50, description="Логин", examples=["admin"])
    password: str = Field(..., min_length=1, max_length=100, description="Пароль", examples=["admin123"])

class TokenResponse(BaseModel):
    """Ответ с jwt"""
    access_token: str = Field(..., description="JWT-токен для авторизации", examples=["eyJhbGciOiJIUzI1NiIs..."])
    token_type: str = Field("bearer", description="Тип токена", examples=["bearer"])
    username: str = Field(..., description="Логин администратора", examples=["admin"])
    full_name: str = Field(..., description="ФИО администратора", examples=["Админов Админ Админович"])

class AdminRead(BaseModel):
    """Профиль администратора"""
    id: int = Field(..., description="ID администратора", examples=[1])
    username: str = Field(..., description="Логин", examples=["admin"])
    last_name: str = Field(..., description="Фамилия", examples=["Админов"])
    first_name: str = Field(..., description="Имя", examples=["Админ"])
    middle_name: str | None = Field(..., description="Отчество", examples=["Админович"])

    @property
    def full_name(self) -> str:
        parts = [self.last_name, self.first_name, self.middle_name]
        return " ".join(p for p in parts if p)

    class Config:
        from_attributes = True
