from pydantic import BaseModel, ConfigDict


class SizeOptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str


class ItemTypeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    is_required: bool
    size_options: list[SizeOptionRead] = []


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
