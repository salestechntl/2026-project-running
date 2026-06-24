import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSuperAdmin } from "../_lib/auth/require.js";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";
import { parseOrgCsv, validateOrgRows, sortOrgForUpsert, type OrgRow } from "../_lib/org/parse.js";

interface ImportBody {
  mode?: "preview" | "commit";
  file_name?: string;
  csv?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = requireSuperAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: "เฉพาะ Super Admin เท่านั้น" });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured on the server" });
  }

  const body = req.body as ImportBody;
  const mode = body.mode === "commit" ? "commit" : "preview";
  const fileName = String(body.file_name ?? "import.csv").trim() || "import.csv";
  const csv = String(body.csv ?? "");

  if (!csv.trim()) {
    return res.status(400).json({ error: "กรุณาส่งข้อมูล CSV" });
  }

  try {
    const supabase = createAdminClient();
    const parsed = parseOrgCsv(csv);

    if (parsed.errors.length > 0) {
      return res.status(400).json({
        ok: false,
        mode,
        file_name: fileName,
        row_count: parsed.rows.length,
        error_count: parsed.errors.length,
        errors: parsed.errors,
        rows: parsed.rows,
      });
    }

    const { data: existing } = await supabase.from("employees").select("employee_id");
    const existingIds = new Set((existing ?? []).map((e) => e.employee_id as string));
    const validationErrors = validateOrgRows(parsed.rows, existingIds);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        ok: false,
        mode,
        file_name: fileName,
        row_count: parsed.rows.length,
        error_count: validationErrors.length,
        errors: validationErrors,
        rows: parsed.rows,
      });
    }

    const importedIds = new Set(parsed.rows.map((r) => r.employee_id));
    const toDeactivate = [...existingIds].filter((id) => !importedIds.has(id));

    const preview = {
      ok: true,
      mode,
      file_name: fileName,
      row_count: parsed.rows.length,
      error_count: 0,
      summary: {
        upsert: parsed.rows.length,
        deactivate: toDeactivate.length,
        new: parsed.rows.filter((r) => !existingIds.has(r.employee_id)).length,
      },
      rows: parsed.rows,
      deactivate_ids: toDeactivate,
    };

    if (mode === "preview") {
      return res.status(200).json(preview);
    }

    // --- commit ---
    const { data: batch, error: batchErr } = await supabase
      .from("org_import_batches")
      .insert({
        uploaded_by: admin.sub,
        file_name: fileName,
        row_count: parsed.rows.length,
        error_count: 0,
        status: "committed",
      })
      .select("id")
      .single();

    if (batchErr || !batch) {
      console.error("batch insert error:", batchErr);
      return res.status(500).json({ error: "ไม่สามารถสร้าง batch ได้" });
    }

    const batchId = batch.id as string;

    // Preserve elevated roles for existing employees on org re-import
    const { data: roles } = await supabase
      .from("employees")
      .select("employee_id, role")
      .in("role", ["super_admin", "admin"]);
    const roleById = new Map((roles ?? []).map((r) => [r.employee_id as string, r.role as string]));

    const upsertRows = sortOrgForUpsert(parsed.rows).map((r: OrgRow) => ({
      employee_id: r.employee_id,
      name: r.name,
      position: r.position || "",
      department: r.department || "",
      manager_id: r.manager_id,
      is_active: true,
      import_batch_id: batchId,
      role: roleById.get(r.employee_id) ?? "employee",
    }));

    const { error: upsertErr } = await supabase.from("employees").upsert(upsertRows, { onConflict: "employee_id" });
    if (upsertErr) {
      console.error("upsert error:", upsertErr);
      await supabase.from("org_import_batches").update({ status: "failed", error_count: 1 }).eq("id", batchId);
      return res.status(500).json({ error: "บันทึกข้อมูลพนักงานไม่สำเร็จ" });
    }

    // Deactivate employees not in file (never deactivate super_admin or admin)
    if (toDeactivate.length > 0) {
      const protectedIds = new Set(roleById.keys());
      const deactivateIds = toDeactivate.filter((id) => !protectedIds.has(id));
      if (deactivateIds.length > 0) {
        await supabase
          .from("employees")
          .update({ is_active: false, import_batch_id: batchId })
          .in("employee_id", deactivateIds);
      }
    }

    await supabase.from("audit_log").insert({
      actor_id: admin.sub,
      action: "org.imported",
      target_type: "org_import_batch",
      target_id: batchId,
      metadata: {
        file_name: fileName,
        row_count: parsed.rows.length,
        deactivated: toDeactivate.filter((id) => !roleById.has(id)).length,
      },
    });

    return res.status(200).json({
      ...preview,
      mode: "commit",
      batch_id: batchId,
      message: `นำเข้าสำเร็จ ${parsed.rows.length} คน`,
    });
  } catch (err) {
    console.error("org import error:", err);
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดภายในระบบ";
    return res.status(500).json({ error: message });
  }
}
