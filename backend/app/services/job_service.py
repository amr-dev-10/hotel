from datetime import timedelta
from traceback import format_exc

from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.ops import JobExecution
from app.repositories.ops_repository import JobExecutionRepository


class JobExecutionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.jobs = JobExecutionRepository(db)

    def start(
        self,
        job_name: str,
        job_type: str = "manual",
        hotel_id: str | None = None,
        input_params: dict | None = None,
        celery_task_id: str | None = None,
        max_retries: int = 3,
        commit: bool = True,
    ) -> JobExecution:
        job = JobExecution(
            job_name=job_name,
            job_type=job_type,
            hotel_id=hotel_id,
            status="running",
            input_params=input_params or {},
            started_at=utcnow(),
            celery_task_id=celery_task_id,
            max_retries=max_retries,
        )
        self.db.add(job)
        self.db.flush()
        if commit:
            self.db.commit()
            self.db.refresh(job)
        return job

    def complete(self, job_id: str, result: dict | None = None, commit: bool = True) -> JobExecution:
        job = self.jobs.get(job_id)
        job.status = "completed"
        job.completed_at = utcnow()
        if job.started_at:
            job.duration_ms = int((job.completed_at - job.started_at).total_seconds() * 1000)
        job.result = result or {}
        if commit:
            self.db.commit()
            self.db.refresh(job)
        return job

    def fail(self, job_id: str, exc: Exception, commit: bool = True) -> JobExecution:
        job = self.jobs.get(job_id)
        job.retry_count += 1
        job.status = "failed" if job.retry_count >= job.max_retries else "retrying"
        job.error_message = str(exc)
        job.error_traceback = format_exc()
        job.next_retry_at = utcnow() + timedelta(minutes=2 ** job.retry_count)
        if commit:
            self.db.commit()
            self.db.refresh(job)
        return job
