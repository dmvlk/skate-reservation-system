from datetime import date
from pydantic import BaseModel, Field


class MyBookingItem(BaseModel):
    item_type: str
    size: str | None


class MyBookingRead(BaseModel):
    id: int
    category: str
    booking_date: date
    hours: list[int]
    status: str
    items: list[MyBookingItem]


class CancelResponse(BaseModel):
    id: int
    status: str
    message: str


class PhoneLookup(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)

class ExtensionOptions(BaseModel):
    booking_id: int
    current_hours: list[int]
    available_extension_hours: list[int]


class ExtendRequest(BaseModel):
    hours_to_add: list[int] = Field(..., min_length=1)
