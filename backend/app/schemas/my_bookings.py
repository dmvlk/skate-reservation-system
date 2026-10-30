from datetime import date
from pydantic import BaseModel, Field


class MyBookingItem(BaseModel):
    """Предмет снаряжения в брони"""
    item_type: str = Field(..., description="Название типа снаряжения", examples=["Коньки"])
    size: str | None = Field(..., description="Выбранный размер", examples=["42"])

class MyBookingRead(BaseModel):
    """Информация о брони для клиента"""
    id: int = Field(..., description="Номер брони", examples=[1])
    category: str = Field(..., description="Категория проката", examples=["skates"])
    booking_date: date = Field(..., description="Дата проката", examples=["2026-10-31"])
    hours: list[int] = Field(..., description="Забронированные часы", examples=[[14, 15]])
    status: str = Field(..., description="Статус брони", examples=["active"])
    items: list[MyBookingItem] = Field(..., description="Состав снаряжения")

class CancelResponse(BaseModel):
    """Ответ при успешной отмене брони"""
    id: int = Field(..., description="Номер отмененной брони", examples=[1])
    status: str = Field(..., description="Новый статус брони", examples=["cancelled"])
    message: str = Field(..., description="Текстовое сообщение об успехе", examples=["Бронь успешно отменена"])

class PhoneLookup(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20, description="Номер телефона", examples=["+79161234567"])

class ExtensionOptions(BaseModel):
    """Варианты продления брони"""
    booking_id: int = Field(..., description="Номер брони", examples=[1])
    current_hours: list[int] = Field(..., description="Текущие забронированные часы", examples=[[14, 15]])
    available_extension_hours: list[int] = Field(
        ..., 
        description="Часы, на которые можно продлить бронь", 
        examples=[[16, 17, 18, 19]]
    )

class ExtendRequest(BaseModel):
    """Запрос на продление брони"""
    hours_to_add: list[int] = Field(
        ..., 
        min_length=1, 
        description="Часы, которые нужно добавить к брони", 
        examples=[[16, 17]]
    )
