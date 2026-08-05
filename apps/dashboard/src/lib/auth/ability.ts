import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";

import { Permissions, shiftViewPermissions, ticketViewPermissions } from "@/constants/permissions";
import { hasAnyPermission, hasPermission } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/types/domain";

export type AppAction =
  | "manage"
  | "view"
  | "viewSensitive"
  | "create"
  | "edit"
  | "accept"
  | "reject"
  | "complete"
  | "close"
  | "assign"
  | "assignSelf"
  | "approve"
  | "delete"
  | "export"
  | "publish"
  | "send"
  | "upload";

export type AppSubject =
  | "all"
  | "AI"
  | "Analytics"
  | "Billing"
  | "Campaign"
  | "Feature"
  | "Folio"
  | "Guest"
  | "Hierarchy"
  | "Housekeeping"
  | "HotelSettings"
  | "Inventory"
  | "LostFound"
  | "Maintenance"
  | "Media"
  | "Menu"
  | "Organization"
  | "RatePlan"
  | "Reservation"
  | "Restaurant"
  | "Role"
  | "Room"
  | "Shift"
  | "Staff"
  | "Ticket"
  | "User"
  | "WhatsApp"
  | "Workflow";

export type AppAbility = MongoAbility<[AppAction, AppSubject]>;

export function buildAbility(user: CurrentUser | null): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (!user) {
    return build();
  }

  if (user.is_hotel_owner) {
    can("manage", "all");
    return build();
  }

  if (hasAnyPermission(user, ticketViewPermissions)) {
    can("view", "Ticket");
  }
  grant(user, Permissions.TICKET_CREATE, () => can("create", "Ticket"));
  grant(user, Permissions.TICKET_UPDATE, () => can(["edit", "accept", "reject", "complete", "close", "approve"], "Ticket"));
  grant(user, Permissions.TICKET_ASSIGN_SELF, () => can("assignSelf", "Ticket"));
  grant(user, Permissions.TICKET_ASSIGN_OTHERS, () => can(["assign", "assignSelf"], "Ticket"));
  grant(user, Permissions.TICKET_DELETE, () => can("delete", "Ticket"));

  grant(user, Permissions.GUEST_VIEW, () => can("view", "Guest"));
  grant(user, Permissions.GUEST_VIEW_BASIC, () => can("view", "Guest"));
  grant(user, Permissions.GUEST_VIEW_SENSITIVE, () => can(["view", "viewSensitive"], "Guest"));
  grant(user, Permissions.GUEST_CREATE, () => can("create", "Guest"));
  grant(user, Permissions.GUEST_EDIT, () => can(["edit", "delete"], "Guest"));
  grant(user, Permissions.GUEST_CHECKOUT, () => can("edit", "Guest"));

  grant(user, Permissions.RESERVATION_VIEW, () => can("view", "Reservation"));
  grant(user, Permissions.RESERVATION_MANAGE, () => can(["view", "create", "edit"], "Reservation"));
  grant(user, Permissions.RESERVATION_CREATE, () => can("create", "Reservation"));
  grant(user, Permissions.RESERVATION_UPDATE, () => can("edit", "Reservation"));
  grant(user, Permissions.RESERVATION_CANCEL, () => can("delete", "Reservation"));
  grant(user, Permissions.RESERVATION_CHECKOUT, () => can("edit", "Reservation"));

  grant(user, Permissions.ROOM_VIEW, () => can("view", "Room"));
  grant(user, Permissions.ROOM_CREATE, () => can("create", "Room"));
  grant(user, Permissions.ROOM_UPDATE, () => can("edit", "Room"));
  grant(user, Permissions.ROOM_DELETE, () => can("delete", "Room"));

  grant(user, Permissions.USER_VIEW, () => can(["view"], "Staff"));
  grant(user, Permissions.USER_VIEW, () => can(["view"], "User"));
  grant(user, Permissions.USER_CREATE, () => can("create", "Staff"));
  grant(user, Permissions.USER_UPDATE, () => can("edit", "Staff"));
  grant(user, Permissions.USER_DELETE, () => can("delete", "Staff"));
  grant(user, Permissions.USER_MANAGE, () => can(["view", "create", "edit", "delete", "manage"], "Staff"));

  grant(user, Permissions.ROLE_VIEW, () => can("view", "Role"));
  grant(user, Permissions.ROLE_MANAGE, () => can(["view", "create", "edit", "delete", "manage"], "Role"));

  if (hasAnyPermission(user, shiftViewPermissions)) {
    can("view", "Shift");
  }
  grant(user, Permissions.SHIFT_UPDATE, () => can("edit", "Shift"));
  grant(user, Permissions.SHIFT_UPDATE_OWN, () => can("edit", "Shift"));
  grant(user, Permissions.SHIFT_MANAGE, () => can(["view", "edit", "manage"], "Shift"));

  grant(user, Permissions.MENU_VIEW, () => can("view", "Menu"));
  grant(user, Permissions.MENU_MANAGE, () => can("manage", "Menu"));
  grant(user, Permissions.BOT_VIEW, () => can("view", "AI"));
  grant(user, Permissions.BOT_PUBLISH, () => can("publish", "AI"));
  grant(user, Permissions.BOT_MANAGE, () => can("manage", "AI"));
  grant(user, Permissions.CAMPAIGN_VIEW, () => can("view", "Campaign"));
  grant(user, Permissions.CAMPAIGN_CREATE, () => can("create", "Campaign"));
  grant(user, Permissions.CAMPAIGN_SEND, () => can("send", "Campaign"));
  grant(user, Permissions.HOTEL_SETTINGS_MANAGE, () => can("manage", "HotelSettings"));
  grant(user, Permissions.HOTEL_BILLING_VIEW, () => can("view", "Billing"));
  grant(user, Permissions.ANALYTICS_VIEW, () => can("view", "Analytics"));
  grant(user, Permissions.ANALYTICS_EXPORT, () => can("export", "Analytics"));
  grant(user, Permissions.FOLIO_VIEW, () => can("view", "Folio"));
  grant(user, Permissions.FOLIO_MANAGE, () => can("manage", "Folio"));
  grant(user, Permissions.RATE_PLAN_MANAGE, () => can("manage", "RatePlan"));
  grant(user, Permissions.HOUSEKEEPING_MANAGE, () => can("manage", "Housekeeping"));
  grant(user, Permissions.MAINTENANCE_MANAGE, () => can("manage", "Maintenance"));
  grant(user, Permissions.LOST_FOUND_MANAGE, () => can("manage", "LostFound"));
  grant(user, Permissions.WHATSAPP_HEALTH_VIEW, () => can("view", "WhatsApp"));
  grant(user, Permissions.LIVE_CHAT_MANAGE, () => can("manage", "WhatsApp"));
  grant(user, Permissions.ORGANIZATION_MANAGE, () => can("manage", "Organization"));
  grant(user, Permissions.INVENTORY_MANAGE, () => can("manage", "Inventory"));
  grant(user, Permissions.RESTAURANT_MANAGE, () => can("manage", "Restaurant"));
  grant(user, Permissions.WORKFLOW_MANAGE, () => can("manage", "Workflow"));
  grant(user, Permissions.FEATURE_MANAGE, () => can("manage", "Feature"));
  grant(user, Permissions.MEDIA_MANAGE, () => can("manage", "Media"));
  grant(user, Permissions.MEDIA_UPLOAD, () => can("upload", "Media"));
  grant(user, Permissions.MEDIA_DELETE, () => can("delete", "Media"));
  grant(user, Permissions.BILLING_VIEW, () => can("view", "Billing"));

  if (
    hasPermission(user, Permissions.USER_VIEW) ||
    hasPermission(user, Permissions.STAFF_VIEW) ||
    hasPermission(user, Permissions.TICKET_VIEW_DEPT) ||
    hasPermission(user, Permissions.TICKET_VIEW_ALL)
  ) {
    can("view", "Hierarchy");
  }

  return build();
}

function grant(user: CurrentUser, permission: string, callback: () => void) {
  if (hasPermission(user, permission)) {
    callback();
  }
}
