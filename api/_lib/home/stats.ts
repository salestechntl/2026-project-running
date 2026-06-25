import type { SupabaseClient } from "@supabase/supabase-js";
import { currentMonthKey } from "../time/effective-date.js";
import type { DbRole } from "../auth/types.js";
import {
  allEmployeesExcept,
  fetchActiveEmployees,
  hasOrgWideTeamAccess,
  subordinatesFromRows,
} from "../team/access.js";

export interface HomeStatsDto {
  monthKey: string;
  totalKm: number;
  monthKm: number;
  approvedRunCount: number;
  monthRunCount: number;
  weightStartDone: boolean;
  weightEndDone: boolean;
  teamCount: number;
}

function monthOfRunDate(runDate: string): string {
  return runDate.slice(0, 7);
}

export async function loadHomeStats(
  supabase: SupabaseClient,
  employeeId: string,
  role: DbRole,
  manageTeam: boolean,
): Promise<HomeStatsDto> {
  const monthKey = currentMonthKey();

  const { data: runs, error: runsError } = await supabase
    .from("run_entries")
    .select("distance_km, run_date, status")
    .eq("employee_id", employeeId)
    .eq("status", "approved");

  if (runsError) throw runsError;

  let totalKm = 0;
  let monthKm = 0;
  let approvedRunCount = 0;
  let monthRunCount = 0;

  for (const row of runs ?? []) {
    const km = Number(row.distance_km);
    const date = String(row.run_date);
    totalKm += km;
    approvedRunCount += 1;
    if (monthOfRunDate(date) === monthKey) {
      monthKm += km;
      monthRunCount += 1;
    }
  }

  const { data: weights, error: weightsError } = await supabase
    .from("weight_entries")
    .select("period, status")
    .eq("employee_id", employeeId)
    .eq("month", monthKey);

  if (weightsError) throw weightsError;

  let weightStartDone = false;
  let weightEndDone = false;
  for (const row of weights ?? []) {
    if (row.status !== "approved") continue;
    if (row.period === "start") weightStartDone = true;
    if (row.period === "end") weightEndDone = true;
  }

  let teamCount = 0;
  if (manageTeam) {
    const rows = await fetchActiveEmployees(supabase);
    const team = hasOrgWideTeamAccess(role)
      ? allEmployeesExcept(employeeId, rows)
      : subordinatesFromRows(employeeId, rows);
    teamCount = team.length;
  }

  return {
    monthKey,
    totalKm: Math.round(totalKm * 100) / 100,
    monthKm: Math.round(monthKm * 100) / 100,
    approvedRunCount,
    monthRunCount,
    weightStartDone,
    weightEndDone,
    teamCount,
  };
}
