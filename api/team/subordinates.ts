import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth } from "../_lib/auth/require.js";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";
import { fetchActiveEmployees, subordinatesFromRows } from "../_lib/team/access.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = requireAuth(req);
  if (!auth) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "Supabase is not configured on the server" });
  }

  try {
    const supabase = createAdminClient();
    const rows = await fetchActiveEmployees(supabase);
    const team = subordinatesFromRows(auth.sub, rows);
    return res.status(200).json({ team });
  } catch (err) {
    console.error("subordinates error:", err);
    return res.status(500).json({ error: "ไม่สามารถโหลดข้อมูลทีมได้" });
  }
}
