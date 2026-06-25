import { normalizeEmployeeId } from "../employees/normalize-id.js";

/** CSV row for org chart import */

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

export interface OrgParseResult {
  rows: OrgRow[];
  errors: OrgRowError[];
}

const HEADERS = ["employee_id", "name", "position", "department", "manager_id"] as const;

/** Parse a single CSV line respecting quoted fields */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseOrgCsv(text: string): OrgParseResult {
  const errors: OrgRowError[] = [];
  const rows: OrgRow[] = [];

  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    errors.push({ row: 0, employee_id: "", message: "ไฟล์ว่างเปล่า" });
    return { rows, errors };
  }

  const headerCells = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const colIndex = new Map<string, number>();
  headerCells.forEach((h, i) => colIndex.set(h, i));

  for (const h of HEADERS) {
    if (!colIndex.has(h)) {
      errors.push({ row: 1, employee_id: "", message: `ไม่พบคอลัมน์ "${h}" ใน header` });
      return { rows, errors };
    }
  }

  const seenIds = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const cells = parseCsvLine(lines[i]);
    const get = (key: typeof HEADERS[number]) => cells[colIndex.get(key)!] ?? "";

    const employee_id = normalizeEmployeeId(get("employee_id"));
    const name = get("name").trim();
    const position = get("position").trim();
    const department = get("department").trim();
    const managerRaw = get("manager_id").trim();
    const manager_id = managerRaw ? normalizeEmployeeId(managerRaw) : null;

    if (!employee_id) {
      errors.push({ row: lineNum, employee_id: "", message: "ไม่มีรหัสพนักงาน" });
      continue;
    }
    if (!name) {
      errors.push({ row: lineNum, employee_id, message: "ไม่มีชื่อ" });
      continue;
    }
    if (seenIds.has(employee_id)) {
      errors.push({ row: lineNum, employee_id, message: "รหัสพนักงานซ้ำในไฟล์" });
      continue;
    }
    seenIds.add(employee_id);

    rows.push({ employee_id, name, position, department, manager_id });
  }

  return { rows, errors };
}

/** Validate manager references and circular reporting */
export function validateOrgRows(rows: OrgRow[], existingIds: Set<string> = new Set()): OrgRowError[] {
  const errors: OrgRowError[] = [];
  const ids = new Set([
    ...[...existingIds].map(normalizeEmployeeId),
    ...rows.map((r) => r.employee_id),
  ]);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2;
    if (row.manager_id) {
      if (row.manager_id === row.employee_id) {
        errors.push({ row: lineNum, employee_id: row.employee_id, message: "หัวหน้าเป็นตัวเองไม่ได้" });
      } else if (!ids.has(row.manager_id)) {
        errors.push({
          row: lineNum,
          employee_id: row.employee_id,
          message: `ไม่พบ manager_id "${row.manager_id}" ในไฟล์หรือระบบ`,
        });
      }
    }
  }

  // Detect cycles via DFS
  const managers = new Map<string, string | null>();
  for (const r of rows) managers.set(r.employee_id, r.manager_id);

  function hasCycle(start: string): boolean {
    const visited = new Set<string>();
    let cur: string | null = start;
    while (cur) {
      if (visited.has(cur)) return true;
      visited.add(cur);
      cur = managers.get(cur) ?? null;
    }
    return false;
  }

  for (const r of rows) {
    if (hasCycle(r.employee_id)) {
      errors.push({
        row: rows.indexOf(r) + 2,
        employee_id: r.employee_id,
        message: "พบสายบังคับบัญชาวนกลับ (circular reference)",
      });
      break;
    }
  }

  return errors;
}

/** Sort so managers are upserted before their reports (same statement FK-safe) */
export function sortOrgForUpsert(rows: OrgRow[]): OrgRow[] {
  const byId = new Map(rows.map((r) => [r.employee_id, r]));
  const sorted: OrgRow[] = [];
  const done = new Set<string>();

  function visit(id: string) {
    if (done.has(id)) return;
    const row = byId.get(id);
    if (!row) return;
    if (row.manager_id && byId.has(row.manager_id)) visit(row.manager_id);
    done.add(id);
    sorted.push(row);
  }

  for (const r of rows) visit(r.employee_id);
  return sorted;
}
