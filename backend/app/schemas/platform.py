from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class JobExecutionCreate(BaseModel):
    job_name: str
    job_type: str = "manual"
    hotel_id: str | None = None
    input_params: dict = Field(default_factory=dict)
    celery_task_id: str | None = None


class JobExecutionRead(ORMModel):
    id: str
    job_name: str
    job_type: str
    hotel_id: str | None = None
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None
    input_params: dict
    result: dict
    error_message: str | None = None
    retry_count: int
    max_retries: int
    next_retry_at: datetime | None = None
    celery_task_id: str | None = None
    created_at: datetime


class ApiRateLimitUpsert(BaseModel):
    endpoint_group: str
    max_requests: int = Field(gt=0)
    window_seconds: int = Field(gt=0)


class ApiRateLimitRead(ORMModel):
    id: str
    hotel_id: str
    endpoint_group: str
    max_requests: int
    window_seconds: int
    created_at: datetime


class ExportJobCreate(BaseModel):
    export_type: str
    format: str = "csv"
    filters: dict = Field(default_factory=dict)


class ExportJobRead(ORMModel):
    id: str
    hotel_id: str
    export_type: str
    format: str
    filters: dict
    status: str
    file_url: str | None = None
    file_size_bytes: int | None = None
    row_count: int | None = None
    requested_by: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime


class ImportJobCreate(BaseModel):
    import_type: str
    source_file_url: str
    rows: list[dict] = Field(default_factory=list)


class ImportJobRead(ORMModel):
    id: str
    hotel_id: str
    import_type: str
    source_file_url: str
    status: str
    total_rows: int
    processed_rows: int
    successful_rows: int
    failed_rows: int
    errors: list[dict]
    uploaded_by: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
