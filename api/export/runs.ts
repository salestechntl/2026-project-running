import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSuperAdmin } from "../_lib/auth/require.js";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";
import { csvFilename, sendCsv, toCsv } from "../_lib/export/csv.js";

const HEADERS = [
  "id",
  "employee_id",
  "run_date",
  "run_type",
  "distance_km",
  "duration_sec",
  "mission_month",
  "note",
  "status",
  "reject_note",
  "staff_edit_note",
  "rejected_by",
  "approved_by",
  "approved_at",
  "created_at",
  "updated_at",
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = requireSuperAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: "เฉพาะ Super Admin เท่านั้น" });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured on the server" });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("run_entries")
      .select(HEADERS.join(", "))
      .order("run_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("export runs error:", error);
      return res.status(500).json({ error: "ดึงข้อมูลการวิ่งไม่สำเร็จ" });
    }

    const rows = (data ?? []).map((row) => {
      const r = row as unknown as Record<string, unknown>;
      return HEADERS.map((h) => r[h]);
    });

    await supabase.from("audit_log").insert({
      actor_id: admin.sub,
      action: "export.runs",
      target_type: "export",
      metadata: { row_count: rows.length, format: "csv" },
    });

    return sendCsv(res, csvFilename("run_entries"), toCsv(HEADERS, rows));
  } catch (err) {
    console.error("export runs handler error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
}
