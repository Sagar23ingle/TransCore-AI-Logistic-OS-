// Application roles — mirrors the app_role enum in the database.
export const APP_ROLES = ["super_admin", "fleet_owner", "driver", "broker"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  fleet_owner: "Fleet Owner",
  driver: "Driver",
  broker: "Broker",
};

export function isAdmin(roles: AppRole[] | null | undefined): boolean {
  return !!roles?.includes("super_admin");
}

export function canManageFleet(roles: AppRole[] | null | undefined): boolean {
  return !!roles?.some((r) => r === "super_admin" || r === "fleet_owner");
}

export function isDriverOnly(roles: AppRole[] | null | undefined): boolean {
  return !!roles && roles.length > 0 && roles.every((r) => r === "driver");
}
