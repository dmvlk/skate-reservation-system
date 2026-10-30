from datetime import date
from pydantic import BaseModel, Field


class SelectedItem(BaseModel):
    """Дополнительное снаряжение"""
    item_type_code: str = Field(
        ..., 
        description="Код типа снаряжения", 
        examples=["helmet", "jacket", "knee_pads"]
    )
    size_value: int | None = Field(
        None, 
        description="EU-размер (только для ботинок)", 
        examples=[42]
    )
    size_bucket: str | None = Field(
        None, 
        description="Буквенный размер (для одежды, защиты, шлемов)", 
        examples=["M", "L"]
    )

class BookingCreate(BaseModel):
    """Данные для создания новой брони"""
    category: str = Field(
        ..., 
        description="Категория проката", 
        examples=["skates", "skis", "snowboard"]
    )

    # клиент
    phone: str = Field(
        ..., 
        min_length=10, 
        max_length=20, 
        description="Номер телефона клиента (любой формат, будет нормализован)", 
        examples=["+7 916 123-45-67"]
    )
    last_name: str = Field(..., min_length=1, max_length=100, description="Фамилия", examples=["Иванов"])
    first_name: str = Field(..., min_length=1, max_length=100, description="Имя", examples=["Иван"])
    middle_name: str | None = Field(None, max_length=100, description="Отчество (если есть)", examples=["Иванович"])

    booking_date: date = Field(..., description="Дата проката", examples=["2026-10-31"])
    hours: list[int] = Field(
        ..., 
        min_length=1, 
        description="Список часов начала проката (от 10 до 19)", 
        examples=[[14, 15]]
    )

    # для коньков
    size_value: int | None = Field(None, description="EU-размер коньков (обязателен для категории skates)", examples=[42])

    # для лыж и сноуборда
    size_bucket: str | None = Field(None, description="Размер лыж/доски (обязателен для skis и snowboard)", examples=["M"])
    boot_size_value: int | None = Field(None, description="EU-размер ботинок (обязателен для лыж и сноуборда)", examples=[42])

    selected_items: list[SelectedItem] = Field(
        default_factory=list, 
        description="Список дополнительного снаряжения"
    )

class BookingRead(BaseModel):
    """Информация о созданной брони"""
    id: int = Field(..., description="Уникальный номер брони", examples=[1])
    phone_last4: str = Field(..., description="Последние 4 цифры телефона для идентификации", examples=["4567"])
    category: str = Field(..., description="Категория проката", examples=["skates"])
    booking_date: date = Field(..., description="Дата проката", examples=["2026-10-31"])
    hours: list[int] = Field(..., description="Забронированные часы", examples=[[14, 15]])
    status: str = Field(..., description="Текущий статус брони", examples=["active"])