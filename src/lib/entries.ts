/**
 * Unified async data layer — localStorage (demo) or Supabase API (production).
 */

import { getAuthMode } from "./auth-config";
import {
  apiDeleteRun,
  apiFetchRuns,
  apiFetchSubordinates,
  apiFetchWeights,
  apiSaveRun,
  apiSaveWeight,
  apiSetRunStatus,
  apiSetWeightStatus,
} from "./api";
import type { Employee } from "./types";
import {
  DATA_CHANGED_EVENT,
  deleteRun as localDeleteRun,
  getRuns as localGetRuns,
  getWeights as localGetWeights,
  markMemberSeen as localMarkMemberSeen,
  newCountForMember as localNewCountForMember,
  newTeamCount as localNewTeamCount,
  saveRun as localSaveRun,
  saveWeight as localSaveWeight,
  setRunStatus as localSetRunStatus,
  setWeightStatus as localSetWeightStatus,
  type EntryStatus,
  type RunEntry,
  type WeightEntry,
} from "./store";
import { subordinates as localSubordinates } from "./data";

function notifyDataChanged() {
  try {
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
  } catch {
    /* no window */
  }
}

export async function fetchRuns(employeeId?: string): Promise<RunEntry[]> {
  if (getAuthMode() === "api") return apiFetchRuns(employeeId);
  return localGetRuns(employeeId);
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

export async function setRunEntryStatus(id: string, status: EntryStatus, rejectNote?: string): Promise<void> {
  if (getAuthMode() === "api") {
    await apiSetRunStatus(id, status, rejectNote);
    notifyDataChanged();
    return;
  }
  localSetRunStatus(id, status, rejectNote);
}

export async function fetchWeights(employeeId?: string): Promise<WeightEntry[]> {
  if (getAuthMode() === "api") return apiFetchWeights(employeeId);
  return localGetWeights(employeeId);
}

export async function saveWeightEntry(
  entry: Omit<WeightEntry, "id" | "createdAt" | "updatedAt" | "status"> & {
    status?: EntryStatus;
    proofImageRef?: string;
  },
): Promise<WeightEntry> {
  if (getAuthMode() === "api") {
    const weight = await apiSaveWeight(entry);
    notifyDataChanged();
    return weight;
  }
  return localSaveWeight(entry);
}

export async function setWeightEntryStatus(id: string, status: EntryStatus, rejectNote?: string): Promise<void> {
  if (getAuthMode() === "api") {
    await apiSetWeightStatus(id, status, rejectNote);
    notifyDataChanged();
    return;
  }
  localSetWeightStatus(id, status, rejectNote);
}

export async function fetchSubordinates(managerId: string): Promise<Employee[]> {
  if (getAuthMode() === "api") return apiFetchSubordinates();
  return localSubordinates(managerId);
}

function subKey(id: string, updatedAt: number): string {
  return `${id}@${updatedAt}`;
}

interface TeamSub {
  memberId: string;
  key: string;
}

async function teamSubs(employeeIds: string[]): Promise<TeamSub[]> {
  const set = new Set(employeeIds);
  if (getAuthMode() === "api") {
    const results = await Promise.all(
      employeeIds.map(async (id) => {
        const [runs, weights] = await Promise.all([apiFetchRuns(id), apiFetchWeights(id)]);
        return { id, runs, weights };
      }),
    );
    const subs: TeamSub[] = [];
    for (const { id, runs, weights } of results) {
      if (!set.has(id)) continue;
      for (const r of runs) {
        subs.push({ memberId: id, key: subKey(r.id, r.updatedAt) });
      }
      for (const w of weights) {
        subs.push({ memberId: id, key: subKey(w.id, w.updatedAt) });
      }
    }
    return subs;
  }

  const runs = localGetRuns().filter((r) => set.has(r.employeeId));
  const weights = localGetWeights().filter((w) => set.has(w.employeeId));
  return [
    ...runs.map((r) => ({ memberId: r.employeeId, key: subKey(r.id, r.updatedAt) })),
    ...weights.map((w) => ({ memberId: w.employeeId, key: subKey(w.id, w.updatedAt) })),
  ];
}

const SEEN_KEY = "rc2026.seenSubs";

function readSeenMap(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeSeenMap(map: Record<string, string[]>, notify = true) {
  localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  if (notify) notifyDataChanged();
}

export async function countNewForMember(leadId: string, memberId: string): Promise<number> {
  if (getAuthMode() === "local") return localNewCountForMember(leadId, memberId);
  const seen = new Set(readSeenMap()[leadId] ?? []);
  const subs = await teamSubs([memberId]);
  return subs.filter((s) => !seen.has(s.key)).length;
}

export async function countNewForTeam(leadId: string, employeeIds: string[]): Promise<number> {
  if (getAuthMode() === "local") return localNewTeamCount(leadId, employeeIds);
  const seen = new Set(readSeenMap()[leadId] ?? []);
  const subs = await teamSubs(employeeIds);
  return subs.filter((s) => !seen.has(s.key)).length;
}

export async function markMemberSeen(leadId: string, memberId: string): Promise<void> {
  if (getAuthMode() === "local") {
    localMarkMemberSeen(leadId, memberId);
    return;
  }
  const map = readSeenMap();
  const seen = new Set(map[leadId] ?? []);
  const subs = await teamSubs([memberId]);
  subs.forEach((s) => seen.add(s.key));
  map[leadId] = Array.from(seen);
  writeSeenMap(map);
}

export {
  DATA_CHANGED_EVENT,
  RUN_TYPE_LABEL,
  currentMonth,
  type RunEntry,
  type WeightEntry,
  type RunType,
  type WeightPeriod,
  type EntryStatus,
} from "./store";
