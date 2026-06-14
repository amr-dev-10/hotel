from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.services.hierarchy_service import HierarchyService

router = APIRouter()


@router.get("/{department_id}/hierarchy")
def department_hierarchy(
    hotel_id: str,
    department_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user.view")),
) -> dict:
    tree = HierarchyService(db).get_department_tree(hotel_id, department_id)
    return ok(tree)
