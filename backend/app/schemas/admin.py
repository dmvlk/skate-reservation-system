from datetime import date
from pydantic import BaseModel, Field


class InventoryItemRead(BaseModel):
    id: int
    item_type: str
    size: str | None
    status: str
    code: str

    class Config:
        from_attributes = True


class InventoryItemCreate(BaseModel):
    item_type_code: str = Field(..., description="skate, ski, ski_boot, helmet и т.д.")
    size_value: int | None = None
    size_bucket: str | None = Field(None, description="S / M / L / XL")


class InventoryItemStatusUpdate(BaseModel):
    status_code: str = Field(..., description="available / rented / broken")


class AdminBookingRead(BaseModel):
    id: int
    phone: str
    full_name: str
    category: str
    booking_date: date
    hours: list[int]
    status: str
    items: list[str]


class IssueBookingResponse(BaseModel):
    id: int
    status: str
    issued_by: str
    message: str


class CompleteBookingResponse(BaseModel):
    id: int
    status: str
    message: str
