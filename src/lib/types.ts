/** Shared domain types (frontend) */

export type UserRole = "employee" | "checker" | "super_admin";

export interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  managerId: string | null;
  role?: UserRole;
}
