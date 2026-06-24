/** API response types (mirrors api/_lib/auth/types.ts) */

export type DbRole = "employee" | "admin" | "super_admin";

export interface AuthUser {
  id: string;
  name: string;
  position: string;
  department: string;
  managerId: string | null;
  role: DbRole;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  isLead: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface MeResponse {
  user: AuthUser;
  isLead: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  home?: HomeStats;
}

export interface HomeStats {
  monthKey: string;
  totalKm: number;
  monthKm: number;
  approvedRunCount: number;
  monthRunCount: number;
  weightStartDone: boolean;
  weightEndDone: boolean;
  teamCount: number;
}

export interface OrgRow {
  employee_id: string;
  name: string;
  position: string;
  department: string;
  manager_id: string | null;
}

export interface OrgRowError {
  row: number;
  employee_id: string;
  message: string;
}

export interface OrgImportSummary {
  upsert: number;
  deactivate: number;
  new: number;
}

export interface OrgImportResponse {
  ok: boolean;
  mode: "preview" | "commit";
  file_name: string;
  row_count: number;
  error_count: number;
  errors?: OrgRowError[];
  rows?: OrgRow[];
  summary?: OrgImportSummary;
  deactivate_ids?: string[];
  batch_id?: string;
  message?: string;
}

export interface OrgImportBatch {
  id: string;
  uploaded_by: string;
  file_name: string;
  row_count: number;
  error_count: number;
  status: "preview" | "committed" | "failed";
  uploaded_at: string;
}
