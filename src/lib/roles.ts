import type { DbRole } from "./auth-types";

/** Legacy `admin` accepted for in-flight sessions during deploy. */
export function isCheckerRole(role: string): boolean {
  return role === "checker" || role === "admin";
}

export function normalizeDbRole(role: string): DbRole {
  if (role === "admin" || role === "checker") return "checker";
  if (role === "super_admin") return "super_admin";
  return "employee";
}
