from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.user import User
from app.repositories.department_repository import DepartmentRepository
from app.repositories.ticket_repository import TicketRepository
from app.repositories.user_repository import UserRepository


class HierarchyService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.departments = DepartmentRepository(db)
        self.tickets = TicketRepository(db)

    def get_escalation_chain(self, user_id: str, max_depth: int = 10) -> list[User]:
        chain: list[User] = []
        seen: set[str] = set()
        current_id: str | None = user_id
        for _ in range(max_depth):
            if not current_id or current_id in seen:
                break
            seen.add(current_id)
            user = self.users.get_active(current_id)
            if not user or not user.reports_to:
                break
            superior = self.users.get_active(user.reports_to)
            if not superior:
                break
            chain.append(superior)
            current_id = superior.id
        return chain

    def get_superior_at_level(self, user_id: str, target_level: str | None) -> User | None:
        chain = self.get_escalation_chain(user_id)
        if target_level:
            for user in chain:
                if user.staff_level == target_level:
                    return user
        return chain[0] if chain else None

    def get_department_tree(self, hotel_id: str, department_id: str) -> dict:
        department = self.departments.get_for_hotel(hotel_id, department_id)
        if not department:
            raise not_found("Department not found")
        staff = list(self.users.list_for_department(hotel_id, department_id))
        manager = next((user for user in staff if user.staff_level == "manager"), None)
        supervisors = [user for user in staff if user.staff_level == "supervisor"]
        attendants = [user for user in staff if user.staff_level == "attendant"]

        def node(user: User) -> dict:
            return {
                "id": user.id,
                "name": user.name,
                "staff_level": user.staff_level,
                "reports_to": user.reports_to,
                "on_shift": user.is_on_duty,
                "open_tickets": self.tickets.count_open_for_user(hotel_id, user.id),
            }

        supervisor_nodes = []
        assigned_attendants: set[str] = set()
        for supervisor in supervisors:
            children = [user for user in attendants if user.reports_to == supervisor.id]
            assigned_attendants.update(user.id for user in children)
            supervisor_nodes.append({**node(supervisor), "attendants": [node(user) for user in children]})

        return {
            "department": department.name,
            "manager": node(manager) if manager else None,
            "supervisors": supervisor_nodes,
            "attendants": [node(user) for user in attendants if user.id not in assigned_attendants],
        }
