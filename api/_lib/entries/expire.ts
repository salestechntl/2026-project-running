import type { SupabaseClient } from "@supabase/supabase-js";

export const PENDING_APPROVAL_DAYS = 5;
export const APPROVAL_TZ = "Asia/Bangkok";

/** วันที่ปฏิทิน yyyy-mm-dd ใน timezone อนุมัติ */
export function bangkokDateKey(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleDateString("en-CA", { timeZone: APPROVAL_TZ });
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** pending หมดอายุเมื่อครบ 5 วันปฏิทินนับจาก created_at (วันแรก = วันบันทึก) */
export function shouldExpirePending(createdAtIso: string, now: Date = new Date()): boolean {
  const createdDate = bangkokDateKey(createdAtIso);
  const today = bangkokDateKey(now);
  const expireOn = addCalendarDays(createdDate, PENDING_APPROVAL_DAYS);
  return today >= expireOn;
}

export function shouldExpirePendingMs(createdAtMs: number, nowMs: number = Date.now()): boolean {
  return shouldExpirePending(new Date(createdAtMs).toISOString(), new Date(nowMs));
}

export async function expirePendingEntries(
  supabase: SupabaseClient,
  opts?: { employeeId?: string },
): Promise<number> {
  const now = new Date();
  let runQuery = supabase.from("run_entries").select("id, created_at").eq("status", "pending");
  let weightQuery = supabase.from("weight_entries").select("id, created_at").eq("status", "pending");
  if (opts?.employeeId) {
    runQuery = runQuery.eq("employee_id", opts.employeeId);
    weightQuery = weightQuery.eq("employee_id", opts.employeeId);
  }

  const [{ data: runs }, { data: weights }] = await Promise.all([runQuery, weightQuery]);
  const runIds = (runs ?? []).filter((r) => shouldExpirePending(r.created_at, now)).map((r) => r.id);
  const weightIds = (weights ?? []).filter((w) => shouldExpirePending(w.created_at, now)).map((w) => w.id);

  await expireIds(supabase, "run_entries", "run", runIds);
  await expireIds(supabase, "weight_entries", "weight", weightIds);
  return runIds.length + weightIds.length;
}

async function expireIds(
  supabase: SupabaseClient,
  table: "run_entries" | "weight_entries",
  entryType: "run" | "weight",
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from(table)
    .update({ status: "expired", expired_at: nowIso, updated_at: nowIso })
    .in("id", ids);
  if (error) throw error;

  await supabase.from("audit_log").insert(
    ids.map((id) => ({
      actor_id: null,
      action: `${entryType}.expire`,
      target_type: entryType,
      target_id: id,
    })),
  );
}

/** หมดอายุรายการเดียวถ้าครบกำหนด — คืน true ถ้ามีการอัปเดต */
export async function expireEntryIfStale(
  supabase: SupabaseClient,
  table: "run_entries" | "weight_entries",
  entryType: "run" | "weight",
  row: { id: string; status: string; created_at: string },
): Promise<boolean> {
  if (row.status !== "pending" || !shouldExpirePending(row.created_at)) return false;
  await expireIds(supabase, table, entryType, [row.id]);
  return true;
}
