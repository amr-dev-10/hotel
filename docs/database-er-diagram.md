# Database ER Diagram

This document maps the current SQLAlchemy models in `backend/app/models` into Mermaid ER diagrams.
The schema currently contains 107 mapped database tables. The diagrams are split by domain so the relationships stay readable.

## Reading the Diagrams

- Entity names are shown in uppercase for diagram readability. They map directly to lowercase table names, for example `HOTELS` means `hotels`.
- `||--o{` means one parent row can have zero or many child rows.
- Association tables are shown explicitly, for example `USER_ROLES`, `ROLE_PERMISSIONS`, `MENU_ITEM_TAXES`, and `TICKET_MENU_ITEMS`.
- Most tenant-owned tables contain `hotel_id`. The tenant root is shown in each domain where it helps, but repeated `HOTELS -> table` edges may be summarized when a diagram would otherwise become too dense.

## Tenant, Organization, And Access Control

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ ORGANIZATION_HOTELS : organization_id
    HOTELS ||--o{ ORGANIZATION_HOTELS : hotel_id
    ORGANIZATIONS ||--o{ ORGANIZATION_USERS : organization_id
    USERS ||--o{ ORGANIZATION_USERS : user_id

    HOTELS ||--o{ USERS : hotel_id
    USERS ||--o{ HOTELS : owner_user_id
    HOTELS ||--o{ DEPARTMENTS : hotel_id
    DEPARTMENTS ||--o{ USERS : department_id
    USERS ||--o{ USERS : reports_to

    HOTELS ||--o{ ROLES : hotel_id
    USERS ||--o{ USER_ROLES : user_id
    ROLES ||--o{ USER_ROLES : role_id
    PERMISSION_GROUPS ||--o{ PERMISSIONS : group_id
    ROLES ||--o{ ROLE_PERMISSIONS : role_id
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : permission_id

    USERS ||--o{ USER_SESSIONS : user_id
    USERS ||--o{ FCM_TOKENS : user_id
    HOTELS ||--o{ FCM_TOKENS : hotel_id
```

## Staff, Shifts, And Attendance

```mermaid
erDiagram
    HOTELS ||--o{ EMPLOYEE_SHIFTS : hotel_id
    USERS ||--o{ EMPLOYEE_SHIFTS : user_id
    USERS ||--o{ EMPLOYEE_SHIFTS : created_by
    DEPARTMENTS ||--o{ EMPLOYEE_SHIFTS : department_id

    HOTELS ||--o{ SHIFT_TEMPLATES : hotel_id
    SHIFT_TEMPLATES ||--o{ EMPLOYEE_SHIFT_ASSIGNMENTS : shift_template_id
    USERS ||--o{ EMPLOYEE_SHIFT_ASSIGNMENTS : employee_id
    USERS ||--o{ EMPLOYEE_SHIFT_ASSIGNMENTS : created_by
    HOTELS ||--o{ EMPLOYEE_SHIFT_ASSIGNMENTS : hotel_id

    EMPLOYEE_SHIFT_ASSIGNMENTS ||--o{ ATTENDANCE_LOGS : shift_assignment_id
    SHIFT_TEMPLATES ||--o{ ATTENDANCE_LOGS : shift_template_id
    USERS ||--o{ ATTENDANCE_LOGS : employee_id
    USERS ||--o{ ATTENDANCE_LOGS : approved_by
    HOTELS ||--o{ ATTENDANCE_LOGS : hotel_id

    HOTELS ||--o{ HOTEL_HOLIDAYS : hotel_id
```

## Rooms, Rates, Reservations, And Guest Stay

```mermaid
erDiagram
    HOTELS ||--o{ ROOM_TYPES : hotel_id
    ROOM_TYPES ||--o{ ROOMS : room_type_id
    HOTELS ||--o{ ROOMS : hotel_id

    ROOM_TYPES ||--o{ RATE_PLANS : room_type_id
    RATE_PLANS ||--o{ RATE_PLAN_PERIODS : rate_plan_id
    HOTELS ||--o{ RATE_PLANS : hotel_id

    ROOM_TYPES ||--o{ ROOM_BLOCKS : room_type_id
    ROOMS ||--o{ ROOM_BLOCKS : room_id
    USERS ||--o{ ROOM_BLOCKS : created_by
    HOTELS ||--o{ ROOM_BLOCKS : hotel_id

    HOTELS ||--o{ GUESTS : hotel_id
    GUESTS ||--o{ GUEST_CONSENTS : guest_id
    GUESTS ||--o{ GUEST_PORTAL_TOKENS : guest_id
    RESERVATIONS ||--o{ GUEST_PORTAL_TOKENS : reservation_id
    ROOMS ||--o{ GUEST_PORTAL_TOKENS : room_id

    GUESTS ||--o{ RESERVATIONS : guest_id
    ROOMS ||--o{ RESERVATIONS : room_id
    RATE_PLANS ||--o{ RESERVATIONS : rate_plan_id
    USERS ||--o{ RESERVATIONS : cancelled_by

    RESERVATIONS ||--o{ RESERVATION_GUESTS : reservation_id
    GUESTS ||--o{ RESERVATION_GUESTS : guest_id

    RESERVATIONS ||--o{ RESERVATION_ROOM_TYPES : reservation_id
    ROOM_TYPES ||--o{ RESERVATION_ROOM_TYPES : room_type_id
    RATE_PLANS ||--o{ RESERVATION_ROOM_TYPES : rate_plan_id
    ROOMS ||--o{ RESERVATION_ROOM_TYPES : assigned_room_id

    RESERVATIONS ||--o{ STAY_RECORDS : reservation_id
    ROOMS ||--o{ STAY_RECORDS : room_id
```

## Tickets, Workflow, SLA, And Escalation

```mermaid
erDiagram
    HOTELS ||--o{ TICKETS : hotel_id
    GUESTS ||--o{ TICKETS : guest_id
    RESERVATIONS ||--o{ TICKETS : reservation_id
    WHATSAPP_CONVERSATIONS ||--o{ TICKETS : conversation_id
    ROOMS ||--o{ TICKETS : room_id
    DEPARTMENTS ||--o{ TICKETS : department_id
    USERS ||--o{ TICKETS : assigned_to
    TICKET_CATEGORIES ||--o{ TICKETS : task_category_id

    TICKETS ||--o{ TICKET_EVENTS : ticket_id
    USERS ||--o{ TICKET_EVENTS : actor_id
    TICKETS ||--o{ TICKET_MESSAGES : ticket_id
    TICKETS ||--o{ TICKET_ACCEPTANCES : ticket_id
    USERS ||--o{ TICKET_ACCEPTANCES : offered_to

    TICKETS ||--o{ TICKET_MENU_ITEMS : ticket_id
    MENU_ITEMS ||--o{ TICKET_MENU_ITEMS : menu_item_id
    HOTELS ||--o{ MOBILE_CHAT_MESSAGES : hotel_id

    DEPARTMENTS ||--o{ TICKET_CATEGORIES : department_id
    DEPARTMENTS ||--o{ TASK_TYPE_SLAS : department_id
    TICKET_CATEGORIES ||--o{ TASK_TYPE_SLAS : ticket_category_id
    DEPARTMENTS ||--o{ ESCALATION_RULES : department_id
    TICKET_CATEGORIES ||--o{ ESCALATION_RULES : task_category_id
    ESCALATION_RULES ||--o{ ESCALATION_LOG : rule_id
    TICKETS ||--o{ ESCALATION_LOG : ticket_id
    USERS ||--o{ ESCALATION_LOG : escalated_from
    USERS ||--o{ ESCALATION_LOG : escalated_to

    HOTELS ||--o{ ROUTING_RULES : hotel_id
    USERS ||--o{ ROUTING_RULES : target_user_id

    HOTELS ||--o{ WORKFLOW_DEFINITIONS : hotel_id
    WORKFLOW_DEFINITIONS ||--o{ WORKFLOW_STATES : workflow_id
    WORKFLOW_DEFINITIONS ||--o{ WORKFLOW_TRANSITIONS : workflow_id
    WORKFLOW_STATES ||--o{ WORKFLOW_TRANSITIONS : from_state_id
    WORKFLOW_STATES ||--o{ WORKFLOW_TRANSITIONS : to_state_id
```

## WhatsApp, Campaigns, Live Chat, And AI

```mermaid
erDiagram
    HOTELS ||--o{ WHATSAPP_ACCOUNTS : hotel_id
    WHATSAPP_ACCOUNTS ||--o{ WHATSAPP_ACCOUNT_HEALTH : whatsapp_account_id
    HOTELS ||--o{ WHATSAPP_TEMPLATES : hotel_id
    HOTELS ||--o{ WHATSAPP_USAGE : hotel_id

    WHATSAPP_ACCOUNTS ||--o{ WHATSAPP_CONVERSATIONS : whatsapp_account_id
    GUESTS ||--o{ WHATSAPP_CONVERSATIONS : guest_id
    USERS ||--o{ WHATSAPP_CONVERSATIONS : assigned_staff_id
    USERS ||--o{ WHATSAPP_CONVERSATIONS : resolved_by

    WHATSAPP_CONVERSATIONS ||--o{ WHATSAPP_MESSAGES : conversation_id
    WHATSAPP_ACCOUNTS ||--o{ WHATSAPP_MESSAGES : whatsapp_account_id
    RESERVATIONS ||--o{ WHATSAPP_MESSAGES : reservation_id
    TICKETS ||--o{ WHATSAPP_MESSAGES : ticket_id

    WHATSAPP_ACCOUNTS ||--o{ WHATSAPP_SESSIONS : whatsapp_account_id
    GUESTS ||--o{ WHATSAPP_SESSIONS : guest_id
    ROOMS ||--o{ WHATSAPP_SESSIONS : room_id

    HOTELS ||--o{ CONVERSATION_WINDOWS : hotel_id
    GUESTS ||--o{ LIVE_CHAT_SESSIONS : guest_id
    USERS ||--o{ LIVE_CHAT_SESSIONS : assigned_staff_id

    WHATSAPP_CONVERSATIONS ||--o{ AI_CONVERSATION_SUMMARIES : conversation_id
    WHATSAPP_CONVERSATIONS ||--o{ AI_USAGE_LOGS : conversation_id
    AI_USAGE_LOGS ||--o{ AI_TOOL_EXECUTION_LOGS : usage_log_id
    HOTELS ||--o{ AI_PROMPTS : hotel_id

    HOTELS ||--o{ CAMPAIGNS : hotel_id
    GUESTS ||--o{ CAMPAIGNS : target_guest_id
    USERS ||--o{ CAMPAIGNS : created_by
    CAMPAIGNS ||--o{ CAMPAIGN_DELIVERIES : campaign_id
    GUESTS ||--o{ CAMPAIGN_DELIVERIES : guest_id
```

## Food And Beverage, Folios, Payments, And Feedback

```mermaid
erDiagram
    HOTELS ||--o{ MENU_CATEGORIES : hotel_id
    MENU_CATEGORIES ||--o{ MENU_ITEMS : category_id
    MENU_ITEMS ||--o{ MENU_ITEM_TAXES : menu_item_id
    TAX_CONFIGS ||--o{ MENU_ITEM_TAXES : tax_config_id

    HOTELS ||--o{ RESTAURANT_TABLES : hotel_id
    RESTAURANT_TABLES ||--o{ RESTAURANT_ORDERS : table_id
    GUESTS ||--o{ RESTAURANT_ORDERS : guest_id
    ROOMS ||--o{ RESTAURANT_ORDERS : room_id
    TICKETS ||--o{ RESTAURANT_ORDERS : ticket_id
    GUEST_FOLIOS ||--o{ RESTAURANT_ORDERS : folio_id
    USERS ||--o{ RESTAURANT_ORDERS : taken_by

    RESTAURANT_ORDERS ||--o{ RESTAURANT_ORDER_ITEMS : order_id
    MENU_ITEMS ||--o{ RESTAURANT_ORDER_ITEMS : menu_item_id

    RESERVATIONS ||--o{ GUEST_FOLIOS : reservation_id
    GUESTS ||--o{ GUEST_FOLIOS : guest_id
    GUEST_FOLIOS ||--o{ FOLIO_ITEMS : folio_id
    TICKETS ||--o{ FOLIO_ITEMS : ticket_id
    USERS ||--o{ FOLIO_ITEMS : posted_by

    GUEST_FOLIOS ||--o{ PAYMENTS : folio_id
    USERS ||--o{ PAYMENTS : collected_by
    PAYMENTS ||--o{ PAYMENT_TRANSACTIONS : payment_id
    PAYMENTS ||--o{ REFUNDS : payment_id
    GUEST_FOLIOS ||--o{ REFUNDS : folio_id
    USERS ||--o{ REFUNDS : processed_by

    GUESTS ||--o{ FEEDBACK : guest_id
    TICKETS ||--o{ FEEDBACK : ticket_id
```

## Inventory And Procurement

```mermaid
erDiagram
    HOTELS ||--o{ VENDORS : hotel_id
    VENDORS ||--o{ INVENTORY_ITEMS : default_vendor_id
    HOTELS ||--o{ INVENTORY_ITEMS : hotel_id

    INVENTORY_ITEMS ||--o{ INVENTORY_TRANSACTIONS : item_id
    USERS ||--o{ INVENTORY_TRANSACTIONS : performed_by
    HOTELS ||--o{ INVENTORY_TRANSACTIONS : hotel_id

    VENDORS ||--o{ PURCHASE_ORDERS : vendor_id
    USERS ||--o{ PURCHASE_ORDERS : created_by
    USERS ||--o{ PURCHASE_ORDERS : approved_by
    HOTELS ||--o{ PURCHASE_ORDERS : hotel_id

    PURCHASE_ORDERS ||--o{ PURCHASE_ORDER_ITEMS : purchase_order_id
    INVENTORY_ITEMS ||--o{ PURCHASE_ORDER_ITEMS : item_id
```

## Operations, Housekeeping, Maintenance, And Jobs

```mermaid
erDiagram
    HOTELS ||--o{ HOUSEKEEPING_CHECKLISTS : hotel_id
    HOTELS ||--o{ HOUSEKEEPING_SCHEDULES : hotel_id
    ROOMS ||--o{ HOUSEKEEPING_SCHEDULES : room_id
    USERS ||--o{ HOUSEKEEPING_SCHEDULES : assigned_to

    HOTELS ||--o{ MAINTENANCE_ORDERS : hotel_id
    ROOMS ||--o{ MAINTENANCE_ORDERS : room_id
    TICKETS ||--o{ MAINTENANCE_ORDERS : ticket_id
    USERS ||--o{ MAINTENANCE_ORDERS : reported_by
    USERS ||--o{ MAINTENANCE_ORDERS : assigned_to

    HOTELS ||--o{ LOST_FOUND_ITEMS : hotel_id
    GUESTS ||--o{ LOST_FOUND_ITEMS : guest_id
    USERS ||--o{ LOST_FOUND_ITEMS : found_by

    HOTELS ||--o{ AUDIT_LOGS : hotel_id
    USERS ||--o{ AUDIT_LOGS : user_id
    HOTELS ||--o{ NOTIFICATIONS : hotel_id
    USERS ||--o{ NOTIFICATIONS : user_id
    HOTELS ||--o{ MEDIA_FILES : hotel_id
    USERS ||--o{ MEDIA_FILES : uploaded_by

    HOTELS ||--o{ ANALYTICS_SNAPSHOTS : hotel_id
    HOTELS ||--o{ API_RATE_LIMITS : hotel_id
    HOTELS ||--o{ HOTEL_SECRETS : hotel_id
    HOTELS ||--o{ JOB_EXECUTIONS : hotel_id

    HOTELS ||--o{ EXPORT_JOBS : hotel_id
    USERS ||--o{ EXPORT_JOBS : requested_by
    HOTELS ||--o{ IMPORT_JOBS : hotel_id
    USERS ||--o{ IMPORT_JOBS : uploaded_by
```

## Knowledge Base, Bot Configuration, And Service Forms

```mermaid
erDiagram
    HOTELS ||--o{ BOT_CONFIGS : hotel_id
    HOTELS ||--o{ BOT_VERSIONS : hotel_id
    USERS ||--o{ BOT_VERSIONS : published_by

    HOTELS ||--o{ HOTEL_FAQS : hotel_id
    HOTELS ||--o{ HOTEL_LANGUAGES : hotel_id
    HOTELS ||--o{ DEPARTMENT_CONFIGS : hotel_id
    DEPARTMENTS ||--o{ DEPARTMENT_CONFIGS : department_id

    HOTELS ||--o{ SERVICE_FORMS : hotel_id
    SERVICE_FORMS ||--o{ SERVICE_FORM_FIELDS : service_form_id

    HOTELS ||--o{ KNOWLEDGE_DOCUMENTS : hotel_id
    KNOWLEDGE_DOCUMENTS ||--o{ KNOWLEDGE_DOCUMENT_VERSIONS : document_id
    USERS ||--o{ KNOWLEDGE_DOCUMENT_VERSIONS : changed_by
    KNOWLEDGE_DOCUMENTS ||--o{ KNOWLEDGE_EMBEDDINGS : document_id
```

## SaaS, Subscription, And Platform Tables

```mermaid
erDiagram
    FEATURES ||--o{ PLAN_FEATURES : feature_id
    HOTELS ||--o{ USAGE_LIMITS : hotel_id
    HOTELS ||--o{ SUBSCRIPTIONS : hotel_id
    SUBSCRIPTIONS ||--o{ INVOICES : subscription_id
    HOTELS ||--o{ INVOICES : hotel_id

    PLATFORM_ADMINS {
        string id PK
        string email
    }

    PLATFORM_SETTINGS {
        string id PK
        string key
    }
```

## Coverage Notes

- The diagrams cover all model tables listed in `database-model-table-inventory.md`.
- The model metadata exposes 238 foreign-key relationships. The diagrams show the important domain relationships and repeated tenant ownership relationships where they clarify ownership.
- Actor references to `users.id` are shown for operational ownership fields such as `created_by`, `assigned_to`, `approved_by`, `uploaded_by`, and similar audit columns where useful.
