from pydantic import BaseModel


class DashboardMetrics(BaseModel):
    total_users: int
    active_users: int
    open_tickets: int
    closed_tickets: int
    recent_activities: int
