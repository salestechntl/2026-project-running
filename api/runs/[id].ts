import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../_lib/auth/require.js";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";
import { canAccessEmployee, canApproveEntries, canEditRejectedEntry, canRejectApproved, canRejectPending } from "../_lib/team/access.js";
import { mapRun, validateImageSlots, type DbRunRow } from "../_lib/entries/map.js";
import { approvalFieldsForStatus } from "../_lib/entries/approval-fields.js";
import { canLeadApprove, canLeadReject } from "../_lib/entries/status.js";
import { attachRunImages } from "../_lib/entries/attach-run-images.js";
import { isRunDateAllowed } from "../_lib/entries/run-date-bounds.js";
import { loadAttachmentViews, snapshotEntry } from "../_lib/storage/attachments.js";

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
      if (row.status !== "pending") {
        return res.status(400).json({ error: "ลบได้เฉพาะรายการที่รออนุมัติ" });
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

        const runDate = String(req.body?.date ?? req.body?.run_date ?? row.run_date).trim();
        const runType = req.body?.runType ?? req.body?.run_type ?? row.run_type;
        const distanceKm = Number(req.body?.distanceKm ?? req.body?.distance_km);
        const durationSec = Number(req.body?.durationSec ?? req.body?.duration_sec);
        const noteRaw = req.body?.note;
        const note = noteRaw == null || noteRaw === "" ? null : String(noteRaw).trim();
        const missionMonth = String(req.body?.missionMonth ?? req.body?.mission_month ?? runDate.slice(0, 7)).trim();

        if (!runDate || !/^\d{4}-\d{2}-\d{2}$/.test(runDate)) {
          return res.status(400).json({ error: "วันที่ไม่ถูกต้อง" });
        }
        if (!isRunDateAllowed(runDate, undefined, row.run_date)) {
          return res.status(400).json({ error: "วันที่อยู่นอกช่วงที่อนุญาตให้บันทึก" });
        }
        if (runType !== "discipline" && runType !== "mission") {
          return res.status(400).json({ error: "ประเภทการวิ่งไม่ถูกต้อง" });
        }
        if (!distanceKm || distanceKm <= 0) {
          return res.status(400).json({ error: "ระยะทางต้องมากกว่า 0" });
        }
        if (!durationSec || durationSec <= 0) {
          return res.status(400).json({ error: "เวลาที่ใช้ต้องมากกว่า 0" });
        }
        if (!/^\d{4}-\d{2}$/.test(missionMonth)) {
          return res.status(400).json({ error: "เดือนภารกิจไม่ถูกต้อง" });
        }

        let rejectNote: string | null = null;
        if (nextStatus === "rejected") {
          rejectNote = String(req.body?.rejectNote ?? row.reject_note ?? "").trim();
          if (!rejectNote) {
            return res.status(400).json({ error: "กรุณาระบุเหตุผลที่ไม่ผ่าน" });
          }
        }

        await snapshotEntry(supabase, "run", id, row as unknown as Record<string, unknown>, auth.sub, "staff_edit");

        const { data: updated, error: updateError } = await supabase
          .from("run_entries")
          .update({
            run_date: runDate,
            run_type: runType,
            distance_km: distanceKm,
            duration_sec: durationSec,
            mission_month: missionMonth,
            note,
            ...approvalFieldsForStatus(nextStatus, auth.sub, { rejectNote }),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (updateError) {
          console.error("run staff edit error:", updateError);
          return res.status(500).json({ error: "ไม่สามารถบันทึกการแก้ไขได้" });
        }

        await supabase.from("audit_log").insert({
          actor_id: auth.sub,
          action: "run.staff_edit",
          target_type: "run",
          target_id: id,
          metadata: { status: nextStatus },
        });

        const views = await loadAttachmentViews(supabase, "run", [id]);
        return res.status(200).json({ run: mapRun(updated as DbRunRow, views.get(id)) });
      }

      if (!canApproveEntries(auth)) {
        return res.status(403).json({ error: "เฉพาะหัวหน้าทีมเท่านั้น" });
      }

      const status = req.body?.status;
      if (status !== "approved" && status !== "rejected") {
        return res.status(400).json({ error: "สถานะไม่ถูกต้อง" });
      }

      if (status === "approved") {
        if (!canLeadApprove(row.status)) {
          return res.status(400).json({ error: "อนุมัติได้เฉพาะรายการที่รออนุมัติ" });
        }

        const nowIso = new Date().toISOString();
        const { data: updated, error: updateError } = await supabase
          .from("run_entries")
          .update({
            status: "approved",
            reject_note: null,
            rejected_by: null,
            approved_by: auth.sub,
            approved_at: nowIso,
          })
          .eq("id", id)
          .select("*")
          .single();

        if (updateError) {
          console.error("run approve error:", updateError);
          return res.status(500).json({ error: "ไม่สามารถอนุมัติรายการได้" });
        }

        await supabase.from("audit_log").insert({
          actor_id: auth.sub,
          action: "run.approve",
          target_type: "run",
          target_id: id,
        });

        return res.status(200).json({ run: mapRun(updated as DbRunRow) });
      }

      if (!canLeadReject(row.status)) {
        return res.status(400).json({ error: "ไม่สามารถปฏิเสธรายการนี้ได้" });
      }

      if (row.status === "approved" && !canRejectApproved(auth)) {
        return res.status(403).json({ error: "เฉพาะ Admin เท่านั้นที่สามารถไม่อนุมัติรายการที่อนุมัติแล้วได้" });
      }
      if (row.status === "pending" && !canRejectPending(auth)) {
        return res.status(403).json({ error: "ไม่มีสิทธิ์ไม่อนุมัติรายการนี้" });
      }

      const rejectNote = String(req.body?.rejectNote ?? "").trim();
      if (!rejectNote) {
        return res.status(400).json({ error: "กรุณาระบุเหตุผลที่ไม่ผ่าน" });
      }

      const { data: updated, error: updateError } = await supabase
        .from("run_entries")
        .update({
          status: "rejected",
          reject_note: rejectNote,
          rejected_by: auth.sub,
          approved_by: null,
          approved_at: null,
        })
        .eq("id", id)
        .select("*")
        .single();

      if (updateError) {
        console.error("run reject error:", updateError);
        return res.status(500).json({ error: "ไม่สามารถอัปเดตสถานะได้" });
      }

      await supabase.from("audit_log").insert({
        actor_id: auth.sub,
        action: "run.reject",
        target_type: "run",
        target_id: id,
        metadata: { reject_note: rejectNote },
      });

      return res.status(200).json({ run: mapRun(updated as DbRunRow) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("run id handler error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
}
