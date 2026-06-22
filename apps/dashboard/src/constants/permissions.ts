export const Permissions = {
  TICKET_VIEW: "ticket.view",
  TICKET_VIEW_OWN: "ticket.view_own",
  TICKET_VIEW_DEPT: "ticket.view_dept",
  TICKET_VIEW_ALL: "ticket.view_all",
  TICKET_CREATE: "ticket.create",
  TICKET_ASSIGN: "ticket.assign",
  TICKET_ACCEPT: "ticket.accept",
  TICKET_REJECT: "ticket.reject",
  TICKET_COMPLETE_OWN: "ticket.complete_own",
  TICKET_CLOSE: "ticket.close",
  TICKET_DELETE: "ticket.delete",
  TICKET_APPROVE: "ticket.approve",
  TICKET_VERIFY: "ticket.verify",

  ROOM_VIEW: "room.view",
  ROOM_CREATE: "room.create",
  ROOM_UPDATE: "room.update",
  ROOM_DELETE: "room.delete",

  GUEST_VIEW: "guest.view",
  GUEST_VIEW_BASIC: "guest.view_basic",
  GUEST_VIEW_SENSITIVE: "guest.view_sensitive",
  GUEST_CREATE: "guest.create",
  GUEST_EDIT: "guest.edit",
  GUEST_CHECKOUT: "guest.checkout",

  RESERVATION_VIEW: "reservation.view",
  RESERVATION_CREATE: "reservation.create",
  RESERVATION_UPDATE: "reservation.update",
  RESERVATION_CANCEL: "reservation.cancel",
  RESERVATION_MANAGE: "reservation.manage",
  RESERVATION_CHECKOUT: "reservation.checkout",

  USER_VIEW: "user.view",
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_DELETE: "user.delete",
  USER_MANAGE: "user.manage",

  ROLE_VIEW: "role.view",
  ROLE_MANAGE: "role.manage",

  SHIFT_VIEW_OWN: "shift.view_own",
  SHIFT_VIEW_DEPT: "shift.view_dept",
  SHIFT_UPDATE_OWN: "shift.update_own",
  SHIFT_MANAGE: "shift.manage",

  MENU_VIEW: "menu.view",
  MENU_MANAGE: "menu.manage",

  BOT_VIEW: "bot.view",
  BOT_PUBLISH: "bot.publish",
  BOT_MANAGE: "bot.manage",

  CAMPAIGN_VIEW: "campaign.view",
  CAMPAIGN_CREATE: "campaign.create",
  CAMPAIGN_SEND: "campaign.send",

  HOTEL_SETTINGS_MANAGE: "hotel.settings.manage",
  HOTEL_BILLING_VIEW: "hotel.billing.view",
  ANALYTICS_VIEW: "analytics.view",
  ANALYTICS_EXPORT: "analytics.export",

  FOLIO_VIEW: "folio.view",
  FOLIO_MANAGE: "folio.manage",
  RATE_PLAN_MANAGE: "rate_plan.manage",
  HOUSEKEEPING_MANAGE: "housekeeping.manage",
  MAINTENANCE_MANAGE: "maintenance.manage",
  LOST_FOUND_MANAGE: "lost_found.manage",
  WHATSAPP_HEALTH_VIEW: "whatsapp.health.view",
  LIVE_CHAT_MANAGE: "live_chat.manage",
  ORGANIZATION_MANAGE: "organization.manage",
  INVENTORY_MANAGE: "inventory.manage",
  RESTAURANT_MANAGE: "restaurant.manage",
  WORKFLOW_MANAGE: "workflow.manage",
  FEATURE_MANAGE: "feature.manage",
  MEDIA_MANAGE: "media.manage",
  MEDIA_UPLOAD: "media.upload",
  MEDIA_DELETE: "media.delete",
  BILLING_VIEW: "billing.view",
} as const;

export type PermissionCode = (typeof Permissions)[keyof typeof Permissions];

export const ticketViewPermissions = [
  Permissions.TICKET_VIEW,
  Permissions.TICKET_VIEW_OWN,
  Permissions.TICKET_VIEW_DEPT,
  Permissions.TICKET_VIEW_ALL,
];
