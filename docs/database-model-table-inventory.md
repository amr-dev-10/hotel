# Database Model Table Inventory

This inventory lists the SQLAlchemy model tables defined under `backend/app/models`.
Association tables such as `user_roles`, `role_permissions`, `ticket_menu_items`, and `menu_item_taxes` are included because they are real database tables, even though they are not full ORM model classes.

| Table name | Technical and business use |
|---|---|
| `ai_conversation_summaries` | Technical: AI conversation summary table. Business: keeps compressed guest/staff chat context. |
| `ai_prompts` | Technical: prompt template/version table. Business: manages AI assistant behavior. |
| `ai_tool_execution_logs` | Technical: AI tool-call audit log. Business: records automated actions taken by AI. |
| `ai_usage_logs` | Technical: model usage telemetry. Business: tracks AI cost, tokens, and provider usage. |
| `analytics_snapshots` | Technical: metrics snapshot table. Business: stores dashboard analytics over time. |
| `api_rate_limits` | Technical: rate-limit tracking table. Business: protects APIs from overuse. |
| `attendance_logs` | Technical: attendance punch log. Business: tracks staff check-in and check-out. |
| `audit_logs` | Technical: immutable activity log. Business: supports compliance, traceability, and admin review. |
| `bot_configs` | Technical: chatbot configuration entity. Business: stores hotel bot menus and settings. |
| `bot_versions` | Technical: bot version history. Business: tracks chatbot content releases. |
| `campaign_deliveries` | Technical: campaign delivery log. Business: tracks sent, failed, and delivered guest messages. |
| `campaigns` | Technical: marketing campaign entity. Business: manages guest outreach and promotions. |
| `conversation_windows` | Technical: WhatsApp messaging window state. Business: controls when guest replies are allowed. |
| `department_configs` | Technical: department configuration entity. Business: stores department-specific automation and service settings. |
| `departments` | Technical: department master entity. Business: represents hotel teams such as front desk, housekeeping, and kitchen. |
| `employee_shift_assignments` | Technical: staff-shift assignment table. Business: assigns staff members to scheduled shifts. |
| `employee_shifts` | Technical: shift record entity. Business: stores staff work schedules. |
| `escalation_log` | Technical: escalation audit log. Business: records when service tickets were escalated. |
| `escalation_rules` | Technical: escalation policy table. Business: defines overdue ticket escalation behavior. |
| `export_jobs` | Technical: asynchronous export job table. Business: tracks report and data exports. |
| `fcm_tokens` | Technical: Firebase Cloud Messaging token store. Business: enables mobile push notifications. |
| `features` | Technical: SaaS feature catalog. Business: defines platform features available to plans. |
| `feedback` | Technical: feedback/review entity. Business: stores guest ratings and comments. |
| `folio_items` | Technical: charge line item table. Business: stores room, food, service, tax, and adjustment charges. |
| `guest_consents` | Technical: consent/audit record. Business: tracks guest marketing and privacy consent. |
| `guest_folios` | Technical: billing ledger entity. Business: represents a guest billing account for a stay. |
| `guest_portal_tokens` | Technical: guest access token table. Business: enables secure guest portal login. |
| `guests` | Technical: guest/customer entity. Business: stores guest identity and contact profiles. |
| `hotel_faqs` | Technical: FAQ knowledge entity. Business: answers common guest questions. |
| `hotel_holidays` | Technical: holiday calendar table. Business: stores property-specific holidays for attendance and scheduling. |
| `hotel_languages` | Technical: localization configuration table. Business: stores supported and default hotel languages. |
| `hotel_secrets` | Technical: encrypted secret/config store. Business: stores API keys and hotel integration credentials. |
| `hotels` | Technical: tenant/property master entity. Business: stores each hotel/property profile. |
| `housekeeping_checklists` | Technical: checklist template table. Business: standardizes room and housekeeping task checks. |
| `housekeeping_schedules` | Technical: room cleaning schedule table. Business: plans housekeeping work by room and status. |
| `import_jobs` | Technical: asynchronous import job table. Business: tracks bulk data uploads and imports. |
| `inventory_items` | Technical: stock item entity. Business: tracks hotel inventory items and reorder levels. |
| `inventory_transactions` | Technical: stock movement ledger. Business: records stock in, stock out, and adjustments. |
| `invoices` | Technical: billing invoice entity. Business: tracks hotel subscription invoices. |
| `job_executions` | Technical: background job run log. Business: monitors scheduled and asynchronous operations. |
| `knowledge_document_versions` | Technical: knowledge document version table. Business: tracks changes to hotel knowledge content. |
| `knowledge_documents` | Technical: knowledge base document entity. Business: stores hotel policies, service notes, and AI reference content. |
| `knowledge_embeddings` | Technical: vector embedding store. Business: powers AI search and contextual answers. |
| `live_chat_sessions` | Technical: live-agent handoff session. Business: moves bot conversations to staff support. |
| `lost_found_items` | Technical: lost/found item entity. Business: manages guest lost-property records. |
| `maintenance_orders` | Technical: maintenance work order entity. Business: tracks room and property repair jobs. |
| `media_files` | Technical: uploaded file metadata table. Business: stores images and documents for tickets, guests, and operations. |
| `menu_categories` | Technical: menu taxonomy entity. Business: groups food and beverage items. |
| `menu_item_taxes` | Technical: menu-tax association table. Business: applies tax rules to menu items. |
| `menu_items` | Technical: sellable menu item entity. Business: stores food and beverage catalog items. |
| `mobile_chat_messages` | Technical: mobile chat persistence table. Business: stores app chat messages for staff and guests. |
| `notifications` | Technical: notification event table. Business: sends and records alerts to users. |
| `organization_hotels` | Technical: organization-hotel association table. Business: links hotels to an owning organization. |
| `organization_users` | Technical: organization-user association table. Business: links users to organization-level access. |
| `organizations` | Technical: organization/account entity. Business: groups hotels under a company or owner. |
| `payment_transactions` | Technical: gateway transaction log. Business: stores payment gateway attempts and statuses. |
| `payments` | Technical: payment record entity. Business: tracks guest payments against folios. |
| `permission_groups` | Technical: permission module grouping. Business: groups access rules by feature area. |
| `permissions` | Technical: RBAC permission entity. Business: controls allowed actions in the platform. |
| `plan_features` | Technical: plan-feature mapping table. Business: maps subscription plans to enabled features. |
| `platform_admins` | Technical: platform admin user table. Business: manages super-admin access. |
| `platform_settings` | Technical: global settings key-value table. Business: controls platform-wide configuration. |
| `purchase_order_items` | Technical: purchase order line item table. Business: stores purchased inventory items and quantities. |
| `purchase_orders` | Technical: procurement order entity. Business: manages purchasing from vendors. |
| `rate_plan_periods` | Technical: date-bound rate rule table. Business: stores seasonal or period-based room prices. |
| `rate_plans` | Technical: pricing plan entity. Business: manages room/package pricing. |
| `refunds` | Technical: refund record entity. Business: tracks money returned to guests. |
| `reservation_guests` | Technical: reservation-guest mapping table. Business: supports multiple guests per booking. |
| `reservation_room_types` | Technical: reservation-room-type mapping table. Business: stores booked room categories and counts. |
| `reservations` | Technical: booking entity. Business: manages room bookings and reservation lifecycle. |
| `restaurant_order_items` | Technical: restaurant order line item table. Business: stores ordered dishes and quantities. |
| `restaurant_orders` | Technical: food order entity. Business: tracks restaurant and room-service orders. |
| `restaurant_tables` | Technical: dining table entity. Business: manages restaurant seating. |
| `role_permissions` | Technical: role-permission association table. Business: assigns permissions to roles. |
| `roles` | Technical: RBAC role entity. Business: defines job and access roles. |
| `room_blocks` | Technical: availability blocking table. Business: blocks rooms for maintenance, renovation, or manual holds. |
| `room_types` | Technical: room category entity. Business: represents Deluxe, Suite, Dorm, and other room types. |
| `rooms` | Technical: room inventory entity. Business: manages physical hotel rooms. |
| `routing_rules` | Technical: task routing rule entity. Business: automatically routes work to departments or staff. |
| `service_form_fields` | Technical: dynamic form field definition. Business: defines fields shown on custom service forms. |
| `service_forms` | Technical: dynamic service form definition. Business: supports custom guest request forms. |
| `shift_templates` | Technical: reusable shift template. Business: standardizes recurring shift patterns. |
| `stay_records` | Technical: actual stay/check-in record. Business: tracks guest stay history and room occupancy. |
| `subscriptions` | Technical: hotel subscription entity. Business: manages SaaS plan subscription state. |
| `task_type_slas` | Technical: SLA configuration table. Business: defines response and resolution targets by task type. |
| `tax_configs` | Technical: tax rule configuration. Business: stores GST, service tax, and local tax setup. |
| `ticket_acceptances` | Technical: assignment acceptance record. Business: tracks staff acceptance or rejection of offered tasks. |
| `ticket_categories` | Technical: ticket taxonomy entity. Business: classifies requests by service type. |
| `ticket_events` | Technical: ticket event log. Business: tracks ticket lifecycle changes and audit history. |
| `ticket_menu_items` | Technical: ticket-menu association table. Business: links food order items to service tickets. |
| `ticket_messages` | Technical: ticket communication log. Business: stores messages attached to service requests. |
| `tickets` | Technical: service request/task entity. Business: tracks guest and staff issues through completion. |
| `usage_limits` | Technical: quota/limit table. Business: controls subscription plan usage caps. |
| `user_roles` | Technical: user-role association table. Business: assigns roles to users. |
| `user_sessions` | Technical: refresh/session token store. Business: manages logged-in sessions. |
| `users` | Technical: authenticated user entity. Business: stores staff and admin login accounts. |
| `vendors` | Technical: supplier master entity. Business: stores vendor and supplier details. |
| `whatsapp_account_health` | Technical: integration health status table. Business: monitors WhatsApp connectivity and account health. |
| `whatsapp_accounts` | Technical: WhatsApp Business account configuration. Business: connects hotel WhatsApp numbers. |
| `whatsapp_conversations` | Technical: conversation thread entity. Business: stores guest WhatsApp chat history. |
| `whatsapp_messages` | Technical: message event table. Business: stores inbound and outbound WhatsApp messages. |
| `whatsapp_sessions` | Technical: conversational session state table. Business: keeps guest chat context active. |
| `whatsapp_templates` | Technical: message template entity. Business: stores approved WhatsApp templates. |
| `whatsapp_usage` | Technical: messaging usage aggregate. Business: tracks WhatsApp billing and limits. |
| `workflow_definitions` | Technical: workflow template entity. Business: defines hotel process flows. |
| `workflow_states` | Technical: workflow state entity. Business: stores task and process statuses. |
| `workflow_transitions` | Technical: workflow transition table. Business: controls allowed status changes. |
