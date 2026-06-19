import { useCallback, useEffect, useState } from "react";
import { DATA_CHANGED_EVENT, fetchRuns, fetchWeights } from "../entries";
import type { RunEntry, WeightEntry } from "../store";
import { holdLoading } from "./loading";

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

export function useRuns(employeeId: string | undefined) {
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!employeeId) {
      setRuns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const startedAt = Date.now();
    try {
      setRuns(await fetchRuns(employeeId));
    } catch (e) {
      console.error("useRuns:", e);
      setRuns([]);
    } finally {
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [refresh]);

  return { runs, loading, refresh };
}

export function useWeights(employeeId: string | undefined, month?: string) {
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!employeeId) {
      setWeights([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const startedAt = Date.now();
    try {
      const rows = await fetchWeights(employeeId);
      setWeights(month ? rows.filter((w) => w.month === month) : rows);
    } catch (e) {
      console.error("useWeights:", e);
      setWeights([]);
    } finally {
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [employeeId, month]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [refresh]);

  return { weights, loading, refresh };
}
