const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** โซนเวลาธุรกิจ — สอดคล้องกับ API (Asia/Bangkok) */
const APP_TIMEZONE = "Asia/Bangkok";

function parseSimulatedISO(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v || !ISO_DATE.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return v;
}

/** วันนี้จริง (ปฏิทินไทย) yyyy-mm-dd */
export function todayISOReal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date());
}

/** ค่าจาก VITE_SIMULATED_TODAY ถ้าตั้งค่าและถูกต้อง */
export function getSimulatedTodayISO(): string | null {
  return parseSimulatedISO(import.meta.env.VITE_SIMULATED_TODAY);
}

export function isSimulatedTodayActive(): boolean {
  return getSimulatedTodayISO() !== null;
}

/** Tailwind sticky offset ใต้แถบ simulate — ต้องตรงกับความสูง SimulatedDateBanner */
export const SIMULATED_BANNER_TOP_OFFSET_CLASS = "top-9";

/** "วันนี้" สำหรับกฎบันทึกข้อมูล — เคารพโหมดจำลอง */
export function todayISOEffective(): string {
  return getSimulatedTodayISO() ?? todayISOReal();
}

/** คีย์เดือนปัจจุบัน yyyy-mm */
export function currentMonthKey(): string {
  return todayISOEffective().slice(0, 7);
}
