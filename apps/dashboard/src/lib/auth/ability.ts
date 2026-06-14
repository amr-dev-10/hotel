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
  | "export";

export type AppSubject =
  | "all"
  | "Analytics"
  | "Housekeeping"
  | "Reservation"
  | "Room"
  | "Staff"
  | "Ticket";

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
    can(["view", "create", "edit"], "Housekeeping");
    can(["view", "edit"], "Reservation");
    can(["view", "edit"], "Room");
    can("view", "Analytics");
    can("view", "Staff");
  } else {
    can(["view", "accept", "create"], "Ticket");
    can(["view", "edit"], "Housekeeping");
    can("view", "Room");
    can("view", "Reservation");
  }

  return build();
}
