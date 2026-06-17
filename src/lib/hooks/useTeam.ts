import { useCallback, useEffect, useState } from "react";
import { fetchSubordinates } from "../entries";
import type { Employee } from "../types";

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
    try {
      setTeam(await fetchSubordinates(managerId));
    } catch (e) {
      console.error("useSubordinates:", e);
      setTeam([]);
    } finally {
      setLoading(false);
    }
  }, [managerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { team, loading, refresh };
}
