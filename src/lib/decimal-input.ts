/** กรองให้เหลือตัวเลขและจุดทศนิยมอย่างมากหนึ่งจุด */
export function sanitizeDecimalInput(raw: string, maxDecimals = 2): string {
  let s = raw.replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot === -1) return s;

  s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  const [intPart, fracPart = ""] = s.split(".");
  if (fracPart === undefined) return intPart;
  if (s.endsWith(".") && fracPart === "") return `${intPart}.`;
  return `${intPart}.${fracPart.slice(0, maxDecimals)}`;
}

export function parseDecimalValue(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === ".") return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** จัดรูปแบบทศนิยมคงที่ — 5 → 5.00 */
export function formatFixedDecimals(value: string, decimals: number): string {
  const n = parseDecimalValue(value);
  if (n === null) return value.trim() === "" ? "" : value;
  return n.toFixed(decimals);
}

export function validateDecimalRange(
  value: string,
  opts: { min?: number; max?: number; minExclusive?: boolean },
): string | null {
  const n = parseDecimalValue(value);
  if (n === null) return "กรุณากรอกตัวเลข";
  const min = opts.min ?? 0;
  if (opts.minExclusive ? n <= min : n < min) {
    return opts.minExclusive ? `ต้องมากกว่า ${min}` : `ต้องไม่ต่ำกว่า ${min}`;
  }
  if (opts.max != null && n > opts.max) return `ต้องไม่เกิน ${opts.max.toFixed(2)}`;
  return null;
}
