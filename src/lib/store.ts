/**
 * Local submission store.
 *
 * Demo persistence via localStorage so the app is fully usable without a
 * backend. In production each `submit*` call becomes an HTTPS POST (JSON) to
 * the storage layer (Supabase / Sheet) per the architecture diagram; the RPA
 * job then reads rows where status = NEW.
 */

import { EMPLOYEES, findEmployee, isChecker, isTeamLead, subordinates } from "./data";
import { shouldExpirePendingMs } from "./expire";
import { currentMonthKey, monthOf, missionName, weightCanCreate, weightWindow, weightCanResubmitRejected } from "./missions";

/** สถานะการตรวจ: รออนุมัติ / อนุมัติแล้ว / ไม่ผ่าน / หมดอายุ */
export type EntryStatus = "pending" | "approved" | "rejected" | "expired";

export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่ผ่าน",
  expired: "หมดอายุ",
};

function resolveStatusForEmployee(employeeId: string, explicit?: EntryStatus): EntryStatus {
  if (explicit) return explicit;
  const emp = findEmployee(employeeId);
  return isTeamLead(employeeId) || (emp != null && isChecker(emp)) ? "approved" : "pending";
}

/** ประเภทการวิ่ง: วินัยการวิ่ง (ค่าเริ่มต้น) / ภารกิจประจำเดือน / วิ่งกับช่องทาง */
export type RunType = "discipline" | "mission" | "channel";

export const RUN_TYPES: RunType[] = ["discipline", "mission", "channel"];

export const RUN_TYPE_LABEL: Record<RunType, string> = {
  discipline: "วินัยการวิ่ง",
  mission: "ภารกิจประจำเดือน",
  channel: "วิ่งกับช่องทาง",
};

export function runTypeBadgeTone(runType: RunType): "info" | "accent" | "gold" {
  if (runType === "discipline") return "info";
  if (runType === "mission") return "accent";
  return "gold";
}

export interface RunEntry {
  id: string;
  employeeId: string;
  date: string; // yyyy-mm-dd
  runType: RunType;
  distanceKm: number;
  durationSec: number;
  missionTag: string; // คีย์เดือน "yyyy-mm" ของภารกิจ
  stravaImages?: string[]; // preview URLs (signed URL ใน API mode, data URL ใน demo)
  stravaImageRefs?: string[]; // storage paths สำหรับ round-trip ตอนแก้ไข (API mode)
  note?: string;
  status: EntryStatus;
  rejectNote?: string;
  staffEditNote?: string;
  createdAt: number;
  updatedAt: number;
}

export type WeightPeriod = "start" | "end";

export interface WeightEntry {
  id: string;
  employeeId: string;
  month: string; // yyyy-mm
  period: WeightPeriod;
  weightKg: number;
  proofImages?: string[];
  proofImageRefs?: string[];
  /** @deprecated first image — use proofImages */
  proofImage?: string;
  proofImageRef?: string;
  status: EntryStatus;
  rejectNote?: string;
  staffEditNote?: string;
  createdAt: number;
  updatedAt: number;
}

const RUN_KEY = "rc2026.runs";
const WEIGHT_KEY = "rc2026.weights";

