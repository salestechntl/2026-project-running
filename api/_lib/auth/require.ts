import type { VercelRequest } from "@vercel/node";
import { bearerToken, verifyToken } from "./jwt.js";
import type { JwtPayload } from "./types.js";

export function requireAuth(req: VercelRequest): JwtPayload | null {
  const token = bearerToken(req.headers.authorization);
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function requireSuperAdmin(req: VercelRequest): JwtPayload | null {
  const user = requireAuth(req);
  if (!user || user.role !== "super_admin") return null;
  return user;
}
