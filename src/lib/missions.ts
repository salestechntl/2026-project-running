/**
 * ภารกิจรายเดือน (Monthly Missions)
 *
 * แนวคิด: 1 เดือน = 1 ภารกิจ — แก้ไข "ชื่อ / วัตถุประสงค์" ได้ที่ MONTHLY_MISSIONS ที่เดียว
 * เดือนในอนาคตจะถูก "ล็อก" ผู้ใช้มองไม่เห็นชื่อภารกิจล่วงหน้า จนกว่าจะถึงเดือนนั้น
 * ส่วนเดือนที่ผ่านมา/เดือนปัจจุบันจะเปิดให้เห็นและใช้งานได้
 *
 * ในระบบจริง ตารางนี้คือ config ที่ดึง/แก้ผ่านหลังบ้าน (Sheet/DB) ได้
 */

import { formatThaiDate } from "./utils";

export interface MonthlyMission {
  month: string; // "yyyy-mm"
  name: string;
  objective: string;
}

export const MONTHLY_MISSIONS: MonthlyMission[] = [
  { month: "2026-07", name: "Run Together", objective: "เปิดโครงการด้วย Teamwork ระหว่างพื้นที่ ภาค" },
  { month: "2026-08", name: "Branch Buddy Challenge", objective: "ดึงสาขาเข้ามามีส่วนร่วม" },
  { month: "2026-09", name: "Route of Pride", objective: "สร้าง Story และความภูมิใจของแต่ละพื้นที่" },
  { month: "2026-10", name: "Road to Race Day", objective: "วัดความพร้อมก่อนงานวิ่งจริง" },
  { month: "2026-11", name: "Race Month", objective: "พิสูจน์ผลลัพธ์จากการฝึกซ้อม" },
  {
    month: "2026-12",
    name: "Victory Run: Finish Strong, Close the Year",
    objective: "ปิดปีด้วย Team Spirit และ Momentum การปิดยอด",
  },
];

/**
 * โหมดสาธิต: บังคับ "เดือนปัจจุบัน" เพื่อพรีวิวการปลดล็อกภารกิจ
 * โปรดตั้งค่าเป็น "" ก่อนใช้งานจริง เพื่อให้ระบบอ้างอิงวันที่จริงของเครื่อง
 */
