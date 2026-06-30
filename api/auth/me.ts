import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bearerToken, verifyToken } from "../_lib/auth/jwt.js";
import type { AuthUser, MeResponse } from "../_lib/auth/types.js";
import { isCheckerRole, normalizeDbRole } from "../_lib/auth/roles.js";
import { handleHealthCheck } from "../_lib/health.js";
import { loadHomeStats } from "../_lib/home/stats.js";
import { createAdminClient, isSupabaseConfigured } from "../_lib/supabase/admin.js";

function canManageTeam(isLead: boolean, role: string): boolean {
  return isLead || isCheckerRole(role) || role === "super_admin";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.query.health === "1") {
    return handleHealthCheck(res);
  }

  const token = bearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = verifyToken(token);
    const role = normalizeDbRole(payload.role);
    const user: AuthUser = {
      id: payload.sub,
      name: payload.name,
      position: payload.position,
      department: payload.department,
      managerId: payload.managerId,
      role,
    };

    const isChecker = isCheckerRole(payload.role);
    const isSuperAdmin = payload.role === "super_admin";
    const manageTeam = canManageTeam(payload.isLead, payload.role);

    const body: MeResponse = {
      user,
      isLead: payload.isLead,
      isChecker,
      isSuperAdmin,
    };

    const includeHome = req.query.include === "home" || req.query.home === "1";
    if (includeHome) {
      if (!isSupabaseConfigured()) {
        return res.status(503).json({ error: "Supabase is not configured on the server" });
      }
      try {
        const supabase = createAdminClient();
        body.home = await loadHomeStats(supabase, payload.sub, payload.role, manageTeam);
      } catch (err) {
        console.error("home stats error:", err);
        return res.status(500).json({ error: "ไม่สามารถโหลดสถิติหน้าแรกได้" });
      }
    }

    return res.status(200).json(body);
  } catch {
    return res.status(401).json({ error: "Session expired or invalid" });
  }
}
