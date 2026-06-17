import jwt from "jsonwebtoken";
import { loadLocalEnv } from "../env.js";
import type { JwtPayload } from "./types.js";

const ISSUER = "running-camp-2026";
const AUDIENCE = "running-camp-app";
const EXPIRY = "12h";

function getSecret(): string {
  loadLocalEnv();
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign({ ...payload }, getSecret(), {
    expiresIn: EXPIRY,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as JwtPayload;
}

export function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7).trim() || null;
}
