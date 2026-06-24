import type { SupabaseClient } from "@supabase/supabase-js";
import type { DbRole, JwtPayload } from "../auth/types.js";

export interface TeamEmployee {
  id: string;
  name: string;
  position: string;
  department: string;
  managerId: string | null;
}

export interface DbEmployeeRow {
  employee_id: string;
  name: string;
  position: string;
  department: string;
  manager_id: string | null;
  is_active: boolean;
}

export type AccessActor = Pick<JwtPayload, "sub" | "isLead" | "role">;

export function isOrgAdmin(role: DbRole): boolean {
  return role === "admin";
}

export function isSuperAdminRole(role: DbRole): boolean {
  return role === "super_admin";
}

export function canApproveEntries(actor: Pick<JwtPayload, "isLead" | "role">): boolean {
  return actor.isLead || isOrgAdmin(actor.role);
}

/** หัวหน้าทีม + Admin — ไม่ผ่านรายการรออนุมัติ */
export function canRejectPending(actor: Pick<JwtPayload, "isLead" | "role">): boolean {
  return canApproveEntries(actor);
}

/** Admin เท่านั้น — ไม่ผ่านรายการที่อนุมัติแล้ว */
export function canRejectApproved(actor: Pick<JwtPayload, "role">): boolean {
  return isOrgAdmin(actor.role) || isSuperAdminRole(actor.role);
}

/** Admin / Super Admin — แก้ไขรายการที่ไม่ผ่านในหน้าทีม */
export function canEditRejectedEntry(actor: Pick<JwtPayload, "role">): boolean {
  return isOrgAdmin(actor.role) || isSuperAdminRole(actor.role);
}

export function canSelfApprove(actor: Pick<JwtPayload, "isLead" | "role">, employeeId: string, actorId: string): boolean {
  return employeeId === actorId && canApproveEntries(actor);
}

export async function fetchActiveEmployees(supabase: SupabaseClient): Promise<DbEmployeeRow[]> {
  const { data, error } = await supabase
    .from("employees")
    .select("employee_id, name, position, department, manager_id, is_active")
    .eq("is_active", true);

  if (error) throw error;
  return (data ?? []) as DbEmployeeRow[];
}

export function toEmployee(row: DbEmployeeRow): TeamEmployee {
  return {
    id: row.employee_id,
    name: row.name,
    position: row.position,
    department: row.department,
    managerId: row.manager_id,
  };
}

/** ลูกทีมทั้งสายงาน (recursive) */
export function subordinatesFromRows(managerId: string, rows: DbEmployeeRow[]): TeamEmployee[] {
  const out: TeamEmployee[] = [];
  const visit = (id: string) => {
    for (const row of rows) {
      if (row.manager_id === id) {
        out.push(toEmployee(row));
        visit(row.employee_id);
      }
    }
  };
  visit(managerId);
  return out;
}

/** พนักงาน active ทั้งองค์กร (ยกเว้นตัวเอง) — สำหรับ role admin */
export function allEmployeesExcept(actorId: string, rows: DbEmployeeRow[]): TeamEmployee[] {
  return rows
    .filter((row) => row.employee_id !== actorId)
    .map(toEmployee)
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

export async function getSubordinateIds(supabase: SupabaseClient, managerId: string): Promise<Set<string>> {
  const rows = await fetchActiveEmployees(supabase);
  return new Set(subordinatesFromRows(managerId, rows).map((e) => e.id));
}

export async function canAccessEmployee(
  supabase: SupabaseClient,
  actorId: string,
  targetId: string,
  actor: Pick<JwtPayload, "isLead" | "role">,
): Promise<boolean> {
  if (actorId === targetId) return true;
  if (isOrgAdmin(actor.role)) return true;
  if (!actor.isLead) return false;
  const subs = await getSubordinateIds(supabase, actorId);
  return subs.has(targetId);
}
