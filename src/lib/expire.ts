export const PENDING_APPROVAL_DAYS = 5;
export const APPROVAL_TZ = "Asia/Bangkok";

export function bangkokDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleDateString("en-CA", { timeZone: APPROVAL_TZ });
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function shouldExpirePending(createdAtIso: string, now: Date = new Date()): boolean {
  const createdDate = bangkokDateKey(createdAtIso);
  const today = bangkokDateKey(now);
  const expireOn = addCalendarDays(createdDate, PENDING_APPROVAL_DAYS);
  return today >= expireOn;
}

export function shouldExpirePendingMs(createdAtMs: number, nowMs: number = Date.now()): boolean {
  return shouldExpirePending(new Date(createdAtMs).toISOString(), new Date(nowMs));
}
