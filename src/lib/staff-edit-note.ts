import type { EntryStatus } from "./store";

const MIN_LEN = 5;
const MAX_LEN = 500;

export type StaffEditTargetStatus = "approved" | "rejected";

export function isStaffEditableStatus(status: EntryStatus): boolean {
  return status === "approved" || status === "rejected" || status === "expired";
}

export function defaultStaffEditTargetStatus(status: EntryStatus): StaffEditTargetStatus {
  return status === "rejected" ? "rejected" : "approved";
}

export function validateStaffEditNote(raw: string): string | null {
  const note = raw.trim();
  if (note.length < MIN_LEN) return `หมายเหตุแก้ไขต้องมีอย่างน้อย ${MIN_LEN} ตัวอักษร`;
  if (note.length > MAX_LEN) return `หมายเหตุแก้ไขต้องไม่เกิน ${MAX_LEN} ตัวอักษร`;
  return null;
}
