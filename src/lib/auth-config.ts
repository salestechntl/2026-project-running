/** Auth mode: "api" = Supabase + JWT via Vercel Functions, "local" = mock data in browser */

export type AuthMode = "api" | "local";

export function getAuthMode(): AuthMode {
  const forced = import.meta.env.VITE_AUTH_MODE as AuthMode | undefined;
  if (forced === "api" || forced === "local") return forced;
  return import.meta.env.VITE_SUPABASE_URL ? "api" : "local";
}
