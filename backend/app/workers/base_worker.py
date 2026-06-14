from datetime import timedelta
from traceback import format_exception

from celery import Task

from app.core.database import SessionLocal
from app.models.base import utcnow
from app.services.job_service import JobExecutionService


class TrackedTask(Task):
    abstract = True
    max_retries = 3
    _execution_id: str | None = None

    def before_start(self, task_id, args, kwargs):
        db = SessionLocal()
        try:
            job = JobExecutionService(db).start(
                self.name,
                job_type="scheduled",
                hotel_id=kwargs.get("hotel_id"),
                input_params={"args": args, "kwargs": kwargs},
                celery_task_id=task_id,
                max_retries=getattr(self, "max_retries", 3) or 3,
            )
            self._execution_id = job.id
        finally:
            db.close()

    def on_success(self, retval, task_id, args, kwargs):
        if not self._execution_id:
            return
        db = SessionLocal()
        try:
            result = retval if isinstance(retval, dict) else {"result": str(retval)}
            JobExecutionService(db).complete(self._execution_id, result)
        finally:
            db.close()

    def on_failure(self, exc, task_id, args, kwargs, einfo):
        if not self._execution_id:
            return
        db = SessionLocal()
        try:
            service = JobExecutionService(db)
            job = service.fail(self._execution_id, exc, commit=False)
            job.error_traceback = "".join(format_exception(type(exc), exc, exc.__traceback__))
            job.next_retry_at = utcnow() + timedelta(minutes=2 ** job.retry_count)
            db.commit()
        finally:
            db.close()
