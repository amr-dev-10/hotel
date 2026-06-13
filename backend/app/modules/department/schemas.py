from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    key: str | None = Field(default=None, min_length=1, max_length=80)
    is_active: bool = True


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    key: str | None = Field(default=None, min_length=1, max_length=80)
    is_active: bool | None = None


class DepartmentRead(BaseModel):
    id: str
    hotel_id: str
    name: str
    key: str
    is_active: bool
