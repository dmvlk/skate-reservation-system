from datetime import date
from pydantic import BaseModel, Field


class InventoryItemRead(BaseModel):
    """Единица инвентаря в прокате"""
    id: int = Field(..., description="Уникальный ID единицы инвентаря", examples=[1])
    item_type: str = Field(..., description="Название типа снаряжения", examples=["Коньки"])
    size: str | None = Field(..., description="Размер (EU или буквенный)", examples=["42"])
    status: str = Field(..., description="Статус единицы", examples=["available"])
    code: str = Field(..., description="Уникальный код единицы", examples=["SK-001"])

    class Config:
        from_attributes = True


class InventoryItemCreate(BaseModel):
    """Данные для добавления новой единицы инвентаря"""
    item_type_code: str = Field(
        ..., 
        description="Код типа снаряжения (skate, ski, helmet и т.д.)", 
        examples=["skate"]
    )
    size_value: int | None = Field(
        None, 
        description="EU-размер (только для коньков и ботинок)", 
        examples=[42]
    )
    size_bucket: str | None = Field(
        None, 
        description="Буквенный размер (для лыж, сноубордов, одежды, шлемов)", 
        examples=["M"]
    )

class InventoryItemStatusUpdate(BaseModel):
    """Запрос на смену статуса инвентаря"""
    status_code: str = Field(
        ..., 
        description="Новый статус", 
        examples=["available", "rented", "broken"]
    )

class AdminBookingRead(BaseModel):
    """Информация о брони для администратора"""
    id: int = Field(..., description="Номер брони", examples=[1])
    phone: str = Field(..., description="Телефон клиента", examples=["79161234567"])
    full_name: str = Field(..., description="ФИО клиента", examples=["Иванов Иван Иванович"])
    category: str = Field(..., description="Категория проката", examples=["skates"])
    booking_date: date = Field(..., description="Дата проката", examples=["2026-10-31"])
    hours: list[int] = Field(..., description="Часы брони", examples=[[14, 15]])
    status: str = Field(..., description="Статус брони", examples=["active"])
    items: list[str] = Field(..., description="Список выданного снаряжения", examples=[["Коньки"]])

class IssueBookingResponse(BaseModel):
    """Успешная выдача инвентаря"""
    id: int = Field(..., description="Номер брони", examples=[1])
    status: str = Field(..., description="Новый статус", examples=["issued"])
    issued_by: str = Field(..., description="ФИО администратора, выдавшего инвентарь", examples=["Админов Админ Админович"])
    message: str = Field(..., description="Сообщение", examples=["Инвентарь выдан"])

class CompleteBookingResponse(BaseModel):
    """Успешный прием возврата"""
    id: int = Field(..., description="Номер брони", examples=[1])
    status: str = Field(..., description="Новый статус", examples=["completed"])
    message: str = Field(..., description="Сообщение", examples=["Возврат принят"])