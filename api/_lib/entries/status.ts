export type EntryStatus = "pending" | "approved" | "rejected";

export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  pending: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่ผ่าน",
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
