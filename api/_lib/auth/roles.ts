import type { DbRole } from "./types.js";

/** Legacy `admin` accepted until old JWTs expire. */
export function isCheckerRole(role: string): boolean {
  return role === "checker" || role === "admin";
}

export function normalizeDbRole(role: string): DbRole {
  if (role === "admin" || role === "checker") return "checker";
  if (role === "super_admin") return "super_admin";
  return "employee";
}

export function parseDbRoleInput(raw: unknown): DbRole {
  if (raw === "super_admin") return "super_admin";
  if (raw === "checker" || raw === "admin") return "checker";
  return "employee";
}
