/**
 * Unified async data layer — localStorage (demo) or Supabase API (production).
 */

import { getAuthMode } from "./auth-config";
import {
  apiDeleteRun,
  apiFetchHomeStats,
  apiFetchRunById,
  apiFetchRunHistory,
  apiFetchRuns,
  apiFetchSubordinates,
  apiFetchWeights,
  apiSaveRun,
  apiSaveWeight,
  apiSetRunStatus,
  apiSetWeightStatus,
  apiStaffEditRun,
  apiStaffEditWeight,
} from "./api";
import type { Employee } from "./types";
import {
  DATA_CHANGED_EVENT,
  deleteRun as localDeleteRun,
  getRuns as localGetRuns,
  getWeights as localGetWeights,
  pendingCountForMember as localPendingCountForMember,
  pendingTeamCount as localPendingTeamCount,
  saveRun as localSaveRun,
  saveWeight as localSaveWeight,
  setRunStatus as localSetRunStatus,
  setWeightStatus as localSetWeightStatus,
  staffEditRun as localStaffEditRun,
  staffEditWeight as localStaffEditWeight,
  type EntryStatus,
  type RunEntry,
  type WeightEntry,
} from "./store";
import { teamRoster as localTeamRoster } from "./data";
import { computeHomeStats, type HomeStats } from "./home-stats";
import { currentMonthKey } from "./missions";
import {
  cachedFetch,
  cacheKeyHome,
  cacheKeyRunHistory,
  cacheKeyRuns,
  cacheKeySubordinates,
  cacheKeyWeights,
  cacheKeyWeightsLite,
  invalidateRequestCache,
} from "./request-cache";

export type { HomeStats } from "./home-stats";

export interface RunHistoryPage {
  runs: RunEntry[];
  total: number;
  page: number;
  limit: number;
}

export const RUN_HISTORY_PAGE_SIZE = 5;

function notifyDataChanged() {
  invalidateRequestCache();
  try {
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
  } catch {
    /* no window */
  }
}

async function loadRuns(employeeId?: string): Promise<RunEntry[]> {
  if (getAuthMode() === "api") return apiFetchRuns(employeeId);
  return localGetRuns(employeeId);
}

async function loadWeights(employeeId?: string, lite?: boolean): Promise<WeightEntry[]> {
  if (getAuthMode() === "api") return apiFetchWeights(employeeId, lite ? { lite: true } : undefined);
  return localGetWeights(employeeId);
}

async function loadSubordinates(managerId: string): Promise<Employee[]> {
  if (getAuthMode() === "api") return apiFetchSubordinates();
  return localTeamRoster(managerId);
}

export async function fetchRuns(employeeId?: string): Promise<RunEntry[]> {
  const id = employeeId?.trim();
  if (!id) return loadRuns(employeeId);
  return cachedFetch(cacheKeyRuns(id), () => loadRuns(id));
}

export async function fetchRunById(id: string): Promise<RunEntry> {
  const trimmed = id.trim();
  if (!trimmed) throw new Error("ไม่พบรหัสรายการ");
  if (getAuthMode() === "api") return apiFetchRunById(trimmed);
  const run = localGetRuns().find((r) => r.id === trimmed);
  if (!run) throw new Error("ไม่พบรายการ");
  return run;
}

export async function fetchRunHistory(
  employeeId: string,
  page: number,
  limit = RUN_HISTORY_PAGE_SIZE,
): Promise<RunHistoryPage> {
  const id = employeeId.trim();
  if (!id) return { runs: [], total: 0, page, limit };

  if (getAuthMode() === "api") {
    return cachedFetch(cacheKeyRunHistory(id, page, limit), () => apiFetchRunHistory(id, page, limit));
  }

  const sorted = [...localGetRuns(id)].sort((a, b) => b.createdAt - a.createdAt);
  const total = sorted.length;
  const from = (page - 1) * limit;
  return {
    runs: sorted.slice(from, from + limit),
    total,
    page,
    limit,
  };
}

export async function fetchWeights(
  employeeId?: string,
  opts?: { lite?: boolean },
): Promise<WeightEntry[]> {
  const id = employeeId?.trim();
  if (!id) return loadWeights(employeeId, opts?.lite);
  const key = opts?.lite ? cacheKeyWeightsLite(id) : cacheKeyWeights(id);
  return cachedFetch(key, () => loadWeights(id, opts?.lite));
}

export async function saveRunEntry(
  entry: Omit<RunEntry, "id" | "createdAt" | "updatedAt" | "status"> & {
    id?: string;
    status?: EntryStatus;
    stravaImageRefs?: (string | undefined)[];
  },
): Promise<RunEntry> {
  if (getAuthMode() === "api") {
    const run = await apiSaveRun(entry);
    notifyDataChanged();
    return run;
  }
  const run = localSaveRun(entry);
  return run;
}

export async function deleteRunEntry(id: string): Promise<void> {
  if (getAuthMode() === "api") {
    await apiDeleteRun(id);
    notifyDataChanged();
    return;
  }
  localDeleteRun(id);
}

