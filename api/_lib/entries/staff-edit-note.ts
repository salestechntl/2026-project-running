import type { EntryStatus } from "./status.js";

const MIN_LEN = 5;
const MAX_LEN = 500;

export type StaffEditTargetStatus = "approved" | "rejected";

export function isStaffEditableStatus(status: EntryStatus): boolean {
  return status === "approved" || status === "rejected" || status === "expired";
}

export function parseStaffEditTargetStatus(raw: unknown): StaffEditTargetStatus | null {
  if (raw === "approved" || raw === "rejected") return raw;
  return null;
}

export function validateStaffEditNote(raw: unknown): string | null {
  if (typeof raw !== "string") return "กรุณาระบุหมายเหตุแก้ไข";
  const note = raw.trim();
  if (note.length < MIN_LEN) return `หมายเหตุแก้ไขต้องมีอย่างน้อย ${MIN_LEN} ตัวอักษร`;
  if (note.length > MAX_LEN) return `หมายเหตุแก้ไขต้องไม่เกิน ${MAX_LEN} ตัวอักษร`;
  return null;
}

export function normalizeStaffEditNote(raw: string): string {
  return raw.trim();
}
