from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, not_found
from app.models.base import utcnow
from app.models.guest import Guest
from app.models.ops import ExportJob, ImportJob
from app.repositories.guest_repository import GuestRepository
from app.repositories.ops_repository import ExportJobRepository, ImportJobRepository
from app.repositories.reservation_repository import ReservationRepository
from app.repositories.ticket_repository import TicketRepository
from app.schemas.platform import ExportJobCreate, ImportJobCreate
from app.services.job_service import JobExecutionService


class ExportService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.exports = ExportJobRepository(db)
        self.guests = GuestRepository(db)
        self.reservations = ReservationRepository(db)
        self.tickets = TicketRepository(db)

    def create(self, hotel_id: str, payload: ExportJobCreate, requested_by: str | None) -> ExportJob:
        execution = JobExecutionService(self.db).start(
            "generate_export",
            job_type="manual",
            hotel_id=hotel_id,
            input_params=payload.model_dump(),
            commit=False,
        )
        job = ExportJob(
            hotel_id=hotel_id,
            export_type=payload.export_type,
            format=payload.format,
            filters=payload.filters,
            status="processing",
            requested_by=requested_by,
            started_at=utcnow(),
            expires_at=utcnow() + timedelta(days=7),
        )
        self.db.add(job)
        self.db.flush()
        rows = self._rows(hotel_id, payload.export_type, payload.filters)
        job.row_count = len(rows)
        job.file_size_bytes = max(len(rows), 1) * 64
        job.file_url = f"memory://exports/{job.id}.{payload.format}"
        job.status = "completed"
        job.completed_at = utcnow()
        JobExecutionService(self.db).complete(
            execution.id,
            {"export_job_id": job.id, "row_count": job.row_count},
            commit=False,
        )
        self.db.commit()
        self.db.refresh(job)
        return job

    def _rows(self, hotel_id: str, export_type: str, filters: dict) -> list[dict]:
        if export_type == "guests":
            rows = [item.__dict__ for item in self.guests.list_for_hotel(hotel_id, limit=1000)]
            if filters.get("status"):
                rows = [row for row in rows if row.get("status") == filters["status"]]
            return rows
        if export_type == "reservations":
            return [item.__dict__ for item in self.reservations.list_for_hotel(hotel_id, limit=1000)]
        if export_type == "tickets":
            return [item.__dict__ for item in self.tickets.list_for_hotel(hotel_id, limit=1000)]
        return []

    def download(self, hotel_id: str, export_id: str) -> dict:
        job = self.exports.get_for_hotel(hotel_id, export_id)
        if not job:
            raise not_found("Export job not found")
        return {"download_url": job.file_url, "expires_at": job.expires_at}


class ImportService:
    REQUIRED_COLUMNS = {
        "guests": {"name", "phone"},
    }

    def __init__(self, db: Session) -> None:
        self.db = db
        self.imports = ImportJobRepository(db)

    def create(self, hotel_id: str, payload: ImportJobCreate, uploaded_by: str | None) -> ImportJob:
        execution = JobExecutionService(self.db).start(
            "validate_import",
            job_type="manual",
            hotel_id=hotel_id,
            input_params={"import_type": payload.import_type, "row_count": len(payload.rows)},
            commit=False,
        )
        job = ImportJob(
            hotel_id=hotel_id,
            import_type=payload.import_type,
            source_file_url=payload.source_file_url,
            raw_rows=payload.rows,
            status="validating",
            total_rows=len(payload.rows),
            uploaded_by=uploaded_by,
            started_at=utcnow(),
        )
        self.db.add(job)
        self.db.flush()
        self._validate(job)
        JobExecutionService(self.db).complete(
            execution.id,
            {"import_job_id": job.id, "errors": len(job.errors)},
            commit=False,
        )
        self.db.commit()
        self.db.refresh(job)
        return job

    def execute(self, hotel_id: str, import_id: str) -> ImportJob:
        job = self.imports.get_for_hotel(hotel_id, import_id)
        if not job:
            raise not_found("Import job not found")
        if job.status not in {"validated", "completed"}:
            raise bad_request("Import must be validated before execution")
        if job.status == "completed":
            return job
        execution = JobExecutionService(self.db).start(
            "execute_import",
            job_type="manual",
            hotel_id=hotel_id,
            input_params={"import_job_id": job.id},
            commit=False,
        )
        job.status = "importing"
        if job.import_type == "guests":
            valid_rows = self._valid_rows(job)
            for row in valid_rows:
                self.db.add(
                    Guest(
                        hotel_id=hotel_id,
                        name=row["name"],
                        phone=row.get("phone"),
                        whatsapp_phone=row.get("whatsapp_phone"),
                        email=row.get("email"),
                        status=row.get("status") or "pre_arrival",
                    )
                )
                job.successful_rows += 1
                job.processed_rows += 1
        job.failed_rows = len(job.errors)
        job.status = "completed"
        job.completed_at = utcnow()
        JobExecutionService(self.db).complete(
            execution.id,
            {"import_job_id": job.id, "successful_rows": job.successful_rows},
            commit=False,
        )
        self.db.commit()
        self.db.refresh(job)
        return job

    def _validate(self, job: ImportJob) -> None:
        required = self.REQUIRED_COLUMNS.get(job.import_type, set())
        errors = []
        seen_phones = set()
        for index, row in enumerate(job.raw_rows, start=1):
            missing = [column for column in required if not row.get(column)]
            for column in missing:
                errors.append({"row": index, "field": column, "error": "required"})
            phone = row.get("phone")
            if phone in seen_phones:
                errors.append({"row": index, "field": "phone", "error": "duplicate in file"})
            if phone:
                seen_phones.add(phone)
        job.errors = errors
        job.failed_rows = len({error["row"] for error in errors})
        job.status = "validated"

    def _valid_rows(self, job: ImportJob) -> list[dict]:
        invalid_rows = {error["row"] for error in job.errors}
        return [row for index, row in enumerate(job.raw_rows, start=1) if index not in invalid_rows]
