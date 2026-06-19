/** หน่วงขั้นต่ำเพื่อให้เห็น spinner ใน dev — ปิดด้วย VITE_LOADING_DEMO_MS=0 */
export function loadingHoldMs(): number {
  const v = import.meta.env.VITE_LOADING_DEMO_MS;
  if (v === "0" || v === "false") return 0;
  if (v != null && v !== "") return Math.max(0, Number(v) || 0);
  return import.meta.env.DEV ? 400 : 0;
}

export async function holdLoading(startedAt: number): Promise<void> {
  const hold = loadingHoldMs();
  const wait = hold - (Date.now() - startedAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
