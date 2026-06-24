import type { RunEntry, WeightEntry } from "./store";

export interface HomeStats {
  monthKey: string;
  totalKm: number;
  monthKm: number;
  approvedRunCount: number;
  monthRunCount: number;
  weightStartDone: boolean;
  weightEndDone: boolean;
  teamCount: number;
}

export function monthOfRunDate(iso: string): string {
  return iso.slice(0, 7);
}

/** Same rules as Home.tsx — approved runs/weights only */
export function computeHomeStats(
  runs: RunEntry[],
  weights: WeightEntry[],
  monthKey: string,
  teamCount: number,
): HomeStats {
  const approved = runs.filter((r) => r.status === "approved");
  const monthRuns = approved.filter((r) => monthOfRunDate(r.date) === monthKey);
  const monthWeights = weights.filter((w) => w.month === monthKey);

  return {
    monthKey,
    totalKm: Math.round(approved.reduce((s, r) => s + r.distanceKm, 0) * 100) / 100,
    monthKm: Math.round(monthRuns.reduce((s, r) => s + r.distanceKm, 0) * 100) / 100,
    approvedRunCount: approved.length,
    monthRunCount: monthRuns.length,
    weightStartDone: monthWeights.some((w) => w.period === "start" && w.status === "approved"),
    weightEndDone: monthWeights.some((w) => w.period === "end" && w.status === "approved"),
    teamCount,
  };
}