export const SIMULATED_CURRENT_MONTH: string = "";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** คีย์เดือนปัจจุบัน "yyyy-mm" (เคารพโหมดสาธิต) */
export function currentMonthKey(): string {
  if (SIMULATED_CURRENT_MONTH) return SIMULATED_CURRENT_MONTH;
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** ISO ของ "วันนี้" สำหรับ default/max ของช่องวันที่ (เคารพโหมดสาธิต) */
export function todayISOEffective(): string {
  if (SIMULATED_CURRENT_MONTH) {
    const [y, m] = SIMULATED_CURRENT_MONTH.split("-").map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    return `${SIMULATED_CURRENT_MONTH}-${pad2(lastDay)}`;
  }
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** คีย์เดือนก่อนหน้า n เดือน "yyyy-mm" */
export function monthKeyOffset(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** วันที่ 1–7 ของเดือน — ใช้กับช่วงวันที่วิ่งของ Checker เท่านั้น */
export const RUN_DATE_PREV_MONTH_GRACE_DAYS = 7;

function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/**
 * ช่วงวันที่เลือกได้สำหรับบันทึกการวิ่ง (พนักงาน)
 * เฉพาะเมื่อวานและวันนี้ — ต้องบันทึกภายในวันถัดไปหลังวิ่ง
 */
export function runDateBounds(campaignMinISO?: string): { min: string; max: string } {
  const today = todayISOEffective();
  const max = today;
  let min = addDaysISO(today, -1);

  if (campaignMinISO && min < campaignMinISO) min = campaignMinISO;
  if (max < min) min = max;

  return { min, max };
}

/** ช่วงวันที่สำหรับ Checker แก้ไขรายการ (ตามเดือนปฏิทิน — ไม่จำกัดแค่ 2 วัน) */
export function staffRunDateBounds(campaignMinISO?: string): { min: string; max: string } {
  const today = todayISOEffective();
  const max = today;
  const dayOfMonth = parseInt(today.slice(8, 10), 10);
  const currentMonth = monthOf(today);

  let min =
    dayOfMonth <= RUN_DATE_PREV_MONTH_GRACE_DAYS
      ? `${monthKeyOffset(currentMonth, -1)}-01`
      : `${currentMonth}-01`;

  if (campaignMinISO && min < campaignMinISO) min = campaignMinISO;
  if (max < min) min = max;

  return { min, max };
}

export function runDateOptionLabel(iso: string, today = todayISOEffective()): string {
  const yesterday = addDaysISO(today, -1);
  const formatted = formatThaiDate(iso);
  if (iso === today) return `วันนี้ (${formatted})`;
  if (iso === yesterday) return `เมื่อวาน (${formatted})`;
  return formatted;
}

export function runDateFieldHint(): string {
  return "เลือกได้เฉพาะวันนี้และเมื่อวาน — บันทึกภายในวันถัดไปหลังวิ่ง";
}

export function isRunDateInBounds(date: string, campaignMinISO?: string): boolean {
  const { min, max } = runDateBounds(campaignMinISO);
  return date >= min && date <= max;
}

/** ช่วงเลือกในฟอร์มพนักงาน */
export function runDateSelectionBounds(campaignMinISO?: string): { min: string; max: string } {
  return runDateBounds(campaignMinISO);
}

export function isRunDateAllowed(
  date: string,
  campaignMinISO?: string,
  preserveDateISO?: string,
): boolean {
  if (isRunDateInBounds(date, campaignMinISO)) return true;
  if (preserveDateISO && date === preserveDateISO) return true;
  return false;
}

/**
 * เดือนเป้าหมายสำหรับน้ำหนักต้นเดือน — บันทึกได้เฉพาะวันที่ 1 ของเดือนปัจจุบัน
 */
export function startWeightTargetMonth(): string {
  return currentMonthKey();
}

/**
 * เดือนเป้าหมายสำหรับน้ำหนักสิ้นเดือน
 * - วันสุดท้ายของเดือน M     → M
 * - วันที่ 1 ของเดือน M+1    → M (เดือนก่อนหน้า)
 * - วันอื่นในเดือนปัจจุบัน   → เดือนปัจจุบัน (รอบถัดไปที่จะเปิดรับ)
 */
export function endWeightTargetMonth(today = todayISOEffective()): string {
  const cur = monthOf(today);
  const day = parseInt(today.slice(8, 10), 10);
  const [y, m] = cur.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const lastDayISO = `${cur}-${pad2(lastDay)}`;

  if (today === lastDayISO) return cur;
  if (day === 1) return monthKeyOffset(cur, -1);
  return cur;
}

function endWeightClosesISO(month: string): string {
  return `${monthKeyOffset(month, 1)}-01`;
}

/**
 * หน้าต่างเวลาสำหรับกรอกน้ำหนัก
 * - ต้นเดือน (start): บันทึก/แก้ไข pending/ส่งใหม่ — เฉพาะวันที่ 1 ของเดือน
 * - สิ้นเดือน (end):   วันสุดท้ายของเดือน → วันที่ 1 เดือนถัดไป (2 วัน)
 */
export function weightCanCreate(month: string, period: "start" | "end"): boolean {
  return weightWindow(month, period).canCreate;
}

export function weightCanEditPending(month: string, period: "start" | "end"): boolean {
  return weightWindow(month, period).open;
}

/** ส่งใหม่หลังไม่ผ่าน — ภายในช่วงบันทึกเท่านั้น */
export function weightCanResubmitRejected(month: string, period: "start" | "end"): boolean {
  return weightWindow(month, period).open;
}

/** มีรายการไม่ผ่านและอยู่นอกช่วงส่งใหม่ */
export function weightBlockedByRejected(
  month: string,
  period: "start" | "end",
  entries: readonly { period: string; status: string }[],
): boolean {
  if (!entries.some((e) => e.period === period && e.status === "rejected")) return false;
  if (entries.some((e) => e.period === period && e.status === "pending")) return false;
  return !weightCanResubmitRejected(month, period);
}

/** เปิดฟอร์มกรอก/แก้ไขใน WeightCard */
export function weightCardEditable(
  month: string,
  period: "start" | "end",
  initial: { status: string } | undefined,
  blockedByRejected = false,
): boolean {
  if (blockedByRejected) return false;
  const isPending = initial?.status === "pending";
  if (isPending) return weightCanEditPending(month, period);
  return weightCanCreate(month, period);
}

export function weightWindow(month: string, period: "start" | "end"): {
  open: boolean;
  canCreate: boolean;
  opensISO: string;
  closesISO: string;
  /** เลยวันสุดท้ายของเดือนแล้ว — กำลังกรอกย้อนหลังในช่วงผ่อนผัน (เฉพาะสิ้นเดือน) */
  backdated: boolean;
  /** จำนวนวันที่ยังกรอกได้ (นับวันนี้ด้วย) ภายในช่วงผ่อนผัน */
  daysLeft: number;
} {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const lastDayISO = `${month}-${pad2(lastDay)}`;
  const today = todayISOEffective();

  if (period === "start") {
    const opensISO = `${month}-01`;
    const closesISO = opensISO;
    const canCreate = today === opensISO;
    return {
      open: canCreate,
      canCreate,
      opensISO,
      closesISO,
      backdated: false,
      daysLeft: canCreate ? 1 : 0,
    };
  }

  const opensISO = lastDayISO;
  const closesISO = endWeightClosesISO(month);
  const open = today >= opensISO && today <= closesISO;
  const dayMs = 86400000;
  const daysLeft = open
    ? Math.round((Date.parse(closesISO) - Date.parse(today)) / dayMs) + 1
    : 0;
  return {
    open,
    canCreate: open,
    opensISO,
    closesISO,
    backdated: open && today > lastDayISO,
    daysLeft,
  };
}

/** เดือนนี้ปลดล็อกแล้วหรือยัง (ไม่ใช่อนาคต) */
export function isMonthUnlocked(month: string): boolean {
  return month <= currentMonthKey();
}

/** เดือนนี้คือเดือนปัจจุบันหรือไม่ (ใช้เช็คสิทธิ์แก้ไข) */
export function isCurrentMonth(month: string): boolean {
  return month === currentMonthKey();
}

export function missionForMonth(month: string): MonthlyMission | undefined {
  return MONTHLY_MISSIONS.find((m) => m.month === month);
}

/** ภารกิจของวันที่วิ่ง — คืนค่าเฉพาะเดือนที่ปลดล็อกแล้ว (กันเห็นอนาคต) */
export function visibleMissionForDate(iso: string): MonthlyMission | undefined {
  const month = monthOf(iso);
  if (!isMonthUnlocked(month)) return undefined;
  return missionForMonth(month);
}

/** ชื่อภารกิจจากคีย์เดือนที่เก็บไว้ใน record */
export function missionName(monthKey: string): string {
  return missionForMonth(monthKey)?.name ?? "—";
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** ป้ายเดือนแบบอังกฤษ + ปี ค.ศ. เช่น "Aug 2026" */
export function monthLabelEN(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${EN_MONTHS[m - 1]} ${y}`;
}