function read<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") as T[];
  } catch {
    return [];
  }
}
function write<T>(key: string, rows: T[]) {
  localStorage.setItem(key, JSON.stringify(rows));
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${performance.now().toString(36).replace(".", "")}`;
}

function applyExpiryRuns(rows: RunEntry[]): RunEntry[] {
  const now = Date.now();
  let dirty = false;
  const next = rows.map((r) => {
    if (r.status === "pending" && shouldExpirePendingMs(r.createdAt, now)) {
      dirty = true;
      return { ...r, status: "expired" as const, updatedAt: now };
    }
    return r;
  });
  if (dirty) write(RUN_KEY, next);
  return next;
}

function applyExpiryWeights(rows: WeightEntry[]): WeightEntry[] {
  const now = Date.now();
  let dirty = false;
  const next = rows.map((w) => {
    if (w.status === "pending" && shouldExpirePendingMs(w.createdAt, now)) {
      dirty = true;
      return { ...w, status: "expired" as const, updatedAt: now };
    }
    return w;
  });
  if (dirty) write(WEIGHT_KEY, next);
  return next;
}

/* ---------- Runs ---------- */
export function getRuns(employeeId?: string): RunEntry[] {
  // เรียงตามวันที่วิ่งล่าสุดก่อน (วันเดียวกันใช้เวลาที่บันทึกล่าสุด)
  const rows = applyExpiryRuns(read<RunEntry>(RUN_KEY)).sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
  );
  return employeeId ? rows.filter((r) => r.employeeId === employeeId) : rows;
}

export function getRunsForTeam(employeeIds: string[]): RunEntry[] {
  const set = new Set(employeeIds);
  return applyExpiryRuns(read<RunEntry>(RUN_KEY))
    .filter((r) => set.has(r.employeeId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

type RunInput = Omit<RunEntry, "id" | "createdAt" | "updatedAt" | "status"> & {
  id?: string;
  status?: EntryStatus;
};

export function saveRun(entry: RunInput): RunEntry {
  const rows = read<RunEntry>(RUN_KEY);
  const status = resolveStatusForEmployee(entry.employeeId, entry.status);
  if (entry.id) {
    const idx = rows.findIndex((r) => r.id === entry.id);
    if (idx >= 0) {
      const cur = rows[idx];
      if (cur.status === "rejected") {
        throw new Error("รายการที่ไม่ผ่านแล้วแก้ไขไม่ได้ กรุณาส่งรายการใหม่");
      }
      if (cur.status === "expired") {
        throw new Error("รายการหมดอายุแล้ว กรุณาส่งรายการใหม่");
      }
      if (!isTeamLead(entry.employeeId) && cur.status !== "pending") {
        throw new Error("แก้ไขได้เฉพาะรายการที่รออนุมัติ");
      }
      rows[idx] = {
        ...rows[idx],
        ...entry,
        status,
        rejectNote: undefined,
        updatedAt: Date.now(),
      };
      write(RUN_KEY, rows);
      notifyDataChanged();
      return rows[idx];
    }
  }
  const now = Date.now();
  const created: RunEntry = {
    ...entry,
    status,
    id: uid("run"),
    createdAt: now,
    updatedAt: now,
  };
  rows.push(created);
  write(RUN_KEY, rows);
  notifyDataChanged();
  return created;
}

export function deleteRun(id: string) {
  const rows = read<RunEntry>(RUN_KEY);
  const row = rows.find((r) => r.id === id);
  if (!row || row.status !== "pending") return;
  write(
    RUN_KEY,
    rows.filter((r) => r.id !== id),
  );
  notifyDataChanged();
}

/** หัวหน้าอนุมัติ/ปฏิเสธรายการวิ่ง */
export function setRunStatus(id: string, status: EntryStatus, rejectNote?: string) {
  const rows = read<RunEntry>(RUN_KEY);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const cur = rows[idx];
  if (status === "approved" && cur.status !== "pending" && cur.status !== "expired") return;
  if (status === "rejected" && cur.status !== "pending" && cur.status !== "approved" && cur.status !== "expired") return;
  if (status === "rejected" && !rejectNote?.trim()) return;
  rows[idx] = {
    ...rows[idx],
    status,
    rejectNote: status === "rejected" ? rejectNote : undefined,
    updatedAt: Date.now(),
  };
  write(RUN_KEY, rows);
  notifyDataChanged();
}

/** Admin แก้ไขรายการวิ่ง (อนุมัติแล้ว / ไม่ผ่าน / หมดอายุ) */
export function staffEditRun(
  id: string,
  patch: {
    date: string;
    runType: RunType;
    distanceKm: number;
    durationSec: number;
    missionMonth?: string;
    status: "approved" | "rejected";
    rejectNote?: string;
    staffEditNote: string;
  },
): RunEntry {
  const rows = read<RunEntry>(RUN_KEY);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("ไม่พบรายการ");
  const cur = rows[idx];
  if (cur.status !== "approved" && cur.status !== "rejected" && cur.status !== "expired") {
    throw new Error("แก้ไขได้เฉพาะรายการที่อนุมัติแล้ว ไม่ผ่าน หรือหมดอายุ");
  }
  if (patch.status === "rejected" && !patch.rejectNote?.trim()) {
    throw new Error("กรุณาระบุเหตุผลที่ไม่ผ่าน");
  }
  const missionTag = patch.missionMonth ?? patch.date.slice(0, 7);
  rows[idx] = {
    ...cur,
    date: patch.date,
    runType: patch.runType,
    distanceKm: patch.distanceKm,
    durationSec: patch.durationSec,
    missionTag,
    status: patch.status,
    rejectNote: patch.status === "rejected" ? patch.rejectNote : undefined,
    staffEditNote: patch.staffEditNote.trim(),
    updatedAt: Date.now(),
  };
  write(RUN_KEY, rows);
  notifyDataChanged();
  return rows[idx];
}

/* ---------- Weights ---------- */
export function getWeights(employeeId?: string): WeightEntry[] {
  // เรียงตามเดือนล่าสุดก่อน, แล้วต้นเดือนก่อนสิ้นเดือน
  const rows = applyExpiryWeights(read<WeightEntry>(WEIGHT_KEY)).sort(
    (a, b) => b.month.localeCompare(a.month) || a.period.localeCompare(b.period),
  );
  return employeeId ? rows.filter((r) => r.employeeId === employeeId) : rows;
}

type WeightInput = Omit<WeightEntry, "id" | "createdAt" | "updatedAt" | "status"> & {
  id?: string;
  status?: EntryStatus;
};

export function saveWeight(entry: WeightInput): WeightEntry {
  const rows = read<WeightEntry>(WEIGHT_KEY);
  const status = resolveStatusForEmployee(entry.employeeId, entry.status);
  if (entry.id) {
    const idx = rows.findIndex((r) => r.id === entry.id);
    if (idx >= 0) {
      const cur = rows[idx];
      if (cur.status === "rejected") {
        throw new Error("รายการที่ไม่ผ่านแล้วแก้ไขไม่ได้ กรุณาส่งรายการใหม่");
      }
      if (cur.status === "expired") {
        throw new Error("รายการหมดอายุแล้ว กรุณาส่งรายการใหม่");
      }
      if (!isTeamLead(entry.employeeId) && cur.status !== "pending") {
        throw new Error("แก้ไขได้เฉพาะรายการที่รออนุมัติ");
      }
      if (cur.status === "pending" && !weightWindow(cur.month, cur.period).open) {
        throw new Error(
          cur.period === "start"
            ? "เลยช่วงเวลาที่แก้ไขน้ำหนักต้นเดือนแล้ว"
            : "เลยช่วงเวลาที่แก้ไขน้ำหนักสิ้นเดือนแล้ว",
        );
      }
      rows[idx] = {
        ...rows[idx],
        ...entry,
        status,
        rejectNote: undefined,
        updatedAt: Date.now(),
      };
      write(WEIGHT_KEY, rows);
      notifyDataChanged();
      return rows[idx];
    }
  }
  if (
    rows.some(
      (r) =>
        r.employeeId === entry.employeeId &&
        r.month === entry.month &&
        r.period === entry.period &&
        r.status === "rejected",
    ) &&
    !weightCanResubmitRejected(entry.month, entry.period)
  ) {
    throw new Error(
      entry.period === "start"
        ? "ส่งน้ำหนักต้นเดือนใหม่ได้เฉพาะวันที่ 1 ของเดือน"
        : "ส่งน้ำหนักสิ้นเดือนใหม่ได้เฉพาะวันสุดท้ายของเดือนและวันที่ 1–2 เดือนถัดไป",
    );
  }
  if (!weightCanCreate(entry.month, entry.period)) {
    throw new Error(
      entry.period === "start"
        ? "บันทึกน้ำหนักต้นเดือนได้เฉพาะวันที่ 1 ของเดือน"
        : "ยังไม่อยู่ในช่วงเวลาที่เปิดให้บันทึกน้ำหนักสิ้นเดือน",
    );
  }
  const now = Date.now();
  const created: WeightEntry = {
    ...entry,
    status,
    id: uid("wt"),
    createdAt: now,
    updatedAt: now,
  };
  rows.push(created);
  write(WEIGHT_KEY, rows);
  notifyDataChanged();
  return created;
}

export function deleteWeight(id: string) {
  const rows = read<WeightEntry>(WEIGHT_KEY);
  const row = rows.find((r) => r.id === id);
  if (!row || row.status !== "pending") return;
  write(
    WEIGHT_KEY,
    rows.filter((r) => r.id !== id),
  );
  notifyDataChanged();
}

export function setWeightStatus(id: string, status: EntryStatus, rejectNote?: string) {
  const rows = read<WeightEntry>(WEIGHT_KEY);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const cur = rows[idx];
  if (status === "approved" && cur.status !== "pending" && cur.status !== "expired") return;
  if (status === "rejected" && cur.status !== "pending" && cur.status !== "approved" && cur.status !== "expired") return;
  if (status === "rejected" && !rejectNote?.trim()) return;
  rows[idx] = {
    ...rows[idx],
    status,
    rejectNote: status === "rejected" ? rejectNote : undefined,
    updatedAt: Date.now(),
  };
  write(WEIGHT_KEY, rows);
  notifyDataChanged();
}

/** Admin แก้ไขรายการน้ำหนัก (อนุมัติแล้ว / ไม่ผ่าน / หมดอายุ) */
export function staffEditWeight(
  id: string,
  patch: {
    weightKg: number;
    status: "approved" | "rejected";
    rejectNote?: string;
    staffEditNote: string;
  },
): WeightEntry {
  const rows = read<WeightEntry>(WEIGHT_KEY);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("ไม่พบรายการ");
  const cur = rows[idx];
  if (cur.status !== "approved" && cur.status !== "rejected" && cur.status !== "expired") {
    throw new Error("แก้ไขได้เฉพาะรายการที่อนุมัติแล้ว ไม่ผ่าน หรือหมดอายุ");
  }
  if (patch.status === "rejected" && !patch.rejectNote?.trim()) {
    throw new Error("กรุณาระบุเหตุผลที่ไม่ผ่าน");
  }
  rows[idx] = {
    ...cur,
    weightKg: patch.weightKg,
    status: patch.status,
    rejectNote: patch.status === "rejected" ? patch.rejectNote : undefined,
    staffEditNote: patch.staffEditNote.trim(),
    updatedAt: Date.now(),
  };
  write(WEIGHT_KEY, rows);
  notifyDataChanged();
  return rows[idx];
}

/** เดือนปัจจุบัน (อ้างอิงโหมดสาธิตใน missions.ts) */
export function currentMonth(): string {
  return currentMonthKey();
}

/* ---------- Notifications: รายการใหม่/อัปเดต ที่หัวหน้ายังไม่ได้เปิดดู ---------- */
const SEEN_KEY = "rc2026.seenSubs";
/** event ที่ยิงเมื่อข้อมูล/สถานะการอ่านเปลี่ยน — ให้ badge อัปเดตแบบเรียลไทม์ */
export const DATA_CHANGED_EVENT = "rc2026:data-changed";

function notifyDataChanged() {
  try {
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
  } catch {
    /* SSR/no-window */
  }
}

/** กุญแจของรายการ = id + เวอร์ชันล่าสุด → ถ้ามีการอัปเดต กุญแจจะเปลี่ยน นับเป็น "ใหม่" อีกครั้ง */
function subKey(id: string, updatedAt: number): string {
  return `${id}@${updatedAt}`;
}

interface TeamSub {
  memberId: string;
  key: string;
  createdAt: number;
  month: string; // เดือนของกิจกรรม "yyyy-mm"
}

function teamSubs(employeeIds: string[]): TeamSub[] {
  const set = new Set(employeeIds);
  const runs = read<RunEntry>(RUN_KEY)
    .filter((r) => set.has(r.employeeId))
    .map((r) => ({ memberId: r.employeeId, key: subKey(r.id, r.updatedAt), createdAt: r.createdAt, month: monthOf(r.date) }));
  const weights = read<WeightEntry>(WEIGHT_KEY)
    .filter((w) => set.has(w.employeeId))
    .map((w) => ({ memberId: w.employeeId, key: subKey(w.id, w.updatedAt), createdAt: w.createdAt, month: w.month }));
  return [...runs, ...weights];
}

function readSeenMap(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeSeenMap(map: Record<string, string[]>, notify = true) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  if (notify) notifyDataChanged();
}

/** จำนวนรายการรออนุมัติของสมาชิกคนหนึ่ง */
export function pendingCountForMember(memberId: string): number {
  return pendingTeamCount([memberId]);
}

/** จำนวนรายการรออนุมัติรวมทั้งทีม (สำหรับ badge บนเมนู) */
export function pendingTeamCount(employeeIds: string[]): number {
  const set = new Set(employeeIds);
  const runs = read<RunEntry>(RUN_KEY).filter((r) => set.has(r.employeeId) && r.status === "pending").length;
  const weights = read<WeightEntry>(WEIGHT_KEY).filter((w) => set.has(w.employeeId) && w.status === "pending").length;
  return runs + weights;
}

/** @deprecated ใช้ pendingTeamCount แทน — คงไว้สำหรับโหมด local เก่า */
export function newCountForMember(_leadId: string, memberId: string): number {
  return pendingCountForMember(memberId);
}

/** @deprecated ใช้ pendingTeamCount แทน */
export function newTeamCount(_leadId: string, employeeIds: string[]): number {
  return pendingTeamCount(employeeIds);
}

/** ทำเครื่องหมายว่าหัวหน้าเปิดดูรายการของสมาชิกคนนี้แล้ว → เคลียร์ badge ของคนนั้น */
export function markMemberSeen(leadId: string, memberId: string) {
  const map = readSeenMap();
  const seen = new Set(map[leadId] ?? []);
  teamSubs([memberId]).forEach((s) => seen.add(s.key));
  map[leadId] = Array.from(seen);
  writeSeenMap(map);
}

/** baseline ตอน seed: ให้ "รายการล่าสุดของเดือนปัจจุบัน" ของแต่ละสมาชิกขึ้นเป็นใหม่ ที่เหลือถือว่าอ่านแล้ว */
function initSeenBaseline() {
  const map: Record<string, string[]> = {};
  for (const lead of EMPLOYEES) {
    if (!isTeamLead(lead.id)) continue;
    const ids = subordinates(lead.id).map((e) => e.id);
    const subs = teamSubs(ids);
    const newestByMember = new Map<string, TeamSub>();
    for (const s of subs) {
      const cur = newestByMember.get(s.memberId);
      if (!cur || s.createdAt > cur.createdAt) newestByMember.set(s.memberId, s);
    }
    const unseen = new Set<string>();
    for (const s of newestByMember.values()) {
      if (s.month === currentMonthKey()) unseen.add(s.key);
    }
    map[lead.id] = subs.filter((s) => !unseen.has(s.key)).map((s) => s.key);
  }
  writeSeenMap(map, false);
}

/* ---------- Mock image generators (demo only) ----------
   สร้างภาพจำลองเป็น SVG data URL — ภาพสรุปผลแบบ Strava และภาพชั่งน้ำหนัก
   เพื่อให้หน้าแอดมินมีรูปให้คลิกดูได้เหมือนจริง */
function svgUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function paceLabel(distanceKm: number, durationSec: number): string {
  if (!distanceKm) return "—";
  const spk = durationSec / distanceKm;
  return `${Math.floor(spk / 60)}:${Math.round(spk % 60).toString().padStart(2, "0")}`;
}
function durLabel(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

function stravaProof(name: string, distanceKm: number, durationSec: number, mission: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" font-family="Inter, sans-serif">
  <rect width="640" height="360" fill="#0f1115"/>
  <rect width="640" height="360" fill="url(#g)" opacity="0.25"/>
  <defs><radialGradient id="g" cx="80%" cy="0%" r="90%"><stop offset="0%" stop-color="#fb6514"/><stop offset="70%" stop-color="#0f1115" stop-opacity="0"/></radialGradient></defs>
  <text x="40" y="58" fill="#fb6514" font-size="20" font-weight="800">STRAVA</text>
  <text x="40" y="86" fill="#9aa0aa" font-size="16">${name} · ${missionName(mission)}</text>
  <line x1="40" y1="108" x2="600" y2="108" stroke="#2a2e36"/>
  <text x="40" y="180" fill="#fff" font-size="72" font-weight="800">${distanceKm.toFixed(2)}<tspan font-size="28" fill="#9aa0aa"> km</tspan></text>
  <g fill="#fff" font-weight="700" font-size="34">
    <text x="40" y="280">${durLabel(durationSec)}</text>
    <text x="300" y="280">${paceLabel(distanceKm, durationSec)}<tspan font-size="18" fill="#9aa0aa"> /km</tspan></text>
  </g>
  <g fill="#9aa0aa" font-size="15"><text x="40" y="308">Time</text><text x="300" y="308">Avg Pace</text></g>
  <path d="M40 330 L120 320 L200 334 L280 312 L360 326 L440 308 L520 322 L600 314" fill="none" stroke="#fb6514" stroke-width="3"/>
</svg>`;
  return svgUrl(svg);
}

