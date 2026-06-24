import type { VercelRequest, VercelResponse } from "@vercel/node";
import { bearerToken, verifyToken } from "../_lib/auth/jwt.js";
import type { AuthUser, MeResponse } from "../_lib/auth/types.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = bearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = verifyToken(token);
    const user: AuthUser = {
      id: payload.sub,
      name: payload.name,
      position: payload.position,
      department: payload.department,
      managerId: payload.managerId,
      role: payload.role,
    };

    const body: MeResponse = {
      user,
      isLead: payload.isLead,
      isAdmin: payload.role === "admin",
      isSuperAdmin: payload.role === "super_admin",
    };

    return res.status(200).json(body);
  } catch {
    return res.status(401).json({ error: "Session expired or invalid" });
  }
}
