import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../_lib/auth/require.js";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";
import {
  canAccessEmployee,
  canApproveEntries,
  canEditRejectedEntry,
} from "../_lib/team/access.js";
import { mapWeight, type DbWeightRow } from "../_lib/entries/map.js";
import { approvalFieldsForStatus } from "../_lib/entries/approval-fields.js";
import { canActorApprove, canActorReject } from "../_lib/entries/status.js";
import { expireEntryIfStale } from "../_lib/entries/expire.js";
import { snapshotEntry } from "../_lib/storage/attachments.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireAuth(req);
  if (!auth) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured on the server" });
  }

  const id = String(req.query.id ?? "").trim();
  if (!id) return res.status(400).json({ error: "ไม่พบรหัสรายการ" });

  try {
    const supabase = createAdminClient();

    const { data: existing, error: fetchError } = await supabase
      .from("weight_entries")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return res.status(404).json({ error: "ไม่พบรายการ" });
    }

    const row = existing as DbWeightRow;

    if (req.method === "DELETE") {
      if (row.employee_id !== auth.sub) {
        return res.status(403).json({ error: "ลบได้เฉพาะรายการของตนเอง" });
      }
      if (row.status !== "pending") {
        return res.status(400).json({ error: "ลบได้เฉพาะรายการที่รออนุมัติ" });
      }

      const { error } = await supabase.from("weight_entries").delete().eq("id", id);
      if (error) {
        console.error("weight delete error:", error);
        return res.status(500).json({ error: "ไม่สามารถลบรายการได้" });
      }

      await supabase.from("audit_log").insert({
        actor_id: auth.sub,
        action: "weight.delete",
        target_type: "weight",
        target_id: id,
      });

      return res.status(200).json({ ok: true });
    }

    if (req.method !== "PATCH") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const allowed = await canAccessEmployee(supabase, auth.sub, row.employee_id, auth);
    if (!allowed) return res.status(403).json({ error: "ไม่มีสิทธิ์จัดการรายการนี้" });

    if (req.body?.staffEdit === true) {
      if (!canEditRejectedEntry(auth)) {
        return res.status(403).json({ error: "เฉพาะ Admin / Super Admin เท่านั้น" });
      }
      if (row.status !== "rejected") {
        return res.status(400).json({ error: "แก้ไขได้เฉพาะรายการที่ไม่ผ่าน" });
      }

      const nextStatus = req.body?.status;
      if (nextStatus !== "pending" && nextStatus !== "approved" && nextStatus !== "rejected") {
        return res.status(400).json({ error: "สถานะไม่ถูกต้อง" });
      }

      const weightKg = Number(req.body?.weightKg ?? req.body?.weight_kg);
      if (!weightKg || weightKg <= 0) {
        return res.status(400).json({ error: "น้ำหนักต้องมากกว่า 0" });
      }

      let rejectNote: string | null = null;
      if (nextStatus === "rejected") {
        rejectNote = String(req.body?.rejectNote ?? row.reject_note ?? "").trim();
        if (!rejectNote) {
          return res.status(400).json({ error: "กรุณาระบุเหตุผลที่ไม่ผ่าน" });
        }
      }

      await snapshotEntry(supabase, "weight", id, row as unknown as Record<string, unknown>, auth.sub, "staff_edit");

      const { data: updated, error: updateError } = await supabase
        .from("weight_entries")
        .update({
          weight_kg: weightKg,
          ...approvalFieldsForStatus(nextStatus, auth.sub, { rejectNote }),
        })
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        console.error("weight staff edit error:", updateError);
        return res.status(500).json({ error: "ไม่สามารถบันทึกการแก้ไขได้" });
      }

      await supabase.from("audit_log").insert({
        actor_id: auth.sub,
        action: "weight.staff_edit",
        target_type: "weight",
        target_id: id,
        metadata: { status: nextStatus },
      });

      return res.status(200).json({ weight: mapWeight(updated as DbWeightRow) });
    }

    if (!canApproveEntries(auth)) {
      return res.status(403).json({ error: "เฉพาะหัวหน้าทีมเท่านั้น" });
    }

    await expireEntryIfStale(supabase, "weight_entries", "weight", row);
    const { data: freshWeight } = await supabase.from("weight_entries").select("*").eq("id", id).single();
    const activeRow = (freshWeight ?? row) as DbWeightRow;

    const status = req.body?.status;
    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ error: "สถานะไม่ถูกต้อง" });
    }

    if (status === "approved") {
      if (!canActorApprove(activeRow.status, auth)) {
        if (activeRow.status === "expired") {
          return res.status(403).json({ error: "เฉพาะ Admin / Super Admin เท่านั้นที่อนุมัติรายการหมดอายุได้" });
        }
        return res.status(400).json({ error: "อนุมัติได้เฉพาะรายการที่รออนุมัติ" });
      }

      const nowIso = new Date().toISOString();
      const { data: updated, error: updateError } = await supabase
        .from("weight_entries")
        .update({
          status: "approved",
          reject_note: null,
          rejected_by: null,
          expired_at: null,
          approved_by: auth.sub,
          approved_at: nowIso,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        console.error("weight approve error:", updateError);
        return res.status(500).json({ error: "ไม่สามารถอนุมัติรายการได้" });
      }

      await supabase.from("audit_log").insert({
        actor_id: auth.sub,
        action: "weight.approve",
        target_type: "weight",
        target_id: id,
      });

      return res.status(200).json({ weight: mapWeight(updated as DbWeightRow) });
    }

    if (!canActorReject(activeRow.status, auth)) {
      if (activeRow.status === "expired") {
        return res.status(403).json({ error: "เฉพาะ Admin / Super Admin เท่านั้นที่ไม่อนุมัติรายการหมดอายุได้" });
      }
      return res.status(400).json({ error: "ไม่สามารถปฏิเสธรายการนี้ได้" });
    }

    const rejectNote = String(req.body?.rejectNote ?? "").trim();
    if (!rejectNote) {
      return res.status(400).json({ error: "กรุณาระบุเหตุผลที่ไม่ผ่าน" });
    }

    const { data: updated, error: updateError } = await supabase
      .from("weight_entries")
      .update({
        status: "rejected",
        reject_note: rejectNote,
        rejected_by: auth.sub,
        approved_by: null,
        approved_at: null,
        expired_at: null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("weight reject error:", updateError);
      return res.status(500).json({ error: "ไม่สามารถอัปเดตสถานะได้" });
    }

    await supabase.from("audit_log").insert({
      actor_id: auth.sub,
      action: "weight.reject",
      target_type: "weight",
      target_id: id,
      metadata: { reject_note: rejectNote },
    });

    return res.status(200).json({ weight: mapWeight(updated as DbWeightRow) });
  } catch (err) {
    console.error("weight id handler error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
}
