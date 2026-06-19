const CAMPAIGN_MIN = "2026-07-01";
const RUN_DATE_PREV_MONTH_GRACE_DAYS = 7;

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function monthKeyOffset(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function runDateBounds(campaignMinISO = CAMPAIGN_MIN): { min: string; max: string } {
  const today = todayISO();
  const max = today;
  const dayOfMonth = parseInt(today.slice(8, 10), 10);
  const currentMonth = today.slice(0, 7);

  let min =
    dayOfMonth <= RUN_DATE_PREV_MONTH_GRACE_DAYS
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
  const base = runDateBounds(campaignMinISO);
  const min = preserveDateISO && preserveDateISO < base.min ? preserveDateISO : base.min;
  return date >= min && date <= base.max;
}
