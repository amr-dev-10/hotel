from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_hotel_access, get_current_user
from app.core.database import get_db
from app.core.responses import ok
from app.models.department import Department
from app.models.user import User
from app.repositories.department_repository import DepartmentRepository
from app.schemas.department import DepartmentCreate, DepartmentRead

router = APIRouter()


@router.get("")
def list_departments(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    departments = DepartmentRepository(db).list_for_hotel(hotel_id)
    return ok([DepartmentRead.model_validate(item).model_dump() for item in departments])


@router.post("")
def create_department(
    hotel_id: str,
    payload: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    department = Department(hotel_id=hotel_id, **payload.model_dump())
    DepartmentRepository(db).add(department)
    return ok(DepartmentRead.model_validate(department).model_dump())
