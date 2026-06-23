import { useCallback, useEffect, useState } from "react";
import { DATA_CHANGED_EVENT, fetchRuns, fetchWeights } from "../entries";
import type { RunEntry, WeightEntry } from "../store";
import { holdLoading } from "./loading";

type FetchOptions = { silent?: boolean };

type UseEntriesOptions = {
  /** ฟัง DATA_CHANGED_EVENT แล้ว refresh อัตโนมัติ (ปิดในหน้า Admin ที่อัปเดตแบบ optimistic) */
  listenChanges?: boolean;
};

/** นับรายการวิ่ง + น้ำหนักที่หัวหน้าขอให้แก้ไข */
export function countRejectedEntries(runs: RunEntry[], weights: WeightEntry[]): number {
  return (
    runs.filter((r) => r.status === "rejected").length +
    weights.filter((w) => w.status === "rejected").length
  );
}

/** จำนวนรายการที่ต้องแก้ไข — สำหรับ badge เมนูบันทึกข้อมูล */
export function useRejectedEntryCount(employeeId: string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!employeeId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    const recompute = async () => {
      try {
        const [runs, weights] = await Promise.all([
          fetchRuns(employeeId),
          fetchWeights(employeeId),
        ]);
        if (!cancelled) setCount(countRejectedEntries(runs, weights));
      } catch (e) {
        console.error("useRejectedEntryCount:", e);
        if (!cancelled) setCount(0);
      }
    };
    void recompute();
    const onChange = () => void recompute();
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(DATA_CHANGED_EVENT, onChange);
    };
  }, [employeeId]);

  return count;
}

export function useRuns(employeeId: string | undefined, options?: UseEntriesOptions) {
  const listenChanges = options?.listenChanges !== false;
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRuns([]);
    setLoading(true);
  }, [employeeId]);

  const refresh = useCallback(
    async (fetchOptions?: FetchOptions) => {
      if (!employeeId) {
        setRuns([]);
        setLoading(false);
        return;
      }
      const silent = fetchOptions?.silent === true;
      if (!silent) setLoading(true);
      const startedAt = Date.now();
      try {
        setRuns(await fetchRuns(employeeId));
      } catch (e) {
        console.error("useRuns:", e);
        if (!silent) setRuns([]);
      } finally {
        if (!silent) {
          await holdLoading(startedAt);
          setLoading(false);
        }
      }
    },
    [employeeId],
  );

  const patchRun = useCallback((id: string, patch: Partial<RunEntry>) => {
    setRuns((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: patch.updatedAt ?? Date.now() } : r)),
    );
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!listenChanges) return;
    const onChange = () => void refresh({ silent: true });
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [refresh, listenChanges]);

  return { runs, loading, refresh, patchRun };
}

export function useWeights(
  employeeId: string | undefined,
  month?: string,
  options?: UseEntriesOptions,
) {
  const listenChanges = options?.listenChanges !== false;
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setWeights([]);
    setLoading(true);
  }, [employeeId, month]);

  const refresh = useCallback(
    async (fetchOptions?: FetchOptions) => {
      if (!employeeId) {
        setWeights([]);
        setLoading(false);
        return;
      }
      const silent = fetchOptions?.silent === true;
      if (!silent) setLoading(true);
      const startedAt = Date.now();
      try {
        const rows = await fetchWeights(employeeId);
        setWeights(month ? rows.filter((w) => w.month === month) : rows);
      } catch (e) {
        console.error("useWeights:", e);
        if (!silent) setWeights([]);
      } finally {
        if (!silent) {
          await holdLoading(startedAt);
          setLoading(false);
        }
      }
    },
    [employeeId, month],
  );

  const patchWeight = useCallback((id: string, patch: Partial<WeightEntry>) => {
    setWeights((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: patch.updatedAt ?? Date.now() } : w)),
    );
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!listenChanges) return;
    const onChange = () => void refresh({ silent: true });
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [refresh, listenChanges]);

  return { weights, loading, refresh, patchWeight };
}