export async function setRunEntryStatus(
  id: string,
  status: EntryStatus,
  rejectNote?: string,
  options?: { notify?: boolean },
): Promise<void> {
  if (getAuthMode() === "api") {
    await apiSetRunStatus(id, status, rejectNote);
    if (options?.notify !== false) notifyDataChanged();
    return;
  }
  localSetRunStatus(id, status, rejectNote);
  if (options?.notify !== false) notifyDataChanged();
}

export async function saveWeightEntry(
  entry: Omit<WeightEntry, "id" | "createdAt" | "updatedAt" | "status"> & {
    id?: string;
    status?: EntryStatus;
    proofImageRefs?: (string | undefined)[];
  },
): Promise<WeightEntry> {
  if (getAuthMode() === "api") {
    const weight = await apiSaveWeight(entry);
    notifyDataChanged();
    return weight;
  }
  return localSaveWeight(entry);
}

export async function setWeightEntryStatus(
  id: string,
  status: EntryStatus,
  rejectNote?: string,
  options?: { notify?: boolean },
): Promise<void> {
  if (getAuthMode() === "api") {
    await apiSetWeightStatus(id, status, rejectNote);
    if (options?.notify !== false) notifyDataChanged();
    return;
  }
  localSetWeightStatus(id, status, rejectNote);
  if (options?.notify !== false) notifyDataChanged();
}

export async function staffEditRunEntry(
  id: string,
  body: {
    date: string;
    runType: RunEntry["runType"];
    distanceKm: number;
    durationSec: number;
    missionMonth?: string;
    status: "approved" | "rejected";
    rejectNote?: string;
    staffEditNote: string;
  },
): Promise<RunEntry> {
  if (getAuthMode() === "api") {
    const run = await apiStaffEditRun(id, body);
    notifyDataChanged();
    return run;
  }
  return localStaffEditRun(id, body);
}

export async function staffEditWeightEntry(
  id: string,
  body: {
    weightKg: number;
    status: "approved" | "rejected";
    rejectNote?: string;
    staffEditNote: string;
  },
): Promise<WeightEntry> {
  if (getAuthMode() === "api") {
    const weight = await apiStaffEditWeight(id, body);
    notifyDataChanged();
    return weight;
  }
  return localStaffEditWeight(id, body);
}

export async function fetchSubordinates(managerId: string): Promise<Employee[]> {
  const id = managerId.trim();
  if (!id) return [];
  return cachedFetch(cacheKeySubordinates(id), () => loadSubordinates(id));
}

export async function fetchHomeStats(
  employeeId: string,
  opts: { manageTeam: boolean; managerId: string },
): Promise<HomeStats> {
  const id = employeeId.trim();
  const monthKey = currentMonthKey();
  if (!id) {
    return computeHomeStats([], [], monthKey, 0);
  }

  return cachedFetch(cacheKeyHome(id, monthKey), async () => {
    if (getAuthMode() === "api") {
      return apiFetchHomeStats();
    }
    const [runs, weights] = await Promise.all([loadRuns(id), loadWeights(id)]);
    const teamCount = opts.manageTeam
      ? (await loadSubordinates(opts.managerId)).length
      : 0;
    return computeHomeStats(runs, weights, monthKey, teamCount);
  });
}

async function countPendingRows(employeeIds: string[]): Promise<number> {
  const set = new Set(employeeIds);
  if (getAuthMode() === "api") {
    const results = await Promise.all(
      employeeIds.map(async (memberId) => {
        const [runs, weights] = await Promise.all([fetchRuns(memberId), fetchWeights(memberId)]);
        return { runs, weights };
      }),
    );
    let n = 0;
    for (const { runs, weights } of results) {
      n += runs.filter((r) => set.has(r.employeeId) && r.status === "pending").length;
      n += weights.filter((w) => set.has(w.employeeId) && w.status === "pending").length;
    }
    return n;
  }
  return localPendingTeamCount(employeeIds);
}

export async function countPendingForMember(_leadId: string, memberId: string): Promise<number> {
  if (getAuthMode() === "local") return localPendingCountForMember(memberId);
  const [runs, weights] = await Promise.all([fetchRuns(memberId), fetchWeights(memberId)]);
  return runs.filter((r) => r.status === "pending").length + weights.filter((w) => w.status === "pending").length;
}

export async function countPendingForTeam(_leadId: string, employeeIds: string[]): Promise<number> {
  return countPendingRows(employeeIds);
}

/** @deprecated ใช้ countPendingForTeam */
export async function countNewForTeam(leadId: string, employeeIds: string[]): Promise<number> {
  return countPendingForTeam(leadId, employeeIds);
}

/** @deprecated ใช้ countPendingForMember */
export async function countNewForMember(leadId: string, memberId: string): Promise<number> {
  return countPendingForMember(leadId, memberId);
}

export {
  DATA_CHANGED_EVENT,
  ENTRY_STATUS_LABEL,
  RUN_TYPE_LABEL,
  RUN_TYPES,
  runTypeBadgeTone,
  currentMonth,
  type RunEntry,
  type WeightEntry,
  type RunType,
  type WeightPeriod,
  type EntryStatus,
} from "./store";
