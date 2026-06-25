import { useCallback, useEffect, useState } from "react";
import { DATA_CHANGED_EVENT, fetchHomeStats, fetchRunHistory, fetchRuns, fetchWeights, RUN_HISTORY_PAGE_SIZE, type HomeStats } from "../entries";
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

export function useHomeStats(
  employeeId: string | undefined,
  manageTeam: boolean,
  managerId: string | undefined,
) {
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!employeeId) {
      setStats(null);
      setLoading(false);
      return;
    }
    const mgrId = managerId ?? employeeId;
    setLoading(true);
    const startedAt = Date.now();
    try {
      setStats(await fetchHomeStats(employeeId, { manageTeam, managerId: mgrId }));
    } catch (e) {
      console.error("useHomeStats:", e);
      setStats(null);
    } finally {
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [employeeId, manageTeam, managerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [refresh]);

  return { stats, loading, refresh };
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

/** ประวัติการวิ่งแบบ server-side pagination — โหลดเฉพาะหน้าที่แสดง */
export function useRunHistory(employeeId: string | undefined, pageSize = RUN_HISTORY_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const refresh = useCallback(
    async (opts?: { silent?: boolean; page?: number }) => {
      if (!employeeId) {
        setRuns([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      const targetPage = opts?.page ?? page;
      const silent = opts?.silent === true;
      if (!silent) setLoading(true);
      const startedAt = Date.now();
      try {
        const data = await fetchRunHistory(employeeId, targetPage, pageSize);
        setRuns(data.runs);
        setTotal(data.total);
        if (data.page !== page) setPage(data.page);
      } catch (e) {
        console.error("useRunHistory:", e);
        if (!silent) {
          setRuns([]);
          setTotal(0);
        }
      } finally {
        if (!silent) {
          await holdLoading(startedAt);
          setLoading(false);
        }
      }
    },
    [employeeId, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
    setRuns([]);
    setTotal(0);
    setLoading(true);
  }, [employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh({ silent: true, page });
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [refresh, page]);

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(1, next), totalPages);
      setPage(clamped);
    },
    [totalPages],
  );

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  return { runs, total, page, totalPages, loading, refresh, goToPage, pageSize };
}

export function useWeights(
  employeeId: string | undefined,
  month?: string,
  options?: UseEntriesOptions & { lite?: boolean },
) {
  const listenChanges = options?.listenChanges !== false;
  const lite = options?.lite === true;
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
        const rows = await fetchWeights(employeeId, lite ? { lite: true } : undefined);
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
    [employeeId, month, lite],
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
