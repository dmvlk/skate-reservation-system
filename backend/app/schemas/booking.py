from datetime import date
from pydantic import BaseModel, Field


class BookingCreate(BaseModel):
    category: str = Field(..., description="skates | skis | snowboard")

    # клиент
    phone: str = Field(..., min_length=10, max_length=20)
    last_name: str = Field(..., min_length=1, max_length=100)
    first_name: str = Field(..., min_length=1, max_length=100)
    middle_name: str | None = Field(None, max_length=100)

    booking_date: date
    hours: list[int] = Field(..., min_length=1, description="Часы начала проката")

    # для коньков
    size_value: int | None = None

    # для лыж и сноуборда
    size_bucket: str | None = None
    boot_size_value: int | None = None


class BookingRead(BaseModel):
    id: int
    phone_last4: str
    category: str
    booking_date: date
    hours: list[int]
    status: str
