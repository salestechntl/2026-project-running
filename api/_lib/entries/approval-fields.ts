import type { EntryStatus } from "./status.js";

export function approvalFieldsForStatus(
  status: EntryStatus,
  actorId: string,
  opts?: { rejectNote?: string | null },
): Record<string, string | null> {
  const nowIso = new Date().toISOString();
  if (status === "approved") {
    return {
      status: "approved",
      reject_note: null,
      rejected_by: null,
      expired_at: null,
      approved_by: actorId,
      approved_at: nowIso,
    };
  }
  if (status === "rejected") {
    return {
      status: "rejected",
      reject_note: opts?.rejectNote ?? null,
      rejected_by: actorId,
      approved_by: null,
      approved_at: null,
      expired_at: null,
    };
  }
  return {
    status: "pending",
    reject_note: null,
    rejected_by: null,
    approved_by: null,
    approved_at: null,
    expired_at: null,
  };
}
