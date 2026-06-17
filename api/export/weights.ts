import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSuperAdmin } from "../_lib/auth/require.js";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";
import { csvFilename, sendCsv, toCsv } from "../_lib/export/csv.js";

const HEADERS = [
  "id",
  "employee_id",
  "month",
  "period",
  "weight_kg",
  "status",
  "reject_note",
  "rejected_by",
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
      .from("weight_entries")
      .select(HEADERS.join(", "))
      .order("month", { ascending: false })
      .order("period", { ascending: true });

    if (error) {
      console.error("export weights error:", error);
      return res.status(500).json({ error: "ดึงข้อมูลน้ำหนักไม่สำเร็จ" });
    }

    const rows = (data ?? []).map((row) => {
      const r = row as unknown as Record<string, unknown>;
      return HEADERS.map((h) => r[h]);
    });

    await supabase.from("audit_log").insert({
      actor_id: admin.sub,
      action: "export.weights",
      target_type: "export",
      metadata: { row_count: rows.length, format: "csv" },
    });

    return sendCsv(res, csvFilename("weight_entries"), toCsv(HEADERS, rows));
  } catch (err) {
    console.error("export weights handler error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
}
