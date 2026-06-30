import type { VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

function resolveSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;
  return { url, key };
}

function describeKey(key: string | undefined): string {
  if (!key) return "missing";
  if (key.startsWith("sb_publishable_")) return "publishable_wrong_for_server";
  if (key.startsWith("sb_secret_")) return "sb_secret";
  if (key.startsWith("eyJ")) return "legacy_service_role_jwt";
  return "unknown_format";
}

/** Safe connectivity check — no secrets in response */
export async function handleHealthCheck(res: VercelResponse) {
  const { url, key } = resolveSupabaseConfig();

  if (!url || !key) {
    return res.status(503).json({
      ok: false,
      configured: false,
      error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    });
  }

  let host = "invalid_url";
  try {
    host = new URL(url).hostname;
  } catch {
    return res.status(503).json({
      ok: false,
      configured: true,
      supabaseHost: host,
      keyKind: describeKey(key),
      error: { message: "SUPABASE_URL is not a valid URL" },
    });
  }

  const keyKind = describeKey(key);
  if (keyKind === "publishable_wrong_for_server") {
    return res.status(503).json({
      ok: false,
      configured: true,
      supabaseHost: host,
      keyKind,
      error: {
        message:
          "SUPABASE_SERVICE_ROLE_KEY looks like a publishable key — use sb_secret_... or legacy service_role JWT",
      },
    });
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: countError } = await supabase
    .from("employees")
    .select("employee_id", { head: true, count: "exact" });

  const { error: columnError } = countError
    ? { error: countError }
    : await supabase
        .from("employees")
        .select("password_hash")
        .limit(1);

  const error = countError ?? columnError;
  if (error) {
    return res.status(503).json({
      ok: false,
      configured: true,
      supabaseHost: host,
      keyKind,
      error: {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
    });
  }

  return res.status(200).json({
    ok: true,
    configured: true,
    supabaseHost: host,
    keyKind,
  });
}
