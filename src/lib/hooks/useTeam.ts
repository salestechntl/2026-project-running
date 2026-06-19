import { useCallback, useEffect, useState } from "react";
import { fetchSubordinates } from "../entries";
import type { Employee } from "../types";
import { holdLoading } from "./loading";

export function useSubordinates(managerId: string | undefined) {
  const [team, setTeam] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!managerId) {
      setTeam([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const startedAt = Date.now();
    try {
      setTeam(await fetchSubordinates(managerId));
    } catch (e) {
      console.error("useSubordinates:", e);
      setTeam([]);
    } finally {
      await holdLoading(startedAt);
      setLoading(false);
    }
  }, [managerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { team, loading, refresh };
}
