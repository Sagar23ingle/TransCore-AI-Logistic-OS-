// Application roles — mirrors the app_role enum in the database.
export const APP_ROLES = ["super_admin", "fleet_owner", "fleet_manager", "driver", "broker"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  fleet_owner: "Fleet Owner",
  fleet_manager: "Fleet Manager",
  driver: "Driver",
  broker: "Broker",
};

// Company-scoped role — mirrors public.company_role enum.
export const COMPANY_ROLES = ["owner", "manager", "driver", "broker", "viewer"] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

export const COMPANY_ROLE_LABELS: Record<CompanyRole, string> = {
  owner: "Owner",
  manager: "Manager",
  driver: "Driver",
  broker: "Broker",
  viewer: "Viewer",
};

export function isAdmin(roles: AppRole[] | null | undefined): boolean {
  return !!roles?.includes("super_admin");
}

export function canManageFleet(roles: AppRole[] | null | undefined): boolean {
  return !!roles?.some((r) => r === "super_admin" || r === "fleet_owner" || r === "fleet_manager");
}

export function isDriverOnly(roles: AppRole[] | null | undefined): boolean {
  return !!roles && roles.length > 0 && roles.every((r) => r === "driver");
}

export function canWriteCompany(role: CompanyRole | null | undefined): boolean {
  return role === "owner" || role === "manager";
}
