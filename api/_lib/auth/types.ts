/** Shared types between API handlers */

export type DbRole = "employee" | "super_admin";

export interface DbEmployee {
  employee_id: string;
  name: string;
  position: string;
  department: string;
  manager_id: string | null;
  role: DbRole;
  is_active: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  position: string;
  department: string;
  managerId: string | null;
  role: DbRole;
}

export interface JwtPayload {
  sub: string;
  name: string;
  position: string;
  department: string;
  managerId: string | null;
  role: DbRole;
  isLead: boolean;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  isLead: boolean;
  isSuperAdmin: boolean;
}

export interface MeResponse {
  user: AuthUser;
  isLead: boolean;
  isSuperAdmin: boolean;
}
