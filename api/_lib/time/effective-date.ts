const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** โซนเวลาธุรกิจ — กฎวันที่บันทึกอิงปฏิทินไทย (Vercel API รัน UTC) */
const APP_TIMEZONE = "Asia/Bangkok";

function parseSimulatedISO(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v || !ISO_DATE.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return v;
}

export function todayISOReal(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date());
}

export function getSimulatedTodayISO(): string | null {
  return parseSimulatedISO(process.env.SIMULATED_TODAY);
}

export function isSimulatedTodayActive(): boolean {
  return getSimulatedTodayISO() !== null;
}

export function todayISOEffective(): string {
  return getSimulatedTodayISO() ?? todayISOReal();
}

export function currentMonthKey(): string {
  return todayISOEffective().slice(0, 7);
}
