import { useCallback, useEffect, useState } from "react";
import { runGuardedLoad } from "../async-load";
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
  const [loadSlow, setLoadSlow] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!employeeId) {
      setStats(null);
      setLoading(false);
      setLoadSlow(false);
      setLoadError(null);
      return;
    }
    const mgrId = managerId ?? employeeId;
    setLoading(true);
    setLoadSlow(false);
    setLoadError(null);
    const startedAt = Date.now();

    await runGuardedLoad(
      () => fetchHomeStats(employeeId, { manageTeam, managerId: mgrId }),
      {
        onSlow: () => setLoadSlow(true),
        onSettled: (result) => {
          if (result.ok) {
            setStats(result.value);
            setLoadError(null);
          } else {
            setStats(null);
            setLoadError(result.message);
          }
          setLoading(false);
          setLoadSlow(false);
        },
      },
    );

    await holdLoading(startedAt);
  }, [employeeId, manageTeam, managerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh();
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [refresh]);

  return { stats, loading, loadSlow, loadError, refresh };
}

export function useRuns(employeeId: string | undefined, options?: UseEntriesOptions) {
  const listenChanges = options?.listenChanges !== false;
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadSlow, setLoadSlow] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setRuns([]);
    setLoading(true);
    setLoadError(null);
  }, [employeeId]);

  const refresh = useCallback(
    async (fetchOptions?: FetchOptions) => {
      if (!employeeId) {
        setRuns([]);
        setLoading(false);
        setLoadError(null);
        return;
      }
      const silent = fetchOptions?.silent === true;
      if (!silent) {
        setLoading(true);
        setLoadSlow(false);
        setLoadError(null);
      }
      const startedAt = Date.now();

      await runGuardedLoad(
        () => fetchRuns(employeeId),
        {
          onSlow: () => {
            if (!silent) setLoadSlow(true);
          },
          onSettled: (result) => {
            if (result.ok) {
              setRuns(result.value);
              setLoadError(null);
            } else if (!silent) {
              setRuns([]);
              setLoadError(result.message);
            }
            if (!silent) {
              setLoading(false);
              setLoadSlow(false);
            }
          },
        },
      );

      if (!silent) await holdLoading(startedAt);
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

  return { runs, loading, loadSlow, loadError, refresh, patchRun };
}

/** ประวัติการวิ่งแบบ server-side pagination — โหลดเฉพาะหน้าที่แสดง */
export function useRunHistory(employeeId: string | undefined, pageSize = RUN_HISTORY_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadSlow, setLoadSlow] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const refresh = useCallback(
    async (opts?: { silent?: boolean; page?: number }) => {
      if (!employeeId) {
        setRuns([]);
        setTotal(0);
        setLoading(false);
        setLoadError(null);
        return;
      }
      const targetPage = opts?.page ?? page;
      const silent = opts?.silent === true;
      if (!silent) {
        setLoading(true);
        setLoadSlow(false);
        setLoadError(null);
      }
      const startedAt = Date.now();

      await runGuardedLoad(
        () => fetchRunHistory(employeeId, targetPage, pageSize),
        {
          onSlow: () => {
            if (!silent) setLoadSlow(true);
          },
          onSettled: (result) => {
            if (result.ok) {
              setRuns(result.value.runs);
              setTotal(result.value.total);
              const resolvedPage = opts?.page ?? result.value.page;
              if (resolvedPage !== page) setPage(resolvedPage);
              setLoadError(null);
            } else if (!silent) {
              setRuns([]);
              setTotal(0);
              setLoadError(result.message);
            }
            if (!silent) {
              setLoading(false);
              setLoadSlow(false);
            }
          },
        },
      );

      if (!silent) await holdLoading(startedAt);
    },
    [employeeId, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
    setRuns([]);
    setTotal(0);
    setLoading(true);
    setLoadError(null);
  }, [employeeId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => void refresh({ silent: true, page: 1 });
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [refresh]);

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

  return { runs, total, page, totalPages, loading, loadSlow, loadError, refresh, goToPage, pageSize };
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
  const [loadSlow, setLoadSlow] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setWeights([]);
    setLoading(true);
    setLoadError(null);
  }, [employeeId, month]);

  const refresh = useCallback(
    async (fetchOptions?: FetchOptions) => {
      if (!employeeId) {
        setWeights([]);
        setLoading(false);
        setLoadError(null);
        return;
      }
      const silent = fetchOptions?.silent === true;
      if (!silent) {
        setLoading(true);
        setLoadSlow(false);
        setLoadError(null);
      }
      const startedAt = Date.now();

      await runGuardedLoad(
        async () => {
          const rows = await fetchWeights(employeeId, lite ? { lite: true } : undefined);
          return month ? rows.filter((w) => w.month === month) : rows;
        },
        {
          onSlow: () => {
            if (!silent) setLoadSlow(true);
          },
          onSettled: (result) => {
            if (result.ok) {
              setWeights(result.value);
              setLoadError(null);
            } else if (!silent) {
              setWeights([]);
              setLoadError(result.message);
            }
            if (!silent) {
              setLoading(false);
              setLoadSlow(false);
            }
          },
        },
      );

      if (!silent) await holdLoading(startedAt);
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

  return { weights, loading, loadSlow, loadError, refresh, patchWeight };
}
