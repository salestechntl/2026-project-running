import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Image as ImageIcon, Images, Footprints, Scale, ChevronRight, ChevronLeft, Inbox, X,
  CheckCircle2, AlertTriangle, Clock, Loader2, Search,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { missionName, staffRunDateBounds } from "@/lib/missions";
import {
  setRunEntryStatus, setWeightEntryStatus,
  fetchRuns, fetchWeights,
  staffEditRunEntry, staffEditWeightEntry,
  RUN_TYPE_LABEL, ENTRY_STATUS_LABEL,
  type RunEntry, type WeightEntry, type EntryStatus, type RunType,
} from "@/lib/entries";
import { useRuns, useWeights } from "@/lib/hooks/useEntries";
import { useSubordinates } from "@/lib/hooks/useTeam";
import { formatThaiDate, formatThaiDateTime, formatDurationThai, matchesEmployeeSearch } from "@/lib/utils";
import { Card, Badge, Button, LoadingBlock, Field, Input, Select, ConfirmDialog, RejectReasonDialog } from "@/components/ui";
import { DateSelect } from "@/components/DateSelect";
import { cn } from "@/lib/utils";
import { validateStaffEditNote, defaultStaffEditTargetStatus, type StaffEditTargetStatus } from "@/lib/staff-edit-note";

const staffEditNoteAreaClass =
  "min-h-[4.5rem] w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-[15px] text-foreground shadow-xs transition-colors placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

type WorkStatusFilter = "all" | EntryStatus;

interface MemberWorkStatus {
  pending: boolean;
  approved: boolean;
  rejected: boolean;
  expired: boolean;
}

interface StatusTotals {
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
}

const EMPTY_STATUS_TOTALS: StatusTotals = { pending: 0, approved: 0, rejected: 0, expired: 0 };

function memberHasWorkStatus(flags: MemberWorkStatus | undefined, filter: WorkStatusFilter): boolean {
  if (filter === "all") return true;
  return flags?.[filter] ?? false;
}

