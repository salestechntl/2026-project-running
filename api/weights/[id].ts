import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../_lib/auth/require.js";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";
import { canAccessEmployee } from "../_lib/team/access.js";
import { mapWeight, type DbWeightRow } from "../_lib/entries/map.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireAuth(req);
  if (!auth) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });

  if (req.method !== "PATCH") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    if (!auth.isLead) {
      return res.status(403).json({ error: "เฉพาะหัวหน้าทีมเท่านั้น" });
    }

    const allowed = await canAccessEmployee(supabase, auth.sub, row.employee_id, true);
    if (!allowed) return res.status(403).json({ error: "ไม่มีสิทธิ์จัดการรายการนี้" });

    const status = req.body?.status;
    if (status !== "submitted" && status !== "rejected") {
      return res.status(400).json({ error: "สถานะไม่ถูกต้อง" });
    }

    const rejectNote = status === "rejected" ? String(req.body?.rejectNote ?? "").trim() || null : null;

    const { data: updated, error: updateError } = await supabase
      .from("weight_entries")
      .update({
        status,
        reject_note: rejectNote,
        rejected_by: status === "rejected" ? auth.sub : null,
      })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("weight status error:", updateError);
      return res.status(500).json({ error: "ไม่สามารถอัปเดตสถานะได้" });
    }

    await supabase.from("audit_log").insert({
      actor_id: auth.sub,
      action: status === "rejected" ? "weight.reject" : "weight.restore",
      target_type: "weight",
      target_id: id,
      metadata: rejectNote ? { reject_note: rejectNote } : null,
    });

    return res.status(200).json({ weight: mapWeight(updated as DbWeightRow) });
  } catch (err) {
    console.error("weight id handler error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
}
