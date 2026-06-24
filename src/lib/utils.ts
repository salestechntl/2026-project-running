import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** ลบ accent + แปลงเป็นตัวพิมพ์เล็ก (en-US) สำหรับค้นหาแบบไม่สนตัวเล็ก–ใหญ่ */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US");
}

export function matchesSearchText(haystack: string, query: string): boolean {
  const needle = normalizeForSearch(query.trim());
  if (!needle) return true;
  return normalizeForSearch(haystack).includes(needle);
}

export function matchesEmployeeSearch(member: { id: string; name: string }, query: string): boolean {
  if (!query.trim()) return true;
  return matchesSearchText(member.id, query) || matchesSearchText(member.name, query);
}

/** Today as yyyy-mm-dd in local time (for <input type="date">). */
export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function formatThaiDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${thaiMonthShort(m - 1)} ${y + 543}`;
}

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

function thaiMonthShort(index: number): string {
  return THAI_MONTHS_SHORT[index] ?? "—";
}

/** วันที่และเวลาแบบไทยจาก timestamp (มิลลิวินาที) */
export function formatThaiDateTime(ts: number): string {
  if (!ts || Number.isNaN(ts)) return "—";
  const d = new Date(ts);
  const date = `${d.getDate()} ${thaiMonthShort(d.getMonth())} ${d.getFullYear() + 543}`;
  return `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())} น.`;
}

/** "01:32:40" or "32:40" -> minutes (number). */
export function paceFrom(distanceKm: number, h: number, m: number, s: number): string {
  const totalSec = h * 3600 + m * 60 + s;
  if (!distanceKm || !totalSec) return "—";
  const secPerKm = totalSec / distanceKm;
  const mm = Math.floor(secPerKm / 60);
  const ss = Math.round(secPerKm % 60);
  return `${mm}:${ss.toString().padStart(2, "0")} /กม.`;
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** ระยะเวลาวิ่งแบบไทย เช่น "1 ชม. 0 นาที 0 วินาที" */
export function formatDurationThai(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h} ชม. ${m} นาที ${s} วินาที`;
}