function weightProof(weightKg: number, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360" font-family="Inter, sans-serif">
  <rect width="480" height="360" fill="#f4f1ec"/>
  <rect x="60" y="70" width="360" height="220" rx="24" fill="#fff" stroke="#e4ded3"/>
  <text x="240" y="120" text-anchor="middle" fill="#8a8378" font-size="18">น้ำหนัก ${label}</text>
  <rect x="110" y="150" width="260" height="90" rx="12" fill="#0f1115"/>
  <text x="240" y="214" text-anchor="middle" fill="#7CFC9B" font-size="58" font-weight="800" font-family="monospace">${weightKg.toFixed(1)}</text>
  <text x="240" y="270" text-anchor="middle" fill="#8a8378" font-size="20" font-weight="600">kg</text>
  <circle cx="240" cy="312" r="6" fill="#fb6514"/>
</svg>`;
  return svgUrl(svg);
}

/* ---------- Seed (mock ข้อมูลทีม) ---------- */
const SEED_VERSION = "rc2026.seeded.v8";

// [emp, dateISO, km, sec, note?, status?, rejectNote?]
type RunSeed = [string, string, number, number, string?, EntryStatus?, string?];

/** ข้อมูลจำลองทั้งทีม — กระจายในช่วงโครงการ (ก.ค.–ก.ย. 2026) ภารกิจอิงตามเดือน */
const RUN_SEED: RunSeed[] = [
  // หัวหน้าทีม (ร่วมวิ่งด้วย)
  ["10002", "2026-09-05", 6.0, 2000],
  ["10002", "2026-08-12", 8.0, 2700],
  ["10003", "2026-09-08", 5.5, 1900],
  // ทีมของ ธนกฤต (10002)
  ["10010", "2026-09-12", 8.24, 2730, "ซ้อมยาวเช้าวันหยุด สวนรถไฟ"],
  ["10010", "2026-09-03", 5.02, 1620],
  ["10010", "2026-08-20", 12.1, 4080],
  ["10010", "2026-07-15", 6.4, 2010, "ลงคอร์ท 8x400m", "rejected", "ภาพ Strava ไม่ชัด รบกวนแนบใหม่"],
  ["10011", "2026-09-02", 4.35, 1560, "วิ่งเบา ๆ หลังไข้"],
  ["10011", "2026-08-10", 5.5, 1980],
  ["10012", "2026-09-10", 10.55, 3360, "เตรียมงานฮาล์ฟ"],
  ["10012", "2026-09-04", 5.0, 1500],
  ["10012", "2026-07-22", 21.1, 7320, "งานแข่ง Amazing Run ได้ PB!"],
  ["10013", "2026-09-06", 4.8, 1740],
  ["10013", "2026-08-15", 6.0, 2160, "วิ่งเทรลเขาใหญ่", "rejected", "ระยะทางสูงผิดปกติ ช่วยตรวจสอบอีกครั้ง"],
  // ทีมของ กิตติพงศ์ (10003)
  ["10020", "2026-09-01", 6.12, 2040],
  ["10020", "2026-08-09", 9.3, 3120, "โซน 2 ยาว ๆ"],
  ["10021", "2026-09-09", 3.0, 1140],
  ["10021", "2026-09-11", 4.0, 1380, undefined, "pending"],
  ["10022", "2026-09-07", 7.8, 2640],
  ["10022", "2026-09-11", 6.1, 2100],
  ["10022", "2026-07-28", 5.25, 1830, "Virtual Run งานวิ่งการกุศล"],
];

// [emp, month, period, kg, status?, rejectNote?]
type WeightSeed = [string, string, WeightPeriod, number, EntryStatus?, string?];
const WEIGHT_SEED: WeightSeed[] = [
  ["10010", "2026-09", "start", 72.4],
  ["10011", "2026-09", "start", 58.0],
  ["10011", "2026-08", "start", 59.2, "rejected", "ภาพเครื่องชั่งไม่ชัดเจน"],
  ["10012", "2026-09", "start", 80.5],
  ["10013", "2026-09", "start", 63.7],
  ["10020", "2026-09", "start", 69.0],
  ["10020", "2026-09", "end", 68.5, "pending"],
  ["10021", "2026-09", "start", 75.3],
  ["10022", "2026-09", "start", 55.8],
];

function nameOf(id: string): string {
  return EMPLOYEES.find((e) => e.id === id)?.name ?? id;
}

/** Seed mock team data so dashboards/admin look realistic. */
export function seedDemo() {
  if (localStorage.getItem(SEED_VERSION)) return;
  // reset any previous demo data, then load the richer mock set
  localStorage.removeItem(RUN_KEY);
  localStorage.removeItem(WEIGHT_KEY);

  RUN_SEED.forEach(([emp, date, km, sec, note, status, rejectNote]) => {
    const mission = date.slice(0, 7); // คีย์เดือน = ภารกิจประจำเดือนนั้น
    // จำลองการแนบหลายรูป (1–3 รูป) เพื่อให้หัวหน้าเปิดดูแบบแกลเลอรีได้
    const images = [stravaProof(nameOf(emp), km, sec, mission)];
    if (note) images.push(stravaProof(`${nameOf(emp)} · ภาพเพิ่มเติม`, km, sec, mission));
    if (km >= 8) images.push(stravaProof(`${nameOf(emp)} · เส้นทาง`, km, sec, mission));
    saveRun({
      employeeId: emp,
      date,
      runType: note ? "mission" : "discipline",
      distanceKm: km,
      durationSec: sec,
      missionTag: mission,
      note,
      status: status ?? (isTeamLead(emp) ? "approved" : "pending"),
      stravaImages: images,
    });
    if (status === "rejected") {
      // saveRun ล้าง rejectNote เสมอ → ตั้งสถานะตีกลับอีกครั้งให้มีเหตุผล
      const created = getRuns(emp).find((r) => r.date === date && r.distanceKm === km);
      if (created) setRunStatus(created.id, "rejected", rejectNote);
    }
  });

  WEIGHT_SEED.forEach(([emp, month, period, kg, status, rejectNote]) => {
    saveWeight({
      employeeId: emp,
      month,
      period,
      weightKg: kg,
      status: status ?? (isTeamLead(emp) ? "approved" : "pending"),
      proofImages: [weightProof(kg, period === "start" ? "ต้นเดือน" : "สิ้นเดือน")],
    });
    if (status === "rejected") {
      const created = getWeights(emp).find((w) => w.month === month && w.period === period);
      if (created) setWeightStatus(created.id, "rejected", rejectNote);
    }
  });

  initSeenBaseline();
  localStorage.setItem(SEED_VERSION, "1");
}
