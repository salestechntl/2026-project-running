import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../_lib/auth/require.js";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";
import { canAccessEmployee } from "../_lib/team/access.js";
import { mapWeight, validateProofSlot, type DbWeightRow } from "../_lib/entries/map.js";
import {
  loadAttachmentViews,
  migrateLegacyWeightImage,
  snapshotEntry,
  syncEntryAttachments,
} from "../_lib/storage/attachments.js";
import { inlineWeightImageFallback } from "../_lib/storage/inline-fallback.js";

async function enrichWeights(
  supabase: ReturnType<typeof createAdminClient>,
  rows: DbWeightRow[],
  uploadedBy: string,
): Promise<ReturnType<typeof mapWeight>[]> {
  const ids = rows.map((r) => r.id);
  let views = await loadAttachmentViews(supabase, "weight", ids);

  for (const row of rows) {
    if (!views.has(row.id) && row.proof_image) {
      const migrated = await migrateLegacyWeightImage(supabase, row.id, uploadedBy, row.proof_image);
      if (migrated) views = new Map(views).set(row.id, migrated);
    }
  }

  return rows.map((row) => {
    const view = views.get(row.id);
    const image = view?.urls[0] && view.refs[0] ? { url: view.urls[0], ref: view.refs[0] } : undefined;
    return mapWeight(row, image);
  });
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

      const allowed = await canAccessEmployee(supabase, auth.sub, targetId, auth.isLead);
      if (!allowed) return res.status(403).json({ error: "ไม่มีสิทธิ์ดูข้อมูลนี้" });

      const { data, error } = await supabase
        .from("weight_entries")
        .select("*")
        .eq("employee_id", targetId)
        .order("month", { ascending: false })
        .order("period", { ascending: true });

      if (error) {
        console.error("weights list error:", error);
        return res.status(500).json({ error: "ไม่สามารถโหลดข้อมูลน้ำหนักได้" });
      }

      const weights = await enrichWeights(supabase, (data ?? []) as DbWeightRow[], auth.sub);
      return res.status(200).json({ weights });
    }

    if (req.method === "POST") {
      const body = req.body as Record<string, unknown>;
      const employeeId = String(body.employeeId ?? body.employee_id ?? auth.sub).trim();
      const month = String(body.month ?? "").trim();
      const period = body.period;
      const weightKg = Number(body.weightKg ?? body.weight_kg);
      const proofSlot = validateProofSlot(
        body.proofImage ?? body.proof_image,
        body.proofImageRef ?? body.proof_image_ref,
      );

      if (employeeId !== auth.sub) {
        return res.status(403).json({ error: "บันทึกได้เฉพาะข้อมูลของตนเอง" });
      }
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: "เดือนไม่ถูกต้อง" });
      }
      if (period !== "start" && period !== "end") {
        return res.status(400).json({ error: "ช่วงเวลาไม่ถูกต้อง" });
      }
      if (!weightKg || weightKg <= 0) {
        return res.status(400).json({ error: "น้ำหนักต้องมากกว่า 0" });
      }
      if (proofSlot === null) {
        return res.status(400).json({ error: "ภาพน้ำหนักไม่ถูกต้อง กรุณาเลือกรูปใหม่" });
      }
      if (!proofSlot) {
        return res.status(400).json({ error: "แนบภาพน้ำหนัก" });
      }

      const { data: existing } = await supabase
        .from("weight_entries")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("month", month)
        .eq("period", period)
        .maybeSingle();

      const rowPayload = {
        employee_id: employeeId,
        month,
        period,
        weight_kg: weightKg,
        proof_image: null,
        status: "submitted" as const,
        reject_note: null,
        rejected_by: null,
      };

      let entryId: string;
      let row: DbWeightRow;

      if (existing?.id) {
        await snapshotEntry(
          supabase,
          "weight",
          existing.id,
          existing as unknown as Record<string, unknown>,
          auth.sub,
          "edit",
        );

        const { data: updated, error: updateError } = await supabase
          .from("weight_entries")
          .update(rowPayload)
          .eq("id", existing.id)
          .select("*")
          .single();

        if (updateError) {
          console.error("weight update error:", updateError);
          return res.status(500).json({ error: "ไม่สามารถบันทึกน้ำหนักได้" });
        }
        entryId = existing.id;
        row = updated as DbWeightRow;
      } else {
        const { data: created, error: insertError } = await supabase
          .from("weight_entries")
          .insert(rowPayload)
          .select("*")
          .single();

        if (insertError) {
          console.error("weight insert error:", insertError);
          return res.status(500).json({ error: "ไม่สามารถบันทึกน้ำหนักได้" });
        }

        entryId = (created as DbWeightRow).id;
        row = created as DbWeightRow;

        await supabase.from("audit_log").insert({
          actor_id: auth.sub,
          action: "weight.create",
          target_type: "weight",
          target_id: entryId,
        });
      }

      const attached = await syncEntryAttachments(supabase, "weight", entryId, auth.sub, [proofSlot], { max: 1 });
      const view =
        "error" in attached
          ? (await inlineWeightImageFallback(supabase, entryId, proofSlot)) ?? attached
          : attached;
      if ("error" in view) {
        return res.status(400).json({ error: view.error });
      }

      const image = { url: view.urls[0], ref: view.refs[0] };
      return res.status(existing?.id ? 200 : 201).json({ weight: mapWeight(row, image) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("weights handler error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
}
