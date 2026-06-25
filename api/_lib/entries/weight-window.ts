import { todayISOEffective } from "../time/effective-date.js";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function todayISO(): string {
  return todayISOEffective();
}

function monthKeyOffset(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

const END_WEIGHT_NEXT_MONTH_GRACE_DAYS = 2;

function endWeightClosesISO(month: string): string {
  return `${monthKeyOffset(month, 1)}-${pad2(END_WEIGHT_NEXT_MONTH_GRACE_DAYS)}`;
}

export function weightWindow(month: string, period: "start" | "end"): {
  open: boolean;
  canCreate: boolean;
} {
  const today = todayISO();

  if (period === "start") {
    const canCreate = today === `${month}-01`;
    return { open: canCreate, canCreate };
  }

  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const lastDayISO = `${month}-${pad2(lastDay)}`;
  const closesISO = endWeightClosesISO(month);
  const canCreate = today >= lastDayISO && today <= closesISO;
  return { open: canCreate, canCreate };
}

export function weightCanCreate(month: string, period: "start" | "end"): boolean {
  return weightWindow(month, period).canCreate;
}

/** สร้างรายการใหม่ */
export function assertWeightCanCreate(month: string, period: "start" | "end"): string | null {
  if (weightCanCreate(month, period)) return null;
  if (period === "start") {
    return "บันทึกน้ำหนักต้นเดือนได้เฉพาะวันที่ 1 ของเดือน";
  }
  return "ยังไม่อยู่ในช่วงเวลาที่เปิดให้บันทึกน้ำหนักสิ้นเดือน";
}

/** แก้ไขรายการรออนุมัติ — ภายในช่วงบันทึกเท่านั้น */
export function assertWeightCanEditPending(
  month: string,
  period: "start" | "end",
  status: string,
): string | null {
  if (status !== "pending") return null;
  if (weightWindow(month, period).open) return null;
  return period === "start"
    ? "เลยช่วงเวลาที่แก้ไขน้ำหนักต้นเดือนแล้ว"
    : "เลยช่วงเวลาที่แก้ไขน้ำหนักสิ้นเดือนแล้ว";
}

/** ส่งใหม่หลังไม่ผ่าน — ภายในช่วงบันทึกเท่านั้น */
export function assertWeightCanResubmit(
  month: string,
  period: "start" | "end",
): string | null {
  if (weightWindow(month, period).open) return null;
  return period === "start"
    ? "ส่งน้ำหนักต้นเดือนใหม่ได้เฉพาะวันที่ 1 ของเดือน"
    : "ส่งน้ำหนักสิ้นเดือนใหม่ได้เฉพาะวันสุดท้ายของเดือนและวันที่ 1–2 เดือนถัดไป";
}
