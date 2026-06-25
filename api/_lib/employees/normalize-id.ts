/** Canonical employee_id: trim + uppercase ASCII letters (e.g. AS123456). */
export function normalizeEmployeeId(raw: string): string {
  return raw.trim().toLocaleUpperCase("en-US");
}
