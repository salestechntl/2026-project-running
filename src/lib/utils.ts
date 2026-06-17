import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
  const months = [
    "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
    "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
  ];
  return `${d} ${months[m - 1]} ${y + 543}`;
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
