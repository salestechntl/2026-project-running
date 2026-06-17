import { useCallback, useEffect, useState } from "react";
import { DATA_CHANGED_EVENT, fetchRuns, fetchWeights } from "../entries";
import type { RunEntry, WeightEntry } from "../store";

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
    try {
      setRuns(await fetchRuns(employeeId));
    } catch (e) {
      console.error("useRuns:", e);
      setRuns([]);
    } finally {
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
    try {
      const rows = await fetchWeights(employeeId);
      setWeights(month ? rows.filter((w) => w.month === month) : rows);
    } catch (e) {
      console.error("useWeights:", e);
      setWeights([]);
    } finally {
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
