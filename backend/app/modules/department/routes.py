import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext, require_tenant_context
from app.modules.department.models import Department
from app.modules.department.schemas import DepartmentCreate, DepartmentRead, DepartmentUpdate
from app.modules.hotel.dependencies import ensure_hotel_scope

router = APIRouter(prefix="/hotels/{hotel_id}/departments", tags=["departments"])


def _key_from_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "department"


def _department_to_read(department: Department) -> DepartmentRead:
    return DepartmentRead(
        id=department.id,
        hotel_id=department.tenant_id,
        name=department.name,
        key=department.key,
        is_active=department.is_active,
    )


def _get_department(db: Session, hotel_id: str, department_id: str) -> Department:
    department = db.scalar(select(Department).where(Department.tenant_id == hotel_id, Department.id == department_id))
    if department is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return department


@router.get("", response_model=list[DepartmentRead])
def list_departments(
    hotel_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[DepartmentRead]:
    ensure_hotel_scope(hotel_id, context)
    departments = db.scalars(select(Department).where(Department.tenant_id == hotel_id).order_by(Department.name)).all()
    return [_department_to_read(department) for department in departments]


@router.post("", response_model=DepartmentRead, status_code=201)
def create_department(
    hotel_id: str,
    payload: DepartmentCreate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> DepartmentRead:
    ensure_hotel_scope(hotel_id, context)
    key = payload.key or _key_from_name(payload.name)
    existing = db.scalar(select(Department.id).where(Department.tenant_id == hotel_id, Department.key == key))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Department key already exists")
    department = Department(tenant_id=hotel_id, name=payload.name, key=key, is_active=payload.is_active)
    db.add(department)
    db.commit()
    db.refresh(department)
    return _department_to_read(department)


@router.put("/{dept_id}", response_model=DepartmentRead)
def update_department(
    hotel_id: str,
    dept_id: str,
    payload: DepartmentUpdate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> DepartmentRead:
    ensure_hotel_scope(hotel_id, context)
    department = _get_department(db, hotel_id, dept_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(department, key, value)
    db.commit()
    db.refresh(department)
    return _department_to_read(department)


@router.delete("/{dept_id}", status_code=204)
def delete_department(
    hotel_id: str,
    dept_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> Response:
    ensure_hotel_scope(hotel_id, context)
    department = _get_department(db, hotel_id, dept_id)
    department.is_active = False
    db.commit()
    return Response(status_code=204)
