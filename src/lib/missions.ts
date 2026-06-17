/**
 * ภารกิจรายเดือน (Monthly Missions)
 *
 * แนวคิด: 1 เดือน = 1 ภารกิจ — แก้ไข "ชื่อ / วัตถุประสงค์" ได้ที่ MONTHLY_MISSIONS ที่เดียว
 * เดือนในอนาคตจะถูก "ล็อก" ผู้ใช้มองไม่เห็นชื่อภารกิจล่วงหน้า จนกว่าจะถึงเดือนนั้น
 * ส่วนเดือนที่ผ่านมา/เดือนปัจจุบันจะเปิดให้เห็นและใช้งานได้
 *
 * ในระบบจริง ตารางนี้คือ config ที่ดึง/แก้ผ่านหลังบ้าน (Sheet/DB) ได้
 */

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

/** จำนวนวันผ่อนผันหลังสิ้นเดือนสำหรับการกรอกน้ำหนักสิ้นเดือน */
export const END_WEIGHT_GRACE_DAYS = 7;

/**
 * หน้าต่างเวลาสำหรับกรอก "น้ำหนักสิ้นเดือน"
 * เปิดให้กรอกตั้งแต่ "วันสุดท้ายของเดือน" จนถึง END_WEIGHT_GRACE_DAYS วันหลังสิ้นเดือน
 */
/**
 * หน้าต่างเวลาสำหรับกรอกน้ำหนัก
 * - ต้นเดือน (start): เปิดวันแรกของเดือน → ปิด END_WEIGHT_GRACE_DAYS วันหลังสิ้นเดือน
 * - สิ้นเดือน (end):   เปิดวันสุดท้ายของเดือน → ปิด END_WEIGHT_GRACE_DAYS วันหลังสิ้นเดือน
 */
export function weightWindow(month: string, period: "start" | "end"): {
  open: boolean;
  opensISO: string;
  closesISO: string;
  /** เลยวันสุดท้ายของเดือนแล้ว — กำลังกรอกย้อนหลังในช่วงผ่อนผัน */
  backdated: boolean;
  /** จำนวนวันที่ยังกรอกได้ (นับวันนี้ด้วย) ภายในช่วงผ่อนผัน */
  daysLeft: number;
} {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const lastDayISO = `${month}-${pad2(lastDay)}`;
  const opensISO = period === "start" ? `${month}-01` : lastDayISO;
  const close = new Date(y, m - 1, lastDay + END_WEIGHT_GRACE_DAYS);
  const closesISO = `${close.getFullYear()}-${pad2(close.getMonth() + 1)}-${pad2(close.getDate())}`;
  const today = todayISOEffective();
  const open = today >= opensISO && today <= closesISO;
  const dayMs = 86400000;
  const daysLeft = open
    ? Math.round((Date.parse(closesISO) - Date.parse(today)) / dayMs) + 1
    : 0;
  return { open, opensISO, closesISO, backdated: open && today > lastDayISO, daysLeft };
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
