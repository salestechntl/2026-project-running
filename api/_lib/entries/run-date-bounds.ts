const CAMPAIGN_MIN = "2026-07-01";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function monthKeyOffset(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

const STAFF_GRACE_DAYS = 7;

/** พนักงาน: เมื่อวานและวันนี้เท่านั้น */
export function runDateBounds(campaignMinISO = CAMPAIGN_MIN): { min: string; max: string } {
  const today = todayISO();
  const max = today;
  let min = addDaysISO(today, -1);

  if (campaignMinISO && min < campaignMinISO) min = campaignMinISO;
  if (max < min) min = max;

  return { min, max };
}

/** Checker แก้ไขรายการ: ช่วงตามเดือนปฏิทิน */
export function staffRunDateBounds(campaignMinISO = CAMPAIGN_MIN): { min: string; max: string } {
  const today = todayISO();
  const max = today;
  const dayOfMonth = parseInt(today.slice(8, 10), 10);
  const currentMonth = today.slice(0, 7);

  let min =
    dayOfMonth <= STAFF_GRACE_DAYS
      ? `${monthKeyOffset(currentMonth, -1)}-01`
      : `${currentMonth}-01`;

  if (campaignMinISO && min < campaignMinISO) min = campaignMinISO;
  if (max < min) min = max;

  return { min, max };
}

export function isRunDateInBounds(date: string, campaignMinISO = CAMPAIGN_MIN): boolean {
  const { min, max } = runDateBounds(campaignMinISO);
  return date >= min && date <= max;
}

export function isRunDateAllowed(
  date: string,
  campaignMinISO = CAMPAIGN_MIN,
  preserveDateISO?: string,
): boolean {
  if (isRunDateInBounds(date, campaignMinISO)) return true;
  if (preserveDateISO && date === preserveDateISO) return true;
  return false;
}

export function isStaffRunDateAllowed(
  date: string,
  campaignMinISO = CAMPAIGN_MIN,
  preserveDateISO?: string,
): boolean {
  const { min, max } = staffRunDateBounds(campaignMinISO);
  if (date >= min && date <= max) return true;
  if (preserveDateISO && date === preserveDateISO) return true;
  return false;
}
