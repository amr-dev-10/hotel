import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";

import { Permissions, shiftViewPermissions, ticketViewPermissions } from "@/constants/permissions";
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
  | "approve"
  | "delete"
  | "export";

export type AppSubject =
  | "all"
  | "AI"
  | "Analytics"
  | "Guest"
  | "Hierarchy"
  | "Housekeeping"
  | "HotelSettings"
  | "Reservation"
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

  const permissions = new Set(user.permissions ?? []);

  if (ticketViewPermissions.some((permission) => permissions.has(permission))) {
    can("view", "Ticket");
  }
  grant(permissions, Permissions.TICKET_CREATE, () => can("create", "Ticket"));
  grant(permissions, Permissions.TICKET_ASSIGN, () => can(["assign", "edit"], "Ticket"));
  grant(permissions, Permissions.TICKET_ACCEPT, () => can("accept", "Ticket"));
  grant(permissions, Permissions.TICKET_REJECT, () => can("reject", "Ticket"));
  grant(permissions, Permissions.TICKET_COMPLETE_OWN, () => can("complete", "Ticket"));
  grant(permissions, Permissions.TICKET_CLOSE, () => can("close", "Ticket"));
  grant(permissions, Permissions.TICKET_APPROVE, () => can("approve", "Ticket"));
  grant(permissions, Permissions.TICKET_DELETE, () => can("delete", "Ticket"));

  grant(permissions, Permissions.GUEST_VIEW, () => can("view", "Guest"));
  grant(permissions, Permissions.GUEST_VIEW_BASIC, () => can("view", "Guest"));
  grant(permissions, Permissions.GUEST_VIEW_SENSITIVE, () => can(["view", "viewSensitive"], "Guest"));
  grant(permissions, Permissions.GUEST_CREATE, () => can("create", "Guest"));
  grant(permissions, Permissions.GUEST_EDIT, () => can(["edit", "delete"], "Guest"));

  grant(permissions, Permissions.RESERVATION_VIEW, () => can("view", "Reservation"));
  grant(permissions, Permissions.RESERVATION_MANAGE, () => can(["view", "create", "edit"], "Reservation"));
  grant(permissions, Permissions.RESERVATION_CREATE, () => can("create", "Reservation"));
  grant(permissions, Permissions.RESERVATION_UPDATE, () => can("edit", "Reservation"));
  grant(permissions, Permissions.RESERVATION_CANCEL, () => can("delete", "Reservation"));

  grant(permissions, Permissions.ROOM_VIEW, () => can("view", "Room"));
  grant(permissions, Permissions.ROOM_CREATE, () => can("create", "Room"));
  grant(permissions, Permissions.ROOM_UPDATE, () => can("edit", "Room"));
  grant(permissions, Permissions.ROOM_DELETE, () => can("delete", "Room"));

  grant(permissions, Permissions.USER_VIEW, () => can(["view"], "Staff"));
  grant(permissions, Permissions.USER_VIEW, () => can(["view"], "User"));
  grant(permissions, Permissions.USER_CREATE, () => can("create", "Staff"));
  grant(permissions, Permissions.USER_UPDATE, () => can("edit", "Staff"));
  grant(permissions, Permissions.USER_DELETE, () => can("delete", "Staff"));
  grant(permissions, Permissions.USER_MANAGE, () => can(["view", "create", "edit", "delete"], "Staff"));
  grant(permissions, Permissions.STAFF_VIEW, () => can(["view"], "Staff"));
  grant(permissions, Permissions.STAFF_CREATE, () => can("create", "Staff"));
  grant(permissions, Permissions.STAFF_UPDATE, () => can("edit", "Staff"));
  grant(permissions, Permissions.STAFF_DELETE, () => can("delete", "Staff"));
  grant(permissions, Permissions.STAFF_MANAGE, () => can(["view", "create", "edit", "delete"], "Staff"));

  grant(permissions, Permissions.ROLE_VIEW, () => can("view", "Role"));
  grant(permissions, Permissions.ROLE_MANAGE, () => can("manage", "Role"));

  if (shiftViewPermissions.some((permission) => permissions.has(permission))) {
    can("view", "Shift");
  }
  grant(permissions, Permissions.SHIFT_UPDATE, () => can("edit", "Shift"));
  grant(permissions, Permissions.SHIFT_UPDATE_OWN, () => can("edit", "Shift"));
  grant(permissions, Permissions.SHIFT_MANAGE, () => can("manage", "Shift"));

  grant(permissions, Permissions.ANALYTICS_VIEW, () => can("view", "Analytics"));
  grant(permissions, Permissions.HOTEL_SETTINGS_MANAGE, () => can("manage", "HotelSettings"));
  grant(permissions, Permissions.WORKFLOW_MANAGE, () => can("manage", "Workflow"));
  grant(permissions, Permissions.BOT_VIEW, () => can("view", "AI"));
  grant(permissions, Permissions.BOT_MANAGE, () => can("manage", "AI"));
  grant(permissions, Permissions.WHATSAPP_HEALTH_VIEW, () => can("view", "WhatsApp"));
  grant(permissions, Permissions.LIVE_CHAT_MANAGE, () => can("manage", "WhatsApp"));
  grant(permissions, Permissions.HOUSEKEEPING_MANAGE, () => can("manage", "Housekeeping"));

  if (
    permissions.has(Permissions.USER_VIEW) ||
    permissions.has(Permissions.STAFF_VIEW) ||
    permissions.has(Permissions.TICKET_VIEW_DEPT) ||
    permissions.has(Permissions.TICKET_VIEW_ALL)
  ) {
    can("view", "Hierarchy");
  }

  return build();
}

function grant(permissions: Set<string>, permission: string, callback: () => void) {
  if (permissions.has(permission)) {
    callback();
  }
}
