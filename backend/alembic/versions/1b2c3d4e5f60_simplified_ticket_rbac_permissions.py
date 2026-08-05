"""add simplified ticket rbac permissions

Revision ID: 1b2c3d4e5f60
Revises: 0a1b2c3d4e5f
Create Date: 2026-07-18 17:40:00.000000
"""

from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


revision: str = "1b2c3d4e5f60"
down_revision: Union[str, Sequence[str], None] = "0a1b2c3d4e5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


NEW_PERMISSIONS = (
    ("ticket.update", "Update tickets", "tickets", "ticket", "update"),
    ("ticket.assign_self", "Assign tickets to self", "tickets", "ticket", "assign_self"),
    ("ticket.assign_others", "Assign tickets to other staff", "tickets", "ticket", "assign_others"),
)
LEGACY_PERMISSION_MAP = {
    "ticket.accept": (("ticket.update", None),),
    "ticket.reject": (("ticket.update", None),),
    "ticket.complete_own": (("ticket.update", "own"),),
    "ticket.close": (("ticket.update", None),),
    "ticket.approve": (("ticket.update", None),),
    "ticket.verify": (("ticket.update", None),),
    "ticket.assign": (("ticket.update", None), ("ticket.assign_others", None), ("ticket.assign_self", None)),
}
SCOPE_RANK = {"own": 1, "department": 2, "hotel": 3}


def upgrade() -> None:
    conn = op.get_bind()
    tickets_group_id = _ensure_permission_group(conn, "tickets", "Ticket Management", 10)
    _ensure_new_permissions(conn, tickets_group_id)
    _map_existing_role_permissions(conn)
    _update_workflow_permissions(conn, "ticket.update")


def downgrade() -> None:
    conn = op.get_bind()
    _update_workflow_permissions(conn, "ticket.view")
    permission_ids = _permission_ids(conn, [code for code, *_ in NEW_PERMISSIONS])
    for permission_id in permission_ids.values():
        conn.execute(
            sa.text("DELETE FROM role_permissions WHERE permission_id = :permission_id"),
            {"permission_id": permission_id},
        )
    conn.execute(
        sa.text("DELETE FROM permissions WHERE code IN :codes").bindparams(
            sa.bindparam("codes", expanding=True)
        ),
        {"codes": [code for code, *_ in NEW_PERMISSIONS]},
    )


def _ensure_permission_group(conn, module: str, name: str, sort_order: int) -> str:
    group_id = conn.execute(
        sa.text("SELECT id FROM permission_groups WHERE module = :module ORDER BY sort_order LIMIT 1"),
        {"module": module},
    ).scalar()
    if group_id:
        return group_id
    group_id = str(uuid4())
    conn.execute(
        sa.text(
            "INSERT INTO permission_groups (id, name, module, sort_order) "
            "VALUES (:id, :name, :module, :sort_order)"
        ),
        {"id": group_id, "name": name, "module": module, "sort_order": sort_order},
    )
    return group_id


def _ensure_new_permissions(conn, group_id: str) -> None:
    existing = set(_permission_ids(conn, [code for code, *_ in NEW_PERMISSIONS]))
    for code, name, module, resource, action in NEW_PERMISSIONS:
        if code in existing:
            conn.execute(
                sa.text(
                    "UPDATE permissions "
                    "SET group_id = :group_id, resource = :resource, action = :action, "
                    "name = :name, module = :module "
                    "WHERE code = :code"
                ),
                {
                    "group_id": group_id,
                    "resource": resource,
                    "action": action,
                    "name": name,
                    "module": module,
                    "code": code,
                },
            )
            continue
        conn.execute(
            sa.text(
                "INSERT INTO permissions (id, group_id, code, resource, action, name, module) "
                "VALUES (:id, :group_id, :code, :resource, :action, :name, :module)"
            ),
            {
                "id": str(uuid4()),
                "group_id": group_id,
                "code": code,
                "resource": resource,
                "action": action,
                "name": name,
                "module": module,
            },
        )


def _map_existing_role_permissions(conn) -> None:
    all_codes = list(LEGACY_PERMISSION_MAP) + [code for code, *_ in NEW_PERMISSIONS]
    permission_ids = _permission_ids(conn, all_codes)
    rows = conn.execute(
        sa.text(
            "SELECT role_permissions.role_id, permissions.code, role_permissions.scope "
            "FROM role_permissions "
            "JOIN permissions ON permissions.id = role_permissions.permission_id "
            "WHERE permissions.code IN :codes"
        ).bindparams(sa.bindparam("codes", expanding=True)),
        {"codes": list(LEGACY_PERMISSION_MAP)},
    ).all()
    for role_id, legacy_code, raw_scope in rows:
        for target_code, scope_override in LEGACY_PERMISSION_MAP[legacy_code]:
            permission_id = permission_ids.get(target_code)
            if not permission_id:
                continue
            _upsert_role_permission(conn, role_id, permission_id, scope_override or _normalize_scope(raw_scope))


def _permission_ids(conn, codes: list[str]) -> dict[str, str]:
    if not codes:
        return {}
    rows = conn.execute(
        sa.text("SELECT code, id FROM permissions WHERE code IN :codes").bindparams(
            sa.bindparam("codes", expanding=True)
        ),
        {"codes": codes},
    ).all()
    return {code: permission_id for code, permission_id in rows}


def _upsert_role_permission(conn, role_id: str, permission_id: str, scope: str) -> None:
    existing_scope = conn.execute(
        sa.text(
            "SELECT scope FROM role_permissions "
            "WHERE role_id = :role_id AND permission_id = :permission_id"
        ),
        {"role_id": role_id, "permission_id": permission_id},
    ).scalar()
    if existing_scope:
        wider = _wider_scope(_normalize_scope(existing_scope), _normalize_scope(scope))
        if wider != existing_scope:
            conn.execute(
                sa.text(
                    "UPDATE role_permissions "
                    "SET scope = :scope "
                    "WHERE role_id = :role_id AND permission_id = :permission_id"
                ),
                {"scope": wider, "role_id": role_id, "permission_id": permission_id},
            )
        return
    conn.execute(
        sa.text(
            "INSERT INTO role_permissions (role_id, permission_id, scope) "
            "VALUES (:role_id, :permission_id, :scope)"
        ),
        {"role_id": role_id, "permission_id": permission_id, "scope": _normalize_scope(scope)},
    )


def _update_workflow_permissions(conn, permission_code: str) -> None:
    conn.execute(
        sa.text(
            "UPDATE workflow_transitions "
            "SET required_permission = :permission_code "
            "WHERE required_permission IN ('ticket.view', 'ticket.close', 'ticket.approve')"
        ),
        {"permission_code": permission_code},
    )
    conn.execute(
        sa.text(
            "UPDATE workflow_states "
            "SET required_permission = :permission_code "
            "WHERE required_permission IN ('ticket.view', 'ticket.close', 'ticket.approve')"
        ),
        {"permission_code": permission_code},
    )


def _normalize_scope(scope: str | None) -> str:
    value = (scope or "hotel").lower()
    if value == "dept":
        return "department"
    return value if value in SCOPE_RANK else "hotel"


def _wider_scope(current: str, candidate: str) -> str:
    return candidate if SCOPE_RANK[candidate] > SCOPE_RANK[current] else current
