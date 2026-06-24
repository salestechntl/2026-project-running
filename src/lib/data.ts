/**
 * Organisation + reference data.
 *
 * In production this table is populated by the RPA job that reads the HR
 * database ("who reports to whom") and uploads it into the app's data source
 * (e.g. Supabase / Google Sheet). Here we ship a representative sample so the
 * UI is fully demoable. Shape matches the planned `employees` table:
 *
 *   employee_id | name | position | department | manager_id
 *
 * Login uses `employee_id`. A user with at least one direct report is treated
 * as a team lead and sees the Admin menu (4.3).
 */

import type { Employee } from "./types";

export type { Employee };

export const EMPLOYEES: Employee[] = [
  { id: "10001", name: "ปวริศา ทองดี", position: "ผู้อำนวยการฝ่าย", department: "People & Culture", managerId: null, role: "super_admin" },
  { id: "10002", name: "ธนกฤต ศรีสุข", position: "ผู้จัดการทีม", department: "People & Culture", managerId: "10001" },
  { id: "10010", name: "ณัฐวุฒิ พิพัฒน์", position: "เจ้าหน้าที่อาวุโส", department: "People & Culture", managerId: "10002" },
  { id: "10011", name: "สิริกร วงศ์ไทย", position: "เจ้าหน้าที่", department: "People & Culture", managerId: "10002" },
  { id: "10012", name: "ภูริช เจริญพร", position: "เจ้าหน้าที่", department: "People & Culture", managerId: "10002" },
  { id: "10013", name: "อารยา สุวรรณ", position: "เจ้าหน้าที่", department: "People & Culture", managerId: "10002" },
  { id: "10003", name: "กิตติพงศ์ มั่นคง", position: "ผู้จัดการทีม", department: "Operations", managerId: "10001" },
  { id: "10020", name: "ชนิกานต์ แก้วใส", position: "เจ้าหน้าที่อาวุโส", department: "Operations", managerId: "10003" },
  { id: "10021", name: "ดนัย รัตนชัย", position: "เจ้าหน้าที่", department: "Operations", managerId: "10003" },
  { id: "10022", name: "พิมพ์ชนก ใจดี", position: "เจ้าหน้าที่", department: "Operations", managerId: "10003" },
];

const byId = new Map(EMPLOYEES.map((e) => [e.id, e]));

export function findEmployee(id: string): Employee | undefined {
  return byId.get(id.trim());
}

export function directReports(managerId: string): Employee[] {
  return EMPLOYEES.filter((e) => e.managerId === managerId);
}

export function isTeamLead(id: string): boolean {
  return directReports(id).length > 0;
}

export function isSuperAdmin(emp: Employee): boolean {
  return emp.role === "super_admin";
}

export function isOrgAdmin(emp: Pick<Employee, "role">): boolean {
  return emp.role === "admin";
}

/** ลูกทีมทั้งสายงาน หรือทั้งองค์กรสำหรับ role admin */
export function teamRoster(actorId: string): Employee[] {
  const emp = findEmployee(actorId);
  if (emp && isOrgAdmin(emp)) {
    return EMPLOYEES.filter((e) => e.id !== actorId).sort((a, b) => a.name.localeCompare(b.name, "th"));
  }
  return subordinates(actorId);
}

/** ลูกทีมทั้งสายงาน (recursive) */
export function subordinates(id: string): Employee[] {
  const out: Employee[] = [];
  const visit = (managerId: string) => {
    for (const e of EMPLOYEES) {
      if (e.managerId === managerId) {
        out.push(e);
        visit(e.id);
      }
    }
  };
  visit(id);
  return out;
}

export function managerName(managerId: string | null): string | null {
  if (!managerId) return null;
  return byId.get(managerId)?.name ?? null;
}

/* ภารกิจรายเดือน (mission) ถูกย้ายไปไฟล์ src/lib/missions.ts */

/** Replace with your published Tableau dashboard URL. */
export const TABLEAU_URL =
  "https://public.tableau.com/views/RunningCamp2026/Dashboard";
