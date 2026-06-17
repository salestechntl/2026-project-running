import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../_lib/auth/require.js";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";
import { canAccessEmployee } from "../_lib/team/access.js";
import { mapRun, validateImageSlots, type DbRunRow } from "../_lib/entries/map.js";
import { attachRunImages } from "../_lib/entries/attach-run-images.js";

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
      .from("run_entries")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !existing) {
      return res.status(404).json({ error: "ไม่พบรายการ" });
    }

    const row = existing as DbRunRow;

    if (req.method === "DELETE") {
      if (row.employee_id !== auth.sub) {
        return res.status(403).json({ error: "ลบได้เฉพาะรายการของตนเอง" });
      }

      const { error } = await supabase.from("run_entries").delete().eq("id", id);
      if (error) {
        console.error("run delete error:", error);
        return res.status(500).json({ error: "ไม่สามารถลบรายการได้" });
      }

      await supabase.from("audit_log").insert({
        actor_id: auth.sub,
        action: "run.delete",
        target_type: "run",
        target_id: id,
      });

      return res.status(200).json({ ok: true });
    }

    if (req.method === "PUT") {
      if (row.employee_id !== auth.sub) {
        return res.status(403).json({ error: "อัปโหลดรูปได้เฉพาะรายการของตนเอง" });
      }

      const imageSlots = validateImageSlots(
        req.body?.stravaImages ?? req.body?.strava_images,
        req.body?.stravaImageRefs ?? req.body?.strava_image_refs,
      );

      if (imageSlots === null) {
        return res.status(400).json({ error: "ภาพกิจกรรมไม่ถูกต้อง กรุณาเลือกรูปใหม่" });
      }
      if (imageSlots.length === 0) {
        return res.status(400).json({ error: "ต้องแนบภาพอย่างน้อย 1 รูป" });
      }

      const attached = await attachRunImages(supabase, id, auth.sub, imageSlots);
      if ("error" in attached) {
        return res.status(400).json({ error: attached.error });
      }

      return res.status(200).json({ run: mapRun(row, attached) });
    }

    if (req.method === "PATCH") {
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
        .from("run_entries")
        .update({
          status,
          reject_note: rejectNote,
          rejected_by: status === "rejected" ? auth.sub : null,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        console.error("run status error:", updateError);
        return res.status(500).json({ error: "ไม่สามารถอัปเดตสถานะได้" });
      }

      await supabase.from("audit_log").insert({
        actor_id: auth.sub,
        action: status === "rejected" ? "run.reject" : "run.restore",
        target_type: "run",
        target_id: id,
        metadata: rejectNote ? { reject_note: rejectNote } : null,
      });

      return res.status(200).json({ run: mapRun(updated as DbRunRow) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("run id handler error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
}
