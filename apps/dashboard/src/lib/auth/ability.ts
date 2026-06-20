import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";

import type { CurrentUser } from "@/types/domain";

export type AppAction =
  | "manage"
  | "view"
  | "create"
  | "edit"
  | "accept"
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

  const role = user.job_role?.toLowerCase() ?? "";

  if (user.is_hotel_owner || role.includes("owner") || role.includes("manager")) {
    can("manage", "all");
  } else if (role.includes("supervisor")) {
    can(["view", "create", "accept", "assign", "approve"], "Ticket");
    can(["view", "create", "edit"], "Guest");
    can(["view", "create", "edit"], "Housekeeping");
    can(["view", "edit"], "Reservation");
    can(["view", "edit"], "Room");
    can("view", "Analytics");
    can("view", "Staff");
    can("view", "User");
    can("view", "Hierarchy");
    can("view", "WhatsApp");
  } else {
    can(["view", "accept", "create"], "Ticket");
    can("view", "Guest");
    can(["view", "edit"], "Housekeeping");
    can("view", "Room");
    can("view", "Reservation");
    can("view", "Hierarchy");
  }

  return build();
}