function apiErrorMessage(e: unknown, fallback = "บันทึกไม่สำเร็จ กรุณาลองใหม่"): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function Admin() {
  const { user, isLead, isChecker, isSuperAdmin } = useAuth();
  const orgWideTeam = isChecker || isSuperAdmin;
  const canRejectPending = isLead || orgWideTeam;
  const canStaffEdit = orgWideTeam;
  const { team, loading: teamLoading } = useSubordinates(user?.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ images: string[]; index: number } | null>(null);
  const [runCounts, setRunCounts] = useState<Record<string, number>>({});
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [workStatusByMember, setWorkStatusByMember] = useState<Record<string, MemberWorkStatus>>({});
  const [statusTotals, setStatusTotals] = useState<StatusTotals>(EMPTY_STATUS_TOTALS);
  const [countsLoading, setCountsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<WorkStatusFilter>("all");
  const openGallery = (images: string[]) => images.length > 0 && setGallery({ images, index: 0 });

  const departmentOptions = useMemo(() => {
    const depts = [...new Set(team.map((m) => m.department).filter(Boolean))];
    return depts.sort((a, b) => a.localeCompare(b, "th"));
  }, [team]);

  const filteredTeam = useMemo(() => {
    return team.filter((member) => {
      if (departmentFilter !== "all" && member.department !== departmentFilter) {
        return false;
      }
      if (!matchesEmployeeSearch(member, searchQuery)) return false;
      if (countsLoading || statusFilter === "all") return true;
      return memberHasWorkStatus(workStatusByMember[member.id], statusFilter);
    });
  }, [team, searchQuery, departmentFilter, statusFilter, workStatusByMember, countsLoading]);

  useEffect(() => {
    if (filteredTeam.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredTeam.some((m) => m.id === selectedId)) {
      setSelectedId(filteredTeam[0].id);
    }
  }, [filteredTeam, selectedId]);

  const selected = filteredTeam.find((t) => t.id === selectedId) ?? team.find((t) => t.id === selectedId);
  const adminFetchOpts = { listenChanges: false } as const;
  const { runs, loading: runsLoading, patchRun } = useRuns(selected?.id, adminFetchOpts);
  const { weights, loading: weightsLoading, patchWeight } = useWeights(selected?.id, undefined, adminFetchOpts);
  const runsInitialLoading = !!selected && runsLoading && runs.length === 0;
  const weightsInitialLoading = !!selected && weightsLoading && weights.length === 0;

  const filteredRuns = useMemo(
    () => (statusFilter === "all" ? runs : runs.filter((r) => r.status === statusFilter)),
    [runs, statusFilter],
  );
  const filteredWeights = useMemo(
    () => (statusFilter === "all" ? weights : weights.filter((w) => w.status === statusFilter)),
    [weights, statusFilter],
  );

  const bumpPending = useCallback((memberId: string, delta: number) => {
    setPendingCounts((prev) => ({
      ...prev,
      [memberId]: Math.max(0, (prev[memberId] ?? 0) + delta),
    }));
  }, []);

  const shiftStatusTotals = useCallback((from: EntryStatus, to: EntryStatus) => {
    setStatusTotals((prev) => ({
      ...prev,
      [from]: Math.max(0, prev[from] - 1),
      [to]: prev[to] + 1,
    }));
  }, []);

  const refreshMemberWorkStatus = useCallback(async (memberId: string) => {
    const [memberRuns, memberWeights] = await Promise.all([
      fetchRuns(memberId),
      fetchWeights(memberId),
    ]);
    const entries = [...memberRuns, ...memberWeights];
    setWorkStatusByMember((prev) => ({
      ...prev,
      [memberId]: {
        pending: entries.some((e) => e.status === "pending"),
        approved: entries.some((e) => e.status === "approved"),
        rejected: entries.some((e) => e.status === "rejected"),
        expired: entries.some((e) => e.status === "expired"),
      },
    }));
  }, []);

  const applyRunStatus = useCallback(
    async (run: RunEntry, status: EntryStatus, rejectNote?: string) => {
      const wasPending = run.status === "pending";
      const snapshot = { status: run.status, rejectNote: run.rejectNote };
      patchRun(run.id, {
        status,
        rejectNote: status === "rejected" ? rejectNote : undefined,
      });
      if (wasPending) bumpPending(run.employeeId, -1);
      try {
        await setRunEntryStatus(run.id, status, rejectNote);
        shiftStatusTotals(run.status, status);
        await refreshMemberWorkStatus(run.employeeId);
      } catch (e) {
        patchRun(run.id, snapshot);
        if (wasPending) bumpPending(run.employeeId, 1);
        throw e;
      }
    },
    [patchRun, bumpPending, shiftStatusTotals, refreshMemberWorkStatus],
  );

  const applyWeightStatus = useCallback(
    async (weight: WeightEntry, status: EntryStatus, rejectNote?: string) => {
      const wasPending = weight.status === "pending";
      const snapshot = { status: weight.status, rejectNote: weight.rejectNote };
      patchWeight(weight.id, {
        status,
        rejectNote: status === "rejected" ? rejectNote : undefined,
      });
      if (wasPending) bumpPending(weight.employeeId, -1);
      try {
        await setWeightEntryStatus(weight.id, status, rejectNote);
        shiftStatusTotals(weight.status, status);
        await refreshMemberWorkStatus(weight.employeeId);
      } catch (e) {
        patchWeight(weight.id, snapshot);
        if (wasPending) bumpPending(weight.employeeId, 1);
        throw e;
      }
    },
    [patchWeight, bumpPending, shiftStatusTotals, refreshMemberWorkStatus],
  );

  const applyStaffEditRun = useCallback(
    async (
      run: RunEntry,
      patch: {
        date: string;
        runType: RunType;
        distanceKm: number;
        durationSec: number;
        missionMonth?: string;
        status: StaffEditTargetStatus;
        rejectNote?: string;
        staffEditNote: string;
      },
    ) => {
      const prevStatus = run.status;
      patchRun(run.id, {
        ...patch,
        missionTag: patch.missionMonth ?? patch.date.slice(0, 7),
        rejectNote: patch.status === "rejected" ? patch.rejectNote : undefined,
        staffEditNote: patch.staffEditNote.trim(),
      });
      try {
        const updated = await staffEditRunEntry(run.id, patch);
        patchRun(run.id, updated);
        if (prevStatus !== patch.status) shiftStatusTotals(prevStatus, patch.status);
        await refreshMemberWorkStatus(run.employeeId);
      } catch (e) {
        patchRun(run.id, run);
        throw e;
      }
    },
    [patchRun, shiftStatusTotals, refreshMemberWorkStatus],
  );

  const applyStaffEditWeight = useCallback(
    async (
      weight: WeightEntry,
      patch: { weightKg: number; status: StaffEditTargetStatus; rejectNote?: string; staffEditNote: string },
    ) => {
      const prevStatus = weight.status;
      patchWeight(weight.id, {
        weightKg: patch.weightKg,
        status: patch.status,
        rejectNote: patch.status === "rejected" ? patch.rejectNote : undefined,
        staffEditNote: patch.staffEditNote.trim(),
      });
      try {
        const updated = await staffEditWeightEntry(weight.id, patch);
        patchWeight(weight.id, updated);
        if (prevStatus !== patch.status) shiftStatusTotals(prevStatus, patch.status);
        await refreshMemberWorkStatus(weight.employeeId);
      } catch (e) {
        patchWeight(weight.id, weight);
        throw e;
      }
    },
    [patchWeight, shiftStatusTotals, refreshMemberWorkStatus],
  );

  function canApproveForStatus(status: EntryStatus): boolean {
    if (status === "pending") return isLead || orgWideTeam;
    return false;
  }

  function canRejectForStatus(status: EntryStatus): boolean {
    if (status === "pending") return canRejectPending;
    return false;
  }

  function canStaffEditForStatus(status: EntryStatus): boolean {
    return canStaffEdit && (status === "approved" || status === "rejected" || status === "expired");
  }

  useEffect(() => {
    if (!user || team.length === 0) {
      setCountsLoading(false);
      setWorkStatusByMember({});
      setStatusTotals(EMPTY_STATUS_TOTALS);
      return;
    }
    let cancelled = false;
    setCountsLoading(true);
    const load = async () => {
      const counts: Record<string, number> = {};
      const pending: Record<string, number> = {};
      const workStatus: Record<string, MemberWorkStatus> = {};
      const totals: StatusTotals = { pending: 0, approved: 0, rejected: 0, expired: 0 };
      await Promise.all(
        team.map(async (member) => {
          const [memberRuns, memberWeights] = await Promise.all([
            fetchRuns(member.id),
            fetchWeights(member.id),
          ]);
          const entries = [...memberRuns, ...memberWeights];
          counts[member.id] = memberRuns.length;
          pending[member.id] =
            memberRuns.filter((r) => r.status === "pending").length +
            memberWeights.filter((w) => w.status === "pending").length;
          workStatus[member.id] = {
            pending: entries.some((e) => e.status === "pending"),
            approved: entries.some((e) => e.status === "approved"),
            rejected: entries.some((e) => e.status === "rejected"),
            expired: entries.some((e) => e.status === "expired"),
          };
          for (const entry of entries) {
            totals[entry.status] += 1;
          }
        }),
      );
      if (!cancelled) {
        setRunCounts(counts);
        setPendingCounts(pending);
        setWorkStatusByMember(workStatus);
        setStatusTotals(totals);
        setCountsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      setCountsLoading(false);
    };
  }, [user, team]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          {orgWideTeam ? "ข้อมูลทีมทั้งองค์กร" : "ข้อมูลทีมของฉัน"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {orgWideTeam
            ? "ตรวจสอบรายการที่พนักงานบันทึก — อนุมัติหรือปฏิเสธพร้อมระบุเหตุผล"
            : "ตรวจสอบรายการที่ลูกทีมบันทึก — อนุมัติหรือปฏิเสธพร้อมระบุเหตุผล"}
        </p>
      </header>

      <Card className="animate-fade-up p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <Field label="รหัสพนักงาน หรือ ชื่อ" htmlFor="team-search" className="min-w-0 flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="team-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหา…"
                className="pl-9"
              />
            </div>
          </Field>

          <Field label="แผนก" htmlFor="team-department" className="w-full shrink-0 sm:w-44">
            <Select
              id="team-department"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">ทั้งหมด</option>
              {departmentOptions.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="สถานะ" htmlFor="team-status" className="w-full shrink-0 sm:w-44">
            <Select
              id="team-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as WorkStatusFilter)}
            >
              <option value="all">ทั้งหมด</option>
              <option value="pending">{ENTRY_STATUS_LABEL.pending}</option>
              <option value="approved">{ENTRY_STATUS_LABEL.approved}</option>
              <option value="rejected">{ENTRY_STATUS_LABEL.rejected}</option>
              <option value="expired">{ENTRY_STATUS_LABEL.expired}</option>
            </Select>
          </Field>

          <StatusTotalsSummary totals={statusTotals} loading={countsLoading} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Team list */}
        <aside className="space-y-3">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            สมาชิกในทีม · {teamLoading ? "…" : `${filteredTeam.length}/${team.length} คน`}
          </p>
          {teamLoading ? (
            <Card>
              <LoadingBlock compact label="กำลังโหลดทีม…" />
            </Card>
          ) : filteredTeam.length === 0 ? (
            <Card className="p-4 text-center text-sm text-muted-foreground">
              ไม่พบสมาชิกที่ตรงกับตัวกรอง
            </Card>
          ) : (
          filteredTeam.map((member) => {
            const count = runCounts[member.id] ?? 0;
            const pending = pendingCounts[member.id] ?? 0;
            const active = member.id === selectedId;
            return (
              <button
                key={member.id}
                onClick={() => setSelectedId(member.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-all",
                  active ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/30 hover:bg-muted/50",
                )}
              >
                <span className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}>
                  {member.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{member.name}</span>
                  <span className="tnum block text-xs text-muted-foreground">
                    รหัส {member.id} · {countsLoading ? "…" : `${count} กิจกรรม`}
                  </span>
                </span>
                {pending > 0 && (
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow-sm"
                    title="รายการรออนุมัติ"
                  >
                    {pending}
                  </span>
                )}
                <ChevronRight className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              </button>
            );
          })
          )}
        </aside>

        {/* Detail */}
        <section className="min-w-0 space-y-5">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{selected.name}</h2>
                  <p className="text-sm text-muted-foreground">{selected.position} · {selected.department}</p>
                </div>
                <div className="flex gap-2">
                  <Badge tone="accent"><Footprints className="h-3 w-3" /> {filteredRuns.length} วิ่ง</Badge>
                  <Badge tone="neutral"><Scale className="h-3 w-3" /> {filteredWeights.length} น้ำหนัก</Badge>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">รายการวิ่ง</h3>
                {runsInitialLoading ? (
                  <Card>
                    <LoadingBlock compact label="กำลังโหลดรายการวิ่ง…" />
                  </Card>
                ) : filteredRuns.length === 0 ? (
                  <EmptyState text={runs.length === 0 ? "ยังไม่มีการบันทึกการวิ่ง" : "ไม่มีรายการวิ่งที่ตรงกับตัวกรอง"} />
                ) : (
                  <Card className="divide-y divide-border overflow-hidden">
                    {filteredRuns.map((r) => (
                      <RunRow
                        key={r.id}
                        run={r}
                        canApprove={canApproveForStatus(r.status)}
                        canReject={canRejectForStatus(r.status)}
                        canEdit={canStaffEditForStatus(r.status)}
                        onPreview={openGallery}
                        onStatusChange={applyRunStatus}
                        onStaffEdit={applyStaffEditRun}
                      />
                    ))}
                  </Card>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">บันทึกน้ำหนัก</h3>
                {weightsInitialLoading ? (
                  <Card>
                    <LoadingBlock compact label="กำลังโหลดน้ำหนัก…" />
                  </Card>
                ) : filteredWeights.length === 0 ? (
                  <EmptyState text={weights.length === 0 ? "ยังไม่มีการบันทึกน้ำหนัก" : "ไม่มีรายการน้ำหนักที่ตรงกับตัวกรอง"} />
                ) : (
                  <Card className="divide-y divide-border overflow-hidden">
                    {filteredWeights.map((w) => (
                      <WeightRow
                        key={w.id}
                        weight={w}
                        canApprove={canApproveForStatus(w.status)}
                        canReject={canRejectForStatus(w.status)}
                        canEdit={canStaffEditForStatus(w.status)}
                        onPreview={openGallery}
                        onStatusChange={applyWeightStatus}
                        onStaffEdit={applyStaffEditWeight}
                      />
                    ))}
                  </Card>
                )}
              </div>
            </>
          ) : teamLoading ? (
            <Card>
              <LoadingBlock label="กำลังโหลดข้อมูลทีม…" />
            </Card>
          ) : (
            <EmptyState text="เลือกสมาชิกในทีมเพื่อดูข้อมูล" />
          )}
        </section>
      </div>

      {gallery && (
        <Gallery
          images={gallery.images}
          index={gallery.index}
          onIndex={(i) => setGallery((g) => (g ? { ...g, index: i } : g))}
          onClose={() => setGallery(null)}
        />
      )}
    </div>
  );
}

/* ---------- รูปหลักฐานแบบหลายรูป (สำหรับหัวหน้าดู) ---------- */
function Gallery({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const count = images.length;
  const go = (delta: number) => onIndex((index + delta + count) % count);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/80 p-4 backdrop-blur-sm animate-scale-in sm:p-6" onClick={onClose}>
      <button className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-card/90 text-foreground shadow-lg" aria-label="ปิด" onClick={onClose}>
        <X className="h-5 w-5" />
      </button>

      <div className="relative flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {count > 1 && (
          <button
            onClick={() => go(-1)}
            aria-label="รูปก่อนหน้า"
            className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card/90 text-foreground shadow-lg transition hover:bg-card sm:-left-16"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <img src={images[index]} alt={`หลักฐานแนบ ${index + 1}`} className="max-h-[78vh] max-w-[88vw] rounded-lg shadow-lg" />
        {count > 1 && (
          <button
            onClick={() => go(1)}
            aria-label="รูปถัดไป"
            className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card/90 text-foreground shadow-lg transition hover:bg-card sm:-right-16"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {count > 1 && (
        <div className="mt-4 flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <span className="rounded-full bg-card/90 px-3 py-1 text-xs font-semibold text-foreground shadow">
            {index + 1} / {count}
          </span>
          <div className="flex gap-2">
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => onIndex(i)}
                className={cn(
                  "h-12 w-12 overflow-hidden rounded-md border-2 transition",
                  i === index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100",
                )}
                aria-label={`ดูรูปที่ ${i + 1}`}
              >
                <img src={src} alt={`รูปที่ ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- status controls (approve / reject) ---------- */
function StatusControls({
  status,
  busy,
  canApprove,
  canReject,
  canEdit,
  approveMessage,
  rejectMessage,
  onApprove,
  onReject,
  onEdit,
}: {
  status: EntryStatus;
  busy?: boolean;
  canApprove: boolean;
  canReject: boolean;
  canEdit?: boolean;
  approveMessage?: string;
  rejectMessage?: string;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onEdit?: () => void;
}) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  if (status === "pending") {
    return (
      <>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge tone="warning"><Clock className="h-3 w-3" /> {ENTRY_STATUS_LABEL.pending}</Badge>
          {canApprove && (
            <Button
              size="sm"
              onClick={() => setApproveOpen(true)}
              disabled={busy}
              className="h-8 px-2.5 text-xs"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "อนุมัติ"}
            </Button>
          )}
          {canReject && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejectOpen(true)}
              disabled={busy}
              className="h-8 px-2.5 text-xs"
            >
              ไม่ผ่าน
            </Button>
          )}
        </div>
        <ConfirmDialog
          open={approveOpen}
          title="ยืนยันการอนุมัติ"
          message={approveMessage ?? "อนุมัติรายการนี้และบันทึกผลการตรวจสอบ"}
          confirmLabel="อนุมัติ"
          cancelLabel="ยกเลิก"
          tone="primary"
          onConfirm={() => {
            setApproveOpen(false);
            onApprove();
          }}
          onCancel={() => setApproveOpen(false)}
        />
        <RejectReasonDialog
          open={rejectOpen}
          message={rejectMessage ?? "ระบุเหตุผลที่ไม่ผ่านก่อนบันทึกผลการตรวจสอบ"}
          busy={busy}
          onConfirm={(reason) => {
            setRejectOpen(false);
            onReject(reason);
          }}
          onCancel={() => setRejectOpen(false)}
        />
      </>
    );
  }
  if (status === "expired") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Badge tone="neutral"><Clock className="h-3 w-3" /> {ENTRY_STATUS_LABEL.expired}</Badge>
        {canEdit && onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit} disabled={busy} className="h-8 px-2.5 text-xs">
            แก้ไข
          </Button>
        )}
      </div>
    );
  }
  if (status === "approved") {
    return (
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> {ENTRY_STATUS_LABEL.approved}</Badge>
        {canEdit && onEdit && (
          <Button size="sm" variant="outline" onClick={onEdit} disabled={busy} className="h-8 px-2.5 text-xs">
            แก้ไข
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> {ENTRY_STATUS_LABEL.rejected}</Badge>
      {canEdit && onEdit && (
        <Button size="sm" variant="outline" onClick={onEdit} disabled={busy} className="h-8 px-2.5 text-xs">
          แก้ไข
        </Button>
      )}
    </div>
  );
}

function RunRow({
  run,
  canApprove,
  canReject,
  canEdit,
  onPreview,
  onStatusChange,
  onStaffEdit,
}: {
  run: RunEntry;
  canApprove: boolean;
  canReject: boolean;
  canEdit: boolean;
  onPreview: (images: string[]) => void;
  onStatusChange: (run: RunEntry, status: EntryStatus, rejectNote?: string) => Promise<void>;
  onStaffEdit: (
    run: RunEntry,
    patch: {
      date: string;
      runType: RunType;
      distanceKm: number;
      durationSec: number;
      missionMonth?: string;
      status: StaffEditTargetStatus;
      rejectNote?: string;
      staffEditNote: string;
    },
  ) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const bounds = useMemo(() => staffRunDateBounds(), []);
  const [date, setDate] = useState(run.date);
  const [runType, setRunType] = useState<RunType>(run.runType);
  const [distanceKm, setDistanceKm] = useState(String(run.distanceKm));
  const [h, setH] = useState(String(Math.floor(run.durationSec / 3600)));
  const [m, setM] = useState(String(Math.floor((run.durationSec % 3600) / 60)));
  const [s, setS] = useState(String(run.durationSec % 60));
  const [status, setStatus] = useState<StaffEditTargetStatus>(defaultStaffEditTargetStatus(run.status));
  const [rejectNote, setRejectNote] = useState(run.rejectNote ?? "");
  const [staffEditNote, setStaffEditNote] = useState("");

  useEffect(() => {
    if (!editing) return;
    setDate(run.date);
    setRunType(run.runType);
    setDistanceKm(String(run.distanceKm));
    setH(String(Math.floor(run.durationSec / 3600)));
    setM(String(Math.floor((run.durationSec % 3600) / 60)));
    setS(String(run.durationSec % 60));
    setStatus(defaultStaffEditTargetStatus(run.status));
    setRejectNote(run.rejectNote ?? "");
    setStaffEditNote("");
  }, [editing, run]);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      window.alert(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function openEdit() {
    setEditing(true);
  }

  async function saveEdit() {
    const dist = Number(distanceKm);
    const durationSec = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
    if (!dist || dist <= 0) {
      window.alert("ระยะทางต้องมากกว่า 0");
      return;
    }
    if (!durationSec || durationSec <= 0) {
      window.alert("เวลาที่ใช้ต้องมากกว่า 0");
      return;
    }
    if (status === "rejected" && !rejectNote.trim()) {
      window.alert("กรุณาระบุเหตุผลที่ไม่ผ่าน");
      return;
    }
    const staffNoteErr = validateStaffEditNote(staffEditNote);
    if (staffNoteErr) {
      window.alert(staffNoteErr);
      return;
    }
    await act(async () => {
      await onStaffEdit(run, {
        date,
        runType,
        distanceKm: dist,
        durationSec,
        missionMonth: date.slice(0, 7),
        status,
        rejectNote: status === "rejected" ? rejectNote.trim() : undefined,
        staffEditNote: staffEditNote.trim(),
      });
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="วันที่">
            <DateSelect value={date} min={bounds.min} max={bounds.max} onChange={setDate} />
          </Field>
          <Field label="ประเภท">
            <Select value={runType} onChange={(e) => setRunType(e.target.value as RunType)}>
              <option value="discipline">{RUN_TYPE_LABEL.discipline}</option>
              <option value="mission">{RUN_TYPE_LABEL.mission}</option>
            </Select>
          </Field>
          <Field label="ระยะทาง (กม.)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              className="tnum"
            />
          </Field>
          <Field label="เวลา (ชม. : นาที : วินาที)">
            <div className="flex gap-2">
              <Input type="number" min="0" value={h} onChange={(e) => setH(e.target.value)} className="tnum w-16" placeholder="ชม." />
              <Input type="number" min="0" max="59" value={m} onChange={(e) => setM(e.target.value)} className="tnum w-16" placeholder="น." />
              <Input type="number" min="0" max="59" value={s} onChange={(e) => setS(e.target.value)} className="tnum w-16" placeholder="ว." />
            </div>
          </Field>
          <Field label="สถานะ">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StaffEditTargetStatus)}>
              <option value="approved">{ENTRY_STATUS_LABEL.approved}</option>
              <option value="rejected">{ENTRY_STATUS_LABEL.rejected}</option>
            </Select>
          </Field>
          {status === "rejected" && (
            <Field label="เหตุผลที่ไม่ผ่าน" className="sm:col-span-2">
              <Input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
            </Field>
          )}
          <Field label="หมายเหตุแก้ไข (บังคับ)" className="sm:col-span-2">
            <textarea
              className={staffEditNoteAreaClass}
              rows={2}
              value={staffEditNote}
              onChange={(e) => setStaffEditNote(e.target.value)}
              placeholder="อธิบายสิ่งที่แก้ไขให้พนักงานทราบ"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button size="sm" onClick={() => void saveEdit()} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "บันทึก"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-4">
        <ProofThumb images={run.stravaImages} onClick={onPreview} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{formatThaiDate(run.date)}</span>
            <Badge tone={run.runType === "discipline" ? "info" : "accent"}>
              {run.runType === "mission" && run.missionTag
                ? missionName(run.missionTag)
                : RUN_TYPE_LABEL[run.runType]}
            </Badge>
          </div>
          <p className="tnum mt-0.5 text-xs text-muted-foreground">
            {run.distanceKm.toFixed(2)} กม. · {formatDurationThai(run.durationSec)}{run.note ? ` · ${run.note}` : ""}
          </p>
          <p className="tnum mt-0.5 text-xs text-muted-foreground/80">
            อัปเดตล่าสุด {formatThaiDateTime(run.updatedAt)}
          </p>
        </div>
        <StatusControls
          status={run.status}
          busy={busy}
          canApprove={canApprove}
          canReject={canReject}
          canEdit={canEdit}
          approveMessage={`อนุมัติการวิ่งวันที่ ${formatThaiDate(run.date)} · ${run.distanceKm.toFixed(2)} กม.`}
          rejectMessage={`การวิ่งวันที่ ${formatThaiDate(run.date)} · ${run.distanceKm.toFixed(2)} กม.`}
          onApprove={() => void act(() => onStatusChange(run, "approved"))}
          onReject={(reason) => void act(() => onStatusChange(run, "rejected", reason))}
          onEdit={openEdit}
        />
      </div>
      {run.status === "rejected" && run.rejectNote && (
        <p className="mt-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-[hsl(32_80%_34%)]">หมายเหตุ: {run.rejectNote}</p>
      )}
      {run.staffEditNote && (
        <p className="mt-2 rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">แก้ไขโดยเจ้าหน้าที่: {run.staffEditNote}</p>
      )}
    </div>
  );
}

function WeightRow({
  weight,
  canApprove,
  canReject,
  canEdit,
  onPreview,
  onStatusChange,
  onStaffEdit,
}: {
  weight: WeightEntry;
  canApprove: boolean;
  canReject: boolean;
  canEdit: boolean;
  onPreview: (images: string[]) => void;
  onStatusChange: (weight: WeightEntry, status: EntryStatus, rejectNote?: string) => Promise<void>;
  onStaffEdit: (
    weight: WeightEntry,
    patch: { weightKg: number; status: StaffEditTargetStatus; rejectNote?: string; staffEditNote: string },
  ) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [weightKg, setWeightKg] = useState(String(weight.weightKg));
  const [status, setStatus] = useState<StaffEditTargetStatus>(defaultStaffEditTargetStatus(weight.status));
  const [rejectNote, setRejectNote] = useState(weight.rejectNote ?? "");
  const [staffEditNote, setStaffEditNote] = useState("");

  useEffect(() => {
    if (!editing) return;
    setWeightKg(String(weight.weightKg));
    setStatus(defaultStaffEditTargetStatus(weight.status));
    setRejectNote(weight.rejectNote ?? "");
    setStaffEditNote("");
  }, [editing, weight]);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      window.alert(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function openEdit() {
    setEditing(true);
  }

  async function saveEdit() {
    const kg = Number(weightKg);
    if (!kg || kg <= 0) {
      window.alert("น้ำหนักต้องมากกว่า 0");
      return;
    }
    if (status === "rejected" && !rejectNote.trim()) {
      window.alert("กรุณาระบุเหตุผลที่ไม่ผ่าน");
      return;
    }
    const staffNoteErr = validateStaffEditNote(staffEditNote);
    if (staffNoteErr) {
      window.alert(staffNoteErr);
      return;
    }
    await act(async () => {
      await onStaffEdit(weight, {
        weightKg: kg,
        status,
        rejectNote: status === "rejected" ? rejectNote.trim() : undefined,
        staffEditNote: staffEditNote.trim(),
      });
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="น้ำหนัก (กก.)">
            <Input
              type="number"
              step="0.1"
              min="0"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="tnum"
            />
          </Field>
          <Field label="สถานะ">
            <Select value={status} onChange={(e) => setStatus(e.target.value as StaffEditTargetStatus)}>
              <option value="approved">{ENTRY_STATUS_LABEL.approved}</option>
              <option value="rejected">{ENTRY_STATUS_LABEL.rejected}</option>
            </Select>
          </Field>
          {status === "rejected" && (
            <Field label="เหตุผลที่ไม่ผ่าน" className="sm:col-span-2">
              <Input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
            </Field>
          )}
          <Field label="หมายเหตุแก้ไข (บังคับ)" className="sm:col-span-2">
            <textarea
              className={staffEditNoteAreaClass}
              rows={2}
              value={staffEditNote}
              onChange={(e) => setStaffEditNote(e.target.value)}
              placeholder="อธิบายสิ่งที่แก้ไขให้พนักงานทราบ"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={busy}>
            ยกเลิก
          </Button>
          <Button size="sm" onClick={() => void saveEdit()} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "บันทึก"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-4">
        <ProofThumb images={weight.proofImage ? [weight.proofImage] : []} onClick={onPreview} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tnum text-sm font-semibold text-foreground">{weight.weightKg.toFixed(1)} กก.</span>
            <Badge tone="neutral">{weight.period === "start" ? "ต้นเดือน" : "สิ้นเดือน"}</Badge>
          </div>
          <p className="tnum mt-0.5 text-xs text-muted-foreground">เดือน {weight.month}</p>
          <p className="tnum mt-0.5 text-xs text-muted-foreground/80">
            อัปเดตล่าสุด {formatThaiDateTime(weight.updatedAt)}
          </p>
        </div>
        <StatusControls
          status={weight.status}
          busy={busy}
          canApprove={canApprove}
          canReject={canReject}
          canEdit={canEdit}
          approveMessage={`อนุมัติน้ำหนักเดือน ${weight.month} (${weight.period === "start" ? "ต้นเดือน" : "สิ้นเดือน"}) · ${weight.weightKg.toFixed(1)} กก.`}
          rejectMessage={`น้ำหนักเดือน ${weight.month} (${weight.period === "start" ? "ต้นเดือน" : "สิ้นเดือน"}) · ${weight.weightKg.toFixed(1)} กก.`}
          onApprove={() => void act(() => onStatusChange(weight, "approved"))}
          onReject={(reason) => void act(() => onStatusChange(weight, "rejected", reason))}
          onEdit={openEdit}
        />
      </div>
      {weight.status === "rejected" && weight.rejectNote && (
        <p className="mt-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-[hsl(32_80%_34%)]">หมายเหตุ: {weight.rejectNote}</p>
      )}
      {weight.staffEditNote && (
        <p className="mt-2 rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">แก้ไขโดยเจ้าหน้าที่: {weight.staffEditNote}</p>
      )}
    </div>
  );
}

function ProofThumb({ images, onClick }: { images?: string[]; onClick: (images: string[]) => void }) {
  const first = images?.[0];
  if (!first)
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-muted text-muted-foreground">
        <ImageIcon className="h-4 w-4" />
      </span>
    );
  const count = images!.length;
  const many = count > 1;
  return (
    <div className="relative h-12 w-12 shrink-0">
      {/* เลเยอร์รูปซ้อนด้านหลัง — สื่อว่ามีหลายภาพ */}
      {many && (
        <>
          <span className="absolute -right-1 -top-1 h-12 w-12 rounded-lg border border-border bg-muted" />
          <span className="absolute -right-0.5 -top-0.5 h-12 w-12 rounded-lg border border-border bg-card" />
        </>
      )}
      <button
        onClick={() => onClick(images!)}
        className="group absolute inset-0 overflow-hidden rounded-lg border border-border transition-transform hover:scale-105"
        aria-label={`ดูภาพแนบ ${count} รูป`}
        title={`มี ${count} รูป — คลิกเพื่อดูทั้งหมด`}
      >
        <img src={first} alt="หลักฐานแนบ" className="h-full w-full object-cover" />
        {many && (
          <>
            <span className="absolute inset-0 bg-ink/0 transition-colors group-hover:bg-ink/20" />
            <span className="absolute right-0.5 top-0.5 inline-flex items-center gap-0.5 rounded-md bg-primary px-1 py-0.5 text-[10px] font-bold leading-none text-primary-foreground shadow">
              <Images className="h-2.5 w-2.5" />
              {count}
            </span>
          </>
        )}
      </button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="h-5 w-5" />
      </span>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function StatusTotalsSummary({ totals, loading }: { totals: StatusTotals; loading: boolean }) {
  const items: { status: EntryStatus; tone: "warning" | "success" | "danger" | "neutral"; icon: typeof Clock }[] = [
    { status: "pending", tone: "warning", icon: Clock },
    { status: "approved", tone: "success", icon: CheckCircle2 },
    { status: "rejected", tone: "danger", icon: AlertTriangle },
    { status: "expired", tone: "neutral", icon: Clock },
  ];

  return (
    <div className="w-full shrink-0 xl:w-auto">
      <p className="mb-1.5 text-sm font-medium text-foreground">สรุปรายการ</p>
      <div className="flex flex-wrap gap-2">
        {items.map(({ status, tone, icon: Icon }) => (
          <div
            key={status}
            className="flex min-w-[7.5rem] items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
          >
            <Icon className={cn(
              "h-4 w-4 shrink-0",
              tone === "warning" && "text-warning",
              tone === "success" && "text-success",
              tone === "danger" && "text-danger",
              tone === "neutral" && "text-muted-foreground",
            )} />
            <div className="min-w-0">
              <p className="text-[11px] leading-tight text-muted-foreground">{ENTRY_STATUS_LABEL[status]}</p>
              <p className="tnum text-sm font-bold text-foreground">{loading ? "…" : totals[status]}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
