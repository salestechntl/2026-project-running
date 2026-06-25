const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseSimulatedISO(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v || !ISO_DATE.test(v)) return null;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return v;
}

export function todayISOReal(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
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
