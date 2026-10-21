from datetime import date
from pydantic import BaseModel, Field


class AvailabilityResponse(BaseModel):
    category: str
    days: list["DayAvailability"]


class DayAvailability(BaseModel):
    date: date
    available_hours: list[int] = Field(
        description="Список свободных часов. Остальные - заняты."
    )


AvailabilityResponse.model_rebuild()