from pydantic import BaseModel, ConfigDict, Field


class SizeOptionRead(BaseModel):
    """Вариант размера"""
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="ID размера", examples=[1])
    code: str = Field(..., description="Код размера", examples=["M", "42"])


class ItemTypeRead(BaseModel):
    """Тип снаряжения"""
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="ID типа снаряжения", examples=[1])
    code: str = Field(..., description="Код типа", examples=["skate"])
    name: str = Field(..., description="Название", examples=["Коньки"])
    is_required: bool = Field(..., description="Обязательно ли для категории", examples=[True])
    size_options: list[SizeOptionRead] = Field(..., description="Список доступных размеров")


class CategoryRead(BaseModel):
    """Категория проката"""
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(..., description="ID категории", examples=[1])
    code: str = Field(..., description="Код категории", examples=["skates"])
    name: str = Field(..., description="Название категории", examples=["Коньки"])