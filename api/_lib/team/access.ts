import type { SupabaseClient } from "@supabase/supabase-js";

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

export async function getSubordinateIds(supabase: SupabaseClient, managerId: string): Promise<Set<string>> {
  const rows = await fetchActiveEmployees(supabase);
  return new Set(subordinatesFromRows(managerId, rows).map((e) => e.id));
}

export async function canAccessEmployee(
  supabase: SupabaseClient,
  actorId: string,
  targetId: string,
  isLead: boolean,
): Promise<boolean> {
  if (actorId === targetId) return true;
  if (!isLead) return false;
  const subs = await getSubordinateIds(supabase, actorId);
  return subs.has(targetId);
}
