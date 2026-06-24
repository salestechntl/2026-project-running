import type { LoginResponse, MeResponse, HomeStats, OrgImportBatch, OrgImportResponse } from "./auth-types";
import type { EmployeeRecord } from "./employee-admin";
import type { RunEntry, WeightEntry, EntryStatus } from "./store";
import type { Employee } from "./types";

const TOKEN_KEY = "rc2026.token";

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export class ApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

async function parseApiError(res: Response): Promise<ApiError> {
  try {
    const data = (await res.json()) as { error?: string; code?: string };
    return new ApiError(data.error ?? `Request failed (${res.status})`, data.code);
  } catch {
    return new ApiError(`Request failed (${res.status})`);
  }
}

export async function apiLogin(employeeId: string, password: string): Promise<LoginResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employee_id: employeeId, password }),
  });
  if (!res.ok) throw await parseApiError(res);
  return res.json() as Promise<LoginResponse>;
}

export async function apiSetPassword(employeeId: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "set_password", employee_id: employeeId, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function apiMe(): Promise<MeResponse> {
  const res = await fetch("/api/auth/me", { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<MeResponse>;
}

export async function apiFetchHomeStats(): Promise<HomeStats> {
  const res = await fetch("/api/auth/me?include=home", { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as MeResponse;
  if (!data.home) throw new Error("ไม่สามารถโหลดสถิติหน้าแรกได้");
  return data.home;
}

export async function apiOrgImport(
  mode: "preview" | "commit",
  fileName: string,
  csv: string,
): Promise<OrgImportResponse> {
  const res = await fetch("/api/org/import", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ mode, file_name: fileName, csv }),
  });
  const data = (await res.json()) as OrgImportResponse & { error?: string };
  if (!res.ok) {
    if (data.errors?.length) return data;
    throw new Error(data.error ?? await parseError(res));
  }
  return data;
}

export async function apiOrgBatches(): Promise<OrgImportBatch[]> {
  const res = await fetch("/api/org/batches", { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { batches: OrgImportBatch[] };
  return data.batches;
}

export async function apiFetchRuns(employeeId?: string): Promise<RunEntry[]> {
  const q = employeeId ? `?employee_id=${encodeURIComponent(employeeId)}` : "";
  const res = await fetch(`/api/runs${q}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { runs: RunEntry[] };
  return data.runs;
}

export async function apiSaveRun(
  entry: Omit<RunEntry, "id" | "createdAt" | "updatedAt" | "status"> & {
    id?: string;
    status?: EntryStatus;
    stravaImageRefs?: (string | undefined)[];
  },
): Promise<RunEntry> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { run: RunEntry };
  return data.run;
}

/** บันทึกเฉพาะข้อมูลการวิ่ง (ยังไม่อัปโหลดรูป) */
export async function apiSaveRunRecord(
  entry: Omit<RunEntry, "id" | "createdAt" | "updatedAt" | "status"> & {
    id?: string;
    status?: EntryStatus;
    stravaImageRefs?: (string | undefined)[];
  },
): Promise<RunEntry> {
  const res = await fetch("/api/runs", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ ...entry, skipImages: true }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { run: RunEntry };
  return data.run;
}

/** อัปโหลดรูปภาพของรายการวิ่ง (ขั้นตอนที่ 2) */
export async function apiUploadRunImages(
  id: string,
  stravaImages: string[],
  stravaImageRefs?: string[],
): Promise<RunEntry> {
  const res = await fetch(`/api/runs/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ stravaImages, stravaImageRefs }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { run: RunEntry };
  return data.run;
}

export async function apiDeleteRun(id: string): Promise<void> {
  const res = await fetch(`/api/runs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function apiSetRunStatus(id: string, status: EntryStatus, rejectNote?: string): Promise<RunEntry> {
  const res = await fetch(`/api/runs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status, rejectNote }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { run: RunEntry };
  return data.run;
}

export async function apiStaffEditRun(
  id: string,
  body: {
    date: string;
    runType: RunEntry["runType"];
    distanceKm: number;
    durationSec: number;
    note?: string;
    missionMonth?: string;
    status: EntryStatus;
    rejectNote?: string;
  },
): Promise<RunEntry> {
  const res = await fetch(`/api/runs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({
      staffEdit: true,
      date: body.date,
      runType: body.runType,
      distanceKm: body.distanceKm,
      durationSec: body.durationSec,
      note: body.note,
      missionMonth: body.missionMonth,
      status: body.status,
      rejectNote: body.rejectNote,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { run: RunEntry };
  return data.run;
}

export async function apiFetchWeights(employeeId?: string): Promise<WeightEntry[]> {
  const q = employeeId ? `?employee_id=${encodeURIComponent(employeeId)}` : "";
  const res = await fetch(`/api/weights${q}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { weights: WeightEntry[] };
  return data.weights;
}

export async function apiSaveWeight(
  entry: Omit<WeightEntry, "id" | "createdAt" | "updatedAt" | "status"> & {
    id?: string;
    status?: EntryStatus;
    proofImageRef?: string;
  },
): Promise<WeightEntry> {
  const res = await fetch("/api/weights", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { weight: WeightEntry };
  return data.weight;
}

export async function apiSetWeightStatus(id: string, status: EntryStatus, rejectNote?: string): Promise<WeightEntry> {
  const res = await fetch(`/api/weights/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ status, rejectNote }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { weight: WeightEntry };
  return data.weight;
}

export async function apiStaffEditWeight(
  id: string,
  body: {
    weightKg: number;
    status: EntryStatus;
    rejectNote?: string;
  },
): Promise<WeightEntry> {
  const res = await fetch(`/api/weights/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({
      staffEdit: true,
      weightKg: body.weightKg,
      status: body.status,
      rejectNote: body.rejectNote,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { weight: WeightEntry };
  return data.weight;
}

export async function apiFetchSubordinates(): Promise<Employee[]> {
  const res = await fetch("/api/team/subordinates", { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { team: Employee[] };
  return data.team;
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="?([^";\n]+)"?/i.exec(header);
  return match?.[1] ?? fallback;
}

/** ดาวน์โหลด CSV export (Super Admin) — คืนชื่อไฟล์ที่บันทึก */
export async function downloadExportCsv(kind: "runs" | "weights"): Promise<string> {
  const res = await fetch(`/api/export/${kind}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  const fallback = kind === "runs" ? "run_entries.csv" : "weight_entries.csv";
  const filename = filenameFromDisposition(res.headers.get("Content-Disposition"), fallback);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}

export async function apiFetchEmployees(): Promise<EmployeeRecord[]> {
  const res = await fetch("/api/employees", { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { employees: EmployeeRecord[] };
  return data.employees;
}

export async function apiCreateEmployee(
  employee: Omit<EmployeeRecord, "createdAt" | "updatedAt" | "hasPassword">,
): Promise<EmployeeRecord> {
  const res = await fetch("/api/employees", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(employee),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { employee: EmployeeRecord };
  return data.employee;
}

export async function apiUpdateEmployee(
  employeeId: string,
  patch: Omit<EmployeeRecord, "employeeId" | "createdAt" | "updatedAt" | "hasPassword">,
): Promise<EmployeeRecord> {
  const res = await fetch("/api/employees", {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ employeeId, ...patch }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { employee: EmployeeRecord };
  return data.employee;
}

export async function apiDeleteEmployee(employeeId: string): Promise<void> {
  const res = await fetch(`/api/employees?employee_id=${encodeURIComponent(employeeId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function apiResetEmployeePassword(employeeId: string, password: string): Promise<EmployeeRecord> {
  const res = await fetch("/api/employees", {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ employeeId, resetPassword: password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { employee: EmployeeRecord };
  return data.employee;
}
