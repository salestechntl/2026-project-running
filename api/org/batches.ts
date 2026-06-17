import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireSuperAdmin } from "../_lib/auth/require.js";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireSuperAdmin(req)) {
    return res.status(403).json({ error: "เฉพาะ Super Admin เท่านั้น" });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured on the server" });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("org_import_batches")
      .select("id, uploaded_by, file_name, row_count, error_count, status, uploaded_at")
      .order("uploaded_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("batches query error:", error);
      return res.status(500).json({ error: "ดึงประวัติไม่สำเร็จ" });
    }

    return res.status(200).json({ batches: data ?? [] });
  } catch (err) {
    console.error("batches error:", err);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
}
