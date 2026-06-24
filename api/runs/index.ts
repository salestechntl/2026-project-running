import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../_lib/auth/require.js";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";
import { canAccessEmployee, canApproveEntries, canSelfApprove } from "../_lib/team/access.js";
import { mapRun, validateImageSlots, type DbRunRow } from "../_lib/entries/map.js";
import { mapRunDbError } from "../_lib/entries/db-error.js";
import { attachRunImages } from "../_lib/entries/attach-run-images.js";
import { isRunDateAllowed } from "../_lib/entries/run-date-bounds.js";
import { resolveSubmitStatus } from "../_lib/entries/status.js";
import {
  loadAttachmentViews,
  migrateLegacyRunImages,
  snapshotEntry,
} from "../_lib/storage/attachments.js";

async function enrichRuns(
  supabase: ReturnType<typeof createAdminClient>,
  rows: DbRunRow[],
  uploadedBy: string,
): Promise<ReturnType<typeof mapRun>[]> {
  const ids = rows.map((r) => r.id);
  let views = await loadAttachmentViews(supabase, "run", ids);

  for (const row of rows) {
    if (!views.has(row.id) && row.strava_images?.length) {
      const migrated = await migrateLegacyRunImages(supabase, row.id, uploadedBy, row.strava_images);
      if (migrated) views = new Map(views).set(row.id, migrated);
    }
  }

  return rows.map((row) => mapRun(row, views.get(row.id)));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = requireAuth(req);
  if (!auth) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured on the server" });
  }

  try {
    const supabase = createAdminClient();

    if (req.method === "GET") {
      const targetId = String(req.query.employee_id ?? auth.sub).trim();
      if (!targetId) return res.status(400).json({ error: "กรุณาระบุรหัสพนักงาน" });

      const allowed = await canAccessEmployee(supabase, auth.sub, targetId, auth);
      if (!allowed) return res.status(403).json({ error: "ไม่มีสิทธิ์ดูข้อมูลนี้" });

      const { data, error } = await supabase
        .from("run_entries")
        .select("*")
        .eq("employee_id", targetId)
        .order("run_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.error("runs list error:", error);
        return res.status(500).json({ error: "ไม่สามารถโหลดข้อมูลการวิ่งได้" });
      }

      const runs = await enrichRuns(supabase, (data ?? []) as DbRunRow[], auth.sub);
      return res.status(200).json({ runs });
    }

    if (req.method === "POST") {
      const body = req.body as Record<string, unknown>;
      const employeeId = String(body.employeeId ?? body.employee_id ?? auth.sub).trim();
      const id = body.id ? String(body.id) : undefined;
      const date = String(body.date ?? "").trim();
      const runType = body.runType ?? body.run_type;
      const distanceKm = Number(body.distanceKm ?? body.distance_km);
      const durationSec = Number(body.durationSec ?? body.duration_sec);
      const missionTag = (() => {
        const fromBody = String(body.missionTag ?? body.mission_month ?? "").trim();
        if (/^\d{4}-\d{2}$/.test(fromBody)) return fromBody;
        return date.slice(0, 7);
      })();
      const note = body.note ? String(body.note).trim() : null;
      const skipImages = body.skipImages === true;
      const imageSlots = skipImages
        ? []
        : validateImageSlots(
            body.stravaImages ?? body.strava_images,
            body.stravaImageRefs ?? body.strava_image_refs,
          );

      if (employeeId !== auth.sub) {
        return res.status(403).json({ error: "บันทึกได้เฉพาะข้อมูลของตนเอง" });
      }
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "วันที่ไม่ถูกต้อง" });
      }

      let existingRow: DbRunRow | undefined;
      if (id) {
        const { data: existing, error: fetchError } = await supabase
          .from("run_entries")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (fetchError || !existing) {
          return res.status(404).json({ error: "ไม่พบรายการที่ต้องการแก้ไข" });
        }
        existingRow = existing as DbRunRow;
        if (existingRow.employee_id !== auth.sub) {
          return res.status(403).json({ error: "แก้ไขได้เฉพาะรายการของตนเอง" });
        }
      }

      if (!isRunDateAllowed(date, undefined, existingRow?.run_date)) {
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
      if (!skipImages && imageSlots === null) {
        return res.status(400).json({ error: "ภาพกิจกรรมไม่ถูกต้อง กรุณาเลือกรูปใหม่" });
      }

      if (id) {
        const row = existingRow!;
        if (row.status === "rejected") {
          return res.status(400).json({ error: "รายการที่ไม่ผ่านแล้วแก้ไขไม่ได้ กรุณาส่งรายการใหม่" });
        }
        if (!canApproveEntries(auth) && row.status !== "pending") {
          return res.status(400).json({ error: "แก้ไขได้เฉพาะรายการที่รออนุมัติ" });
        }
      }

      const isLeadSelf = canSelfApprove(auth, employeeId, auth.sub);
      const status = resolveSubmitStatus(isLeadSelf);
      const nowIso = new Date().toISOString();
      const approvalFields =
        status === "approved"
          ? { approved_by: auth.sub, approved_at: nowIso }
          : { approved_by: null, approved_at: null };

      const rowPayload = {
        run_date: date,
        run_type: runType,
        distance_km: distanceKm,
        duration_sec: durationSec,
        mission_month: missionTag,
        note,
        status,
        reject_note: null,
        rejected_by: null,
        ...approvalFields,
      };

      if (id) {
        const row = existingRow!;
        await snapshotEntry(supabase, "run", id, row as unknown as Record<string, unknown>, auth.sub, "edit");

        const { data: updated, error: updateError } = await supabase
          .from("run_entries")
          .update(rowPayload)
          .eq("id", id)
          .select("*")
          .single();

        if (updateError) {
          console.error("run update error:", updateError);
          return res.status(500).json({ error: mapRunDbError(updateError, "update") });
        }

        if (!skipImages) {
          if (imageSlots === null) {
            return res.status(400).json({ error: "ภาพกิจกรรมไม่ถูกต้อง กรุณาเลือกรูปใหม่" });
          }
          const attached = await attachRunImages(supabase, id, auth.sub, imageSlots);
          if ("error" in attached) {
            return res.status(400).json({ error: attached.error });
          }
          return res.status(200).json({ run: mapRun(updated as DbRunRow, attached) });
        }

        return res.status(200).json({ run: mapRun(updated as DbRunRow) });
      }

      const { data: created, error: insertError } = await supabase
        .from("run_entries")
        .insert({
          employee_id: employeeId,
          ...rowPayload,
        })
        .select("*")
        .single();

      if (insertError) {
        console.error("run insert error:", insertError);
        return res.status(500).json({ error: mapRunDbError(insertError, "insert") });
      }

      const runId = (created as DbRunRow).id;

      if (!skipImages) {
        if (imageSlots === null) {
          return res.status(400).json({ error: "ภาพกิจกรรมไม่ถูกต้อง กรุณาเลือกรูปใหม่" });
        }
        const attached = await attachRunImages(supabase, runId, auth.sub, imageSlots);
        if ("error" in attached) {
          await supabase.from("run_entries").delete().eq("id", runId);
          return res.status(400).json({ error: attached.error });
        }

        await supabase.from("audit_log").insert({
          actor_id: auth.sub,
          action: "run.create",
          target_type: "run",
          target_id: runId,
        });

        return res.status(201).json({ run: mapRun(created as DbRunRow, attached) });
      }

      await supabase.from("audit_log").insert({
        actor_id: auth.sub,
        action: "run.create",
        target_type: "run",
        target_id: runId,
      });

      return res.status(201).json({ run: mapRun(created as DbRunRow) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("runs handler error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
}
