import type { DbRole } from "../auth/types.js";

export type EntryStatus = "pending" | "approved" | "rejected" | "expired";

export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่ผ่าน",
  expired: "หมดอายุ",
};

export function resolveSubmitStatus(isLeadSelf: boolean): EntryStatus {
  return isLeadSelf ? "approved" : "pending";
}

export function canOwnerModifyEntry(status: EntryStatus): boolean {
  return status === "pending";
}

export function canLeadApprove(status: EntryStatus): boolean {
  return status === "pending";
}

export function canLeadReject(status: EntryStatus): boolean {
  return status === "pending" || status === "approved";
}

function isOrgWideRole(role: DbRole): boolean {
  return role === "admin" || role === "super_admin";
}

/** อนุมัติได้ตามบทบาท — expired เฉพาะ admin / super_admin */
export function canActorApprove(
  status: EntryStatus,
  actor: { isLead: boolean; role: DbRole },
): boolean {
  if (status === "pending") return actor.isLead || isOrgWideRole(actor.role);
  if (status === "expired") return isOrgWideRole(actor.role);
  return false;
}

/** ไม่ผ่านได้ตามบทบาท — expired เฉพาะ admin / super_admin */
export function canActorReject(
  status: EntryStatus,
  actor: { isLead: boolean; role: DbRole },
): boolean {
  if (status === "pending") return actor.isLead || isOrgWideRole(actor.role);
  if (status === "approved") return isOrgWideRole(actor.role);
  if (status === "expired") return isOrgWideRole(actor.role);
  return false;
}
