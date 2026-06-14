from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.ops_repository import (
    ApiRateLimitRepository,
    ExportJobRepository,
    ImportJobRepository,
    JobExecutionRepository,
)
from app.schemas.platform import (
    ApiRateLimitRead,
    ApiRateLimitUpsert,
    ExportJobCreate,
    ExportJobRead,
    ImportJobCreate,
    ImportJobRead,
    JobExecutionRead,
)
from app.services.import_export_service import ExportService, ImportService
from app.services.rate_limit_service import RateLimitService

router = APIRouter()


@router.get("/jobs")
def list_jobs(
    hotel_id: str,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    jobs = JobExecutionRepository(db).list_filtered(hotel_id=hotel_id, status=status)
    return ok([JobExecutionRead.model_validate(item).model_dump() for item in jobs])


@router.get("/rate-limits")
def list_rate_limits(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    RateLimitService(db).seed_defaults(hotel_id)
    db.commit()
    rows = ApiRateLimitRepository(db).list_for_hotel(hotel_id)
    return ok([ApiRateLimitRead.model_validate(item).model_dump() for item in rows])


@router.put("/rate-limits")
def upsert_rate_limit(
    hotel_id: str,
    payload: ApiRateLimitUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    row = RateLimitService(db).upsert(hotel_id, payload)
    return ok(ApiRateLimitRead.model_validate(row).model_dump())


@router.get("/exports")
def list_exports(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("analytics.export")),
) -> dict:
    jobs = ExportJobRepository(db).list_for_hotel(hotel_id)
    return ok([ExportJobRead.model_validate(item).model_dump() for item in jobs])


@router.post("/exports")
def create_export(
    hotel_id: str,
    payload: ExportJobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("analytics.export")),
) -> dict:
    job = ExportService(db).create(hotel_id, payload, current_user.id)
    return ok(ExportJobRead.model_validate(job).model_dump())


@router.get("/exports/{export_id}/download")
def download_export(
    hotel_id: str,
    export_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("analytics.export")),
) -> dict:
    return ok(ExportService(db).download(hotel_id, export_id))


@router.get("/imports")
def list_imports(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    jobs = ImportJobRepository(db).list_for_hotel(hotel_id)
    return ok([ImportJobRead.model_validate(item).model_dump() for item in jobs])


@router.post("/imports")
def create_import(
    hotel_id: str,
    payload: ImportJobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    job = ImportService(db).create(hotel_id, payload, current_user.id)
    return ok(ImportJobRead.model_validate(job).model_dump())


@router.post("/imports/{import_id}/execute")
def execute_import(
    hotel_id: str,
    import_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    job = ImportService(db).execute(hotel_id, import_id)
    return ok(ImportJobRead.model_validate(job).model_dump())
