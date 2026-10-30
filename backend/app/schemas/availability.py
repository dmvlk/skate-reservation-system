from datetime import date as date_type
from pydantic import BaseModel, Field


class AvailabilityResponse(BaseModel):
    """Результат проверки свободных часов."""
    category: str = Field(..., description="Категория проката", examples=["skates"])
    days: list[DayAvailability] = Field(..., description="Список дней с информацией о свободных часах")
class DayAvailability(BaseModel):
    """Доступность проката на конкретный день."""
    date: date_type = Field(..., description="Дата", examples=["2026-10-31"])
    available_hours: list[int] = Field(
        ..., 
        description="Список свободных часов (от 10 до 19). Если часа нет в списке — он занят.", 
        examples=[[10, 11, 12, 15, 16]]
    )


AvailabilityResponse.model_rebuild()