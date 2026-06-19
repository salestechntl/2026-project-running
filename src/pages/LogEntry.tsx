import { forwardRef, useEffect, useMemo, useRef, useState, type ForwardedRef, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useSearchParams } from "react-router-dom";
import {
  Footprints, Scale, CheckCircle2, Route, Calendar, Lock, Pencil,
  Trash2, AlertTriangle, Target,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  MONTHLY_MISSIONS, currentMonthKey, todayISOEffective, monthOf, isMonthUnlocked,
  isCurrentMonth, missionName, monthLabel, monthLabelEN,
  weightWindow, END_WEIGHT_GRACE_DAYS, runDateSelectionBounds,
  weightMonthOptions, weightMonthFieldHint,
} from "@/lib/missions";
import { saveRunEntryWithProgress } from "@/lib/save-run";
import { saveWeightEntryWithProgress } from "@/lib/save-weight";
import { initialRunSaveSteps, initialWeightSaveSteps, type RunSaveStepId, type SaveStepState, type SaveStepStatus, type WeightSaveStepId } from "@/lib/save-progress";
import { SaveProgressDialog } from "@/components/SaveProgressDialog";
import { DATA_CHANGED_EVENT } from "@/lib/store";
import {
  deleteRunEntry,
  RUN_TYPE_LABEL,
  type RunEntry, type RunType, type WeightPeriod, type WeightEntry,
} from "@/lib/entries";
import { useRuns, useWeights } from "@/lib/hooks/useEntries";
import { pad2, formatThaiDate, formatDurationThai, formatThaiDateTime } from "@/lib/utils";
import { Button, Card, Field, Input, Select, Badge, ConfirmDialog } from "@/components/ui";
import { ImageUpload, ImageUploadMulti } from "@/components/ImageUpload";
import { DateSelect } from "@/components/DateSelect";
import { cn } from "@/lib/utils";

type Tab = "run" | "weight";
const CAMPAIGN_MIN = `${MONTHLY_MISSIONS[0].month}-01`;

function runDateFieldHint(min: string, max: string): string {
  const day = parseInt(max.slice(8, 10), 10);
  const grace = day <= 7;
  return grace
    ? `วันที่ 1–7 ของเดือน: เลือกได้ตั้งแต่ ${formatThaiDate(min)} ถึงวันนี้`
    : `เลือกได้ตั้งแต่ ${formatThaiDate(min)} ถึงวันนี้`;
}

/** เจ้าตัวแก้รายการนี้ได้ไหม: ภายในเดือนปัจจุบัน หรือถูกหัวหน้าตีกลับ */
function canOwnerEdit(month: string, status: string) {
  return isCurrentMonth(month) || status === "rejected";
}

function SuccessBanner({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex animate-scale-in items-center gap-2.5 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success"
    >
      <CheckCircle2 className="h-5 w-5 shrink-0" />
      {children}
    </div>
  );
}

export default function LogEntry() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(params.get("tab") === "weight" ? "weight" : "run");
  const [toast, setToast] = useState<string>();

  if (!user) return null;

  function flash(msg: string) {
    setToast(msg);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => setToast(undefined), 4000);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">บันทึกข้อมูล</h1>
        <p className="mt-1 text-sm text-muted-foreground">บันทึกผลการวิ่ง และน้ำหนักประจำเดือนของคุณ</p>
      </header>

      {toast && (
        <SuccessBanner>{toast}</SuccessBanner>
      )}

      <div className="inline-flex w-full rounded-lg border border-border bg-muted/60 p-1 sm:w-auto">
        {[
          { id: "run" as Tab, label: "การวิ่ง", icon: Footprints },
          { id: "weight" as Tab, label: "น้ำหนัก", icon: Scale },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-2 rounded-md px-5 py-2 text-sm font-semibold transition-all sm:flex-none",
              tab === t.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "run" ? (
        <RunTab />
      ) : (
        <WeightTab onSaved={(p) => flash(`บันทึกน้ำหนัก${p === "start" ? "ต้นเดือน" : "สิ้นเดือน"}เรียบร้อยแล้ว`)} />
      )}
    </div>
  );
}

/* ===================== Mission timeline ===================== */
function MissionTimeline() {
  const cur = currentMonthKey();
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
        <Target className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">ภารกิจประจำเดือน — Running Camp 2026</h3>
      </div>
      <ol className="divide-y divide-border">
        {MONTHLY_MISSIONS.map((m) => {
          const unlocked = isMonthUnlocked(m.month);
          const current = m.month === cur;
          return (
            <li
              key={m.month}
              className={cn("flex items-center gap-3 px-5 py-3", current && "bg-primary/[0.04]")}
            >
              <span
                className={cn(
                  "flex h-8 w-14 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                  current ? "bg-primary text-primary-foreground" : unlocked ? "bg-muted text-foreground" : "bg-muted/60 text-muted-foreground",
                )}
              >
                {monthLabel(m.month).split(" ")[0]}
              </span>
              {unlocked ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.objective}</p>
                </div>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-1.5 text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  <span className="text-sm">เผยภารกิจเมื่อถึงเดือนนี้</span>
                </div>
              )}
              {current && <Badge tone="accent">เดือนนี้</Badge>}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/* ===================== Run tab (form + history) ===================== */
function RunTab() {
  const { user } = useAuth();
  const [editing, setEditing] = useState<RunEntry | null>(null);
  const [formSeed, setFormSeed] = useState(0);
  const [toast, setToast] = useState<string>();
  const historyRef = useRef<HTMLDivElement>(null);
  const { runs, refresh } = useRuns(user?.id);

  if (!user) return null;

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => {
      historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    window.setTimeout(() => setToast(undefined), 4000);
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <MissionTimeline />
      </div>
      <RunForm
        key={editing?.id ?? `new-${formSeed}`}
        editing={editing}
        onCancel={() => setEditing(null)}
        onSaved={async (edit) => {
          setEditing(null);
          if (!edit) setFormSeed((n) => n + 1);
          await refresh();
          flash(edit ? "แก้ไขรายการเรียบร้อยแล้ว" : "บันทึกการวิ่งเรียบร้อยแล้ว 🎉");
        }}
      />
      {toast && <SuccessBanner>{toast}</SuccessBanner>}
      <RunHistory
        ref={historyRef}
        runs={runs}
        onEdit={(r) => setEditing(r)}
        onDeleted={() => void refresh()}
      />
    </div>
  );
}

function RunForm({
  editing,
  onSaved,
  onCancel,
}: {
  editing: RunEntry | null;
  onSaved: (edit: boolean) => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const init = editing;
  const { min: runDateMin, max: runDateMax } = runDateSelectionBounds(CAMPAIGN_MIN, init?.date);
  const [date, setDate] = useState(() => {
    const d = init?.date ?? runDateMax;
    if (d < runDateMin) return runDateMin;
    if (d > runDateMax) return runDateMax;
    return d;
  });
  const [runType, setRunType] = useState<RunType>(init?.runType ?? "discipline");
  const [distance, setDistance] = useState(init ? String(init.distanceKm) : "");
  const [h, setH] = useState(init ? String(Math.floor(init.durationSec / 3600)) : "");
  const [m, setM] = useState(init ? String(Math.floor((init.durationSec % 3600) / 60)) : "");
  const [s, setS] = useState(init ? String(init.durationSec % 60) : "");
  const [images, setImages] = useState<string[]>(init?.stravaImages ?? []);
  const [imageRefs, setImageRefs] = useState<(string | undefined)[]>(init?.stravaImageRefs ?? []);
  const [note, setNote] = useState(init?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressSteps, setProgressSteps] = useState<SaveStepState[]>(initialRunSaveSteps);
  const [progressError, setProgressError] = useState<string>();
  const dateFieldRef = useRef<HTMLDivElement>(null);

  const dist = parseFloat(distance) || 0;

  useEffect(() => {
    if (!editing) return;
    const timer = window.setTimeout(() => {
      dateFieldRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [editing]);

  if (!user) return null;

  function patchProgress(stepId: RunSaveStepId, status: SaveStepStatus, detail?: string) {
    setProgressSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status, detail: detail ?? s.detail } : s)),
    );
  }

  function closeProgress() {
    setProgressOpen(false);
    setProgressSteps(initialRunSaveSteps());
    setProgressError(undefined);
  }

  function handleImagesChange(next: string[]) {
    setImageRefs((prevRefs) =>
      next.map((img, i) => {
        if (images[i] === img && prevRefs[i]) return prevRefs[i];
        if (img.startsWith("data:")) return undefined;
        return prevRefs[i];
      }),
    );
    setImages(next);
  }

  function collectValidationErrors(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!date) e.date = "เลือกวันที่วิ่ง";
    else if (date < runDateMin || date > runDateMax) e.date = "วันที่อยู่นอกช่วงที่อนุญาต";
    if (!dist || dist <= 0) e.distance = "กรอกระยะทางมากกว่า 0";
    if (!(Number(h) || Number(m) || Number(s))) e.time = "กรอกเวลาที่ใช้";
    if (images.length === 0) e.image = "แนบภาพกิจกรรมอย่างน้อย 1 รูป";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!user) return;

    flushSync(() => {
      setSaving(true);
      setProgressError(undefined);
      setProgressSteps(initialRunSaveSteps());
      setProgressOpen(true);
    });

    const validationErrors = collectValidationErrors();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      const summary = Object.values(validationErrors).join(" · ");
      patchProgress("validate", "error", summary);
      setProgressError("กรุณาแก้ไขข้อมูลในฟอร์มก่อนบันทึก");
      setSaving(false);
      return;
    }
    patchProgress("validate", "done", "ข้อมูลครบถ้วน");

    try {
      await saveRunEntryWithProgress(
        {
          id: editing?.id,
          employeeId: user.id,
          date,
          runType,
          distanceKm: dist,
          durationSec: (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0),
          missionTag: monthOf(date),
          stravaImages: images,
          stravaImageRefs: imageRefs.some(Boolean)
            ? imageRefs.map((r) => r ?? "")
            : undefined,
          note: note.trim() || undefined,
        },
        patchProgress,
      );
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
      setTimeout(() => {
        closeProgress();
        onSaved(!!editing);
      }, 1200);
    } catch (e) {
      setProgressError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <form onSubmit={submit} noValidate className="animate-fade-up">
      <Card className="space-y-5 p-6">
        {editing && (
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium text-primary">
              <Pencil className="h-4 w-4" /> กำลังแก้ไขรายการ {formatThaiDate(editing.date)}
            </span>
            <button type="button" onClick={onCancel} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
              ยกเลิก
            </button>
          </div>
        )}

        <IdentityRow />

        <div className="space-y-5">
          <Field label="ประเภทการวิ่ง" required htmlFor="runType">
            <Select id="runType" value={runType} onChange={(e) => setRunType(e.target.value as RunType)}>
              <option value="discipline">{RUN_TYPE_LABEL.discipline}</option>
              <option value="mission">{RUN_TYPE_LABEL.mission}</option>
            </Select>
          </Field>

          <div ref={dateFieldRef} className="scroll-mt-28">
          <Field
            label="วันที่วิ่ง"
            required
            htmlFor="date"
            error={errors.date}
            hint={runDateFieldHint(runDateMin, runDateMax)}
          >
            <DateSelect
              id="date"
              value={date}
              min={runDateMin}
              max={runDateMax}
              onChange={setDate}
            />
          </Field>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="ระยะทาง" required htmlFor="distance" error={errors.distance} hint="หน่วยเป็นกิโลเมตร">
            <div className="relative">
              <Route className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
              <Input
                id="distance" type="number" inputMode="decimal" step="0.01" min="0"
                placeholder="5.20" className="pl-11 pr-12 tnum"
                value={distance} onChange={(e) => setDistance(e.target.value)}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">กม.</span>
            </div>
          </Field>

          <Field label="เวลาที่ใช้" required error={errors.time} hint="ชั่วโมง : นาที : วินาที">
            <div className="flex items-center gap-1.5">
              <TimeBox value={h} onChange={setH} max={23} aria="ชั่วโมง" />
              <span className="text-muted-foreground">:</span>
              <TimeBox value={m} onChange={setM} max={59} aria="นาที" />
              <span className="text-muted-foreground">:</span>
              <TimeBox value={s} onChange={setS} max={59} aria="วินาที" />
            </div>
          </Field>
        </div>

        <div className={errors.image ? "rounded-lg p-0.5 ring-1 ring-danger/40" : undefined}>
          <ImageUploadMulti
            label="ภาพกิจกรรม" required values={images} onChange={handleImagesChange} max={5}
            hint={errors.image ?? "รูปภาพสรุปผลการวิ่งหรือภาพกิจกรรม · แนบได้สูงสุด 5 รูป"}
          />
        </div>

        <Field label="บันทึกเพิ่มเติม" htmlFor="note" hint="ไม่บังคับ">
          <Input id="note" placeholder="เช่น อากาศดี วิ่งสวนสาธารณะ" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          {editing && (
            <Button type="button" variant="outline" size="lg" onClick={onCancel}>
              ยกเลิก
            </Button>
          )}
          <Button type="submit" size="lg" disabled={saving} className="w-full sm:w-auto">
            {saving ? "กำลังบันทึก…" : editing ? "บันทึกการแก้ไข" : "บันทึกการวิ่ง"}
          </Button>
        </div>
      </Card>
    </form>

    <SaveProgressDialog
      open={progressOpen}
      title={editing ? "กำลังบันทึกการแก้ไข" : "กำลังบันทึกการวิ่ง"}
      steps={progressSteps}
      errorMessage={progressError}
      onClose={closeProgress}
    />
    </>
  );
}

const RunHistory = forwardRef(function RunHistory(
  {
    runs,
    onEdit,
    onDeleted,
  }: {
    runs: RunEntry[];
    onEdit: (r: RunEntry) => void;
    onDeleted: () => void;
  },
  ref: ForwardedRef<HTMLDivElement>,
) {
  const { isLead } = useAuth();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  if (runs.length === 0) return null;
  return (
    <div ref={ref} className="animate-fade-up scroll-mt-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        ประวัติการบันทึกของฉัน
      </h2>
      <Card className="divide-y divide-border overflow-hidden">
        {runs.map((r) => {
          const month = monthOf(r.date);
          const editable = isLead || canOwnerEdit(month, r.status);
          return (
            <div key={r.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{formatThaiDate(r.date)}</span>
                    <Badge tone={r.runType === "discipline" ? "info" : "accent"}>
                      {r.runType === "mission" && r.missionTag
                        ? missionName(r.missionTag)
                        : RUN_TYPE_LABEL[r.runType]}
                    </Badge>
                    {r.status === "rejected" && (
                      <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> ขอให้แก้ไข</Badge>
                    )}
                  </div>
                  <p className="tnum mt-0.5 text-xs text-muted-foreground">
                    {r.distanceKm.toFixed(2)} กม. · {formatDurationThai(r.durationSec)}
                    {r.note ? ` · ${r.note}` : ""}
                  </p>
                  <p className="tnum mt-0.5 text-xs text-muted-foreground/80">
                    อัปเดตล่าสุด {formatThaiDateTime(r.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {editable ? (
                    <>
                      <button
                        onClick={() => onEdit(r)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                        aria-label="แก้ไข"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmId(r.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
                        aria-label="ลบ"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <span
                      className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground"
                      title="เดือนที่ผ่านมา — ให้หัวหน้ากดขอให้แก้ไขก่อน"
                    >
                      <Lock className="h-3.5 w-3.5" /> ล็อก
                    </span>
                  )}
                </div>
              </div>
              {r.status === "rejected" && r.rejectNote && (
                <p className={cn("mt-2", rejectedNoteClass)}>
                  เหตุผลจากหัวหน้า: {r.rejectNote}
                </p>
              )}
            </div>
          );
        })}
      </Card>

      <ConfirmDialog
        open={confirmId !== null}
        title="ลบรายการนี้?"
        message="เมื่อลบแล้วจะไม่สามารถกู้คืนได้"
        confirmLabel="ลบรายการ"
        cancelLabel="ยกเลิก"
        onConfirm={async () => {
          if (confirmId) {
            try {
              await deleteRunEntry(confirmId);
              onDeleted();
            } catch (e) {
              console.error(e);
            }
          }
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
});
/* ===================== Weight tab ===================== */
const WEIGHT_PERIOD_LABEL: Record<WeightPeriod, string> = {
  start: "ต้นเดือน",
  end: "สิ้นเดือน",
};

const rejectedNoteClass = "rounded-md bg-danger/10 px-3 py-2 text-xs text-danger";

function WeightTab({ onSaved }: { onSaved: (p: WeightPeriod) => void }) {
  const { user } = useAuth();
  const { weights: allWeights, refresh } = useWeights(user?.id);
  const startCardRef = useRef<HTMLDivElement>(null);
  const endCardRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [scrollToPeriod, setScrollToPeriod] = useState<WeightPeriod | null>(null);

  const campaignStart = MONTHLY_MISSIONS[0].month;

  const monthOptions = useMemo(() => {
    const extra = allWeights
      .filter((w) => w.status === "rejected")
      .map((w) => w.month);
    return weightMonthOptions(campaignStart, extra);
  }, [allWeights, campaignStart]);

  const [month, setMonth] = useState(() => currentMonthKey());
  const didAutoFocusRejected = useRef(false);

  useEffect(() => {
    if (monthOptions.length === 0) return;
    if (!monthOptions.includes(month)) {
      setMonth(currentMonthKey());
    }
  }, [monthOptions, month]);

  useEffect(() => {
    if (didAutoFocusRejected.current) return;
    const rejected = allWeights
      .filter((w) => w.status === "rejected")
      .sort((a, b) => b.month.localeCompare(a.month) || b.updatedAt - a.updatedAt);
    if (rejected.length === 0) return;
    didAutoFocusRejected.current = true;
    setMonth(rejected[0].month);
    setScrollToPeriod(rejected[0].period);
  }, [allWeights]);

  useEffect(() => {
    if (!scrollToPeriod) return;
    const target = scrollToPeriod === "start" ? startCardRef : endCardRef;
    const timer = window.setTimeout(() => {
      target.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setScrollToPeriod(null);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [scrollToPeriod, month]);

  const existing = useMemo(
    () => allWeights.filter((w) => w.month === month),
    [allWeights, month],
  );

  const rejectedCount = allWeights.filter((w) => w.status === "rejected").length;

  if (!user) return null;

  function openWeightEdit(w: WeightEntry) {
    setMonth(w.month);
    setScrollToPeriod(w.period);
  }

  return (
    <div className="animate-fade-up space-y-4">
      <MissionTimeline />

      {rejectedCount > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-[hsl(32_80%_34%)]"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">หัวหน้าขอให้แก้ไขน้ำหนัก {rejectedCount} รายการ</p>
            <p className="mt-0.5 text-xs opacity-90">
              เลือกเดือนที่ถูกต้องด้านล่าง หรือกดแก้ไขจากประวัติการบันทึกของฉัน
            </p>
          </div>
        </div>
      )}

      <Card className="space-y-5 p-6">
        <IdentityRow />
        <Field label="เดือนที่บันทึก" required htmlFor="month" hint={`${weightMonthFieldHint()} · กรอกน้ำหนัก 2 ครั้ง: ต้นเดือน และสิ้นเดือน`}>
          <Select
            id="month"
            value={monthOptions.includes(month) ? month : (monthOptions[0] ?? "")}
            onChange={(e) => setMonth(e.target.value)}
            disabled={monthOptions.length === 0}
          >
            {monthOptions.length === 0 ? (
              <option value="">ยังไม่เปิดรับบันทึก</option>
            ) : (
              monthOptions.map((m) => (
                <option key={m} value={m}>{monthLabelEN(m)}</option>
              ))
            )}
          </Select>
        </Field>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["start", "end"] as WeightPeriod[]).map((period) => (
          <div
            key={`${month}-${period}`}
            ref={period === "start" ? startCardRef : endCardRef}
            className="scroll-mt-28"
          >
            <WeightCard
              key={`${month}-${period}-${existing.find((w) => w.period === period)?.id ?? "new"}-${existing.find((w) => w.period === period)?.updatedAt ?? 0}`}
              employeeId={user.id}
              month={month}
              period={period}
              initial={existing.find((w) => w.period === period)}
              onSaved={() => {
                void refresh();
                onSaved(period);
              }}
            />
          </div>
        ))}
      </div>

      <WeightHistory
        ref={historyRef}
        weights={allWeights}
        onEdit={openWeightEdit}
      />
    </div>
  );
}

const WeightHistory = forwardRef(function WeightHistory(
  {
    weights,
    onEdit,
  }: {
    weights: WeightEntry[];
    onEdit: (w: WeightEntry) => void;
  },
  ref: ForwardedRef<HTMLDivElement>,
) {
  if (weights.length === 0) return null;

  const sorted = [...weights].sort(
    (a, b) => b.month.localeCompare(a.month) || (a.period === "start" ? -1 : 1) - (b.period === "start" ? -1 : 1),
  );

  return (
    <div ref={ref} className="scroll-mt-6 animate-fade-up">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        ประวัติการบันทึกของฉัน
      </h2>
      <Card className="divide-y divide-border overflow-hidden">
        {sorted.map((w) => (
          <div key={w.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{monthLabel(w.month)}</span>
                  <Badge tone="neutral">{WEIGHT_PERIOD_LABEL[w.period]}</Badge>
                  {w.status === "rejected" ? (
                    <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> ขอให้แก้ไข</Badge>
                  ) : (
                    <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> บันทึกแล้ว</Badge>
                  )}
                </div>
                <p className="tnum mt-0.5 text-xs text-muted-foreground">{w.weightKg.toFixed(1)} กก.</p>
                <p className="tnum mt-0.5 text-xs text-muted-foreground/80">
                  อัปเดตล่าสุด {formatThaiDateTime(w.updatedAt)}
                </p>
              </div>
              {(w.status === "rejected" || weightWindow(w.month, w.period).open) && (
                <button
                  type="button"
                  onClick={() => onEdit(w)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  แก้ไข
                </button>
              )}
            </div>
            {w.status === "rejected" && w.rejectNote && (
              <p className={cn("mt-2", rejectedNoteClass)}>
                เหตุผลจากหัวหน้า: {w.rejectNote}
              </p>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
});

function WeightCard({
  employeeId,
  month,
  period,
  initial,
  onSaved,
}: {
  employeeId: string;
  month: string;
  period: WeightPeriod;
  initial?: WeightEntry;
  onSaved: () => void;
}) {
  const { isLead } = useAuth();
  const [weight, setWeight] = useState(initial ? String(initial.weightKg) : "");
  const [image, setImage] = useState<string | undefined>(initial?.proofImage);
  const [imageRef, setImageRef] = useState<string | undefined>(initial?.proofImageRef);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressSteps, setProgressSteps] = useState<SaveStepState[]>(initialWeightSaveSteps);
  const [progressError, setProgressError] = useState<string>();

  const label = period === "start" ? "ต้นเดือน" : "สิ้นเดือน";
  const saved = !!initial;
  const status = initial?.status ?? "submitted";

  useEffect(() => {
    if (initial) {
      setWeight(String(initial.weightKg));
      setImage(initial.proofImage);
      setImageRef(initial.proofImageRef);
      setError(undefined);
    }
  }, [initial?.id, initial?.updatedAt, initial?.weightKg, initial?.proofImage, initial?.proofImageRef]);

  // หน้าต่างเวลากรอก: ต้นเดือน = วันแรกของเดือน, สิ้นเดือน = วันสุดท้ายของเดือน
  // ทั้งคู่ปิดรับ 7 วันหลังสิ้นเดือน · ถ้าถูกหัวหน้าตีกลับ ให้แก้ไขได้เสมอ
  // หัวหน้าทีม (ผู้บันทึกที่เป็น lead) แก้ไขได้ตลอดเวลา ไม่ล็อก
  const win = weightWindow(month, period);
  const editable = isLead || status === "rejected" || win.open;
  // ยังไม่ถึง/เลย period ที่กรอกได้ → disable ทั้ง section
  const disabled = !editable;

  function patchProgress(stepId: WeightSaveStepId, status: SaveStepStatus, detail?: string) {
    setProgressSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status, detail: detail ?? s.detail } : s)),
    );
  }

  function closeProgress() {
    setProgressOpen(false);
    setProgressSteps(initialWeightSaveSteps());
    setProgressError(undefined);
  }

  async function submit() {
    flushSync(() => {
      setSaving(true);
      setProgressError(undefined);
      setProgressSteps(initialWeightSaveSteps());
      setProgressOpen(true);
    });

    const w = parseFloat(weight);
    if (!w || w <= 0) {
      setError("กรอกน้ำหนัก");
      patchProgress("validate", "error", "กรอกน้ำหนัก");
      setProgressError("กรุณาแก้ไขข้อมูลในฟอร์มก่อนบันทึก");
      setSaving(false);
      return;
    }
    if (!image) {
      setError("แนบภาพน้ำหนัก");
      patchProgress("validate", "error", "แนบภาพน้ำหนัก");
      setProgressError("กรุณาแก้ไขข้อมูลในฟอร์มก่อนบันทึก");
      setSaving(false);
      return;
    }

    setError(undefined);
    patchProgress("validate", "done", "ข้อมูลครบถ้วน");

    try {
      await saveWeightEntryWithProgress(
        {
          employeeId,
          month,
          period,
          weightKg: w,
          proofImage: image,
          proofImageRef: imageRef,
        },
        patchProgress,
        { isUpdate: saved },
      );
      window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
      setTimeout(() => {
        closeProgress();
        onSaved();
      }, 1200);
    } catch (e) {
      setProgressError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Scale className="h-[18px] w-[18px]" />
          </span>
          <h3 className="font-semibold text-foreground">น้ำหนัก{label}</h3>
        </div>
        {initial?.status === "rejected" ? (
          <Badge tone="danger"><AlertTriangle className="h-3 w-3" /> ขอให้แก้ไข</Badge>
        ) : saved ? (
          <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> บันทึกแล้ว</Badge>
        ) : null}
      </div>

      {status === "rejected" ? (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-[hsl(32_80%_34%)]">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            หัวหน้าขอให้แก้ไข — กรุณาอัปเดตน้ำหนักและภาพด้านล่าง
          </p>
        </div>
      ) : disabled ? (
        todayISOEffective() < win.opensISO ? (
          <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>ยังไม่ถึงเวลากรอก — เปิดให้กรอก {formatThaiDate(win.opensISO)} ถึง {formatThaiDate(win.closesISO)}</span>
          </p>
        ) : (
          <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-[hsl(32_80%_34%)]">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> เลยกำหนดแล้ว
            </p>
            <p className="mt-0.5 pl-5">ปิดรับน้ำหนัก{label}เมื่อ {formatThaiDate(win.closesISO)} — หากต้องการแก้ไข ให้หัวหน้ากด “ขอให้แก้ไข” ก่อน</p>
          </div>
        )
      ) : win.backdated ? (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-[hsl(32_80%_34%)]">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            จบเดือนแล้ว · กรอกย้อนหลัง
          </p>
          <p className="mt-0.5 pl-5">
            กรอกน้ำหนัก{label}ย้อนหลังได้อีก {win.daysLeft} วัน — ภายใน {formatThaiDate(win.closesISO)}
          </p>
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-md bg-primary/[0.06] px-3 py-2 text-xs text-muted-foreground">
          <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            {period === "start"
              ? `กรอกน้ำหนักต้นเดือนได้ตั้งแต่วันแรกของเดือน และไม่เกิน ${END_WEIGHT_GRACE_DAYS} วันหลังจบเดือน`
              : `กรอกน้ำหนักสิ้นเดือนได้ตั้งแต่วันสุดท้ายของเดือน และไม่เกิน ${END_WEIGHT_GRACE_DAYS} วันหลังจบเดือน`}
          </span>
        </p>
      )}
      {initial?.status === "rejected" && initial.rejectNote && (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-[hsl(32_80%_34%)]">
          เหตุผลจากหัวหน้า: {initial.rejectNote}
        </p>
      )}
      <fieldset
        disabled={disabled}
        className={cn(
          "m-0 flex min-w-0 flex-1 flex-col gap-4 border-0 p-0",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <Field label="น้ำหนัก (กก.)" required error={error}>
          <div className="relative">
            <Input
              type="number" inputMode="decimal" step="0.1" min="0" placeholder="70.0" disabled={disabled}
              className="tnum pr-12" value={weight} onChange={(e) => setWeight(e.target.value)}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">กก.</span>
          </div>
        </Field>
        <ImageUpload
          label={`ภาพน้ำหนัก${label}`}
          required
          value={image}
          onChange={(v) => {
            setImage(v);
            if (!v || v.startsWith("data:")) setImageRef(undefined);
          }}
          disabled={disabled}
        />
        <Button onClick={submit} variant={saved ? "outline" : "primary"} disabled={saving || disabled} className="mt-auto">
          {saving ? "กำลังบันทึก…" : disabled ? "ยังกรอกไม่ได้" : status === "rejected" ? "บันทึกการแก้ไข" : saved ? "อัปเดต" : "บันทึก"}
        </Button>
      </fieldset>
    </Card>

    <SaveProgressDialog
      open={progressOpen}
      title={
        status === "rejected"
          ? `กำลังบันทึกการแก้ไขน้ำหนัก${label}`
          : saved
            ? `กำลังอัปเดตน้ำหนัก${label}`
            : `กำลังบันทึกน้ำหนัก${label}`
      }
      steps={progressSteps}
      errorMessage={progressError}
      onClose={closeProgress}
    />
    </>
  );
}

/* ===================== shared ===================== */
function IdentityRow() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="รหัสพนักงาน" htmlFor="empId">
        <Input id="empId" value={user.id} disabled className="tnum" />
      </Field>
      <Field label="ชื่อพนักงาน" htmlFor="empName">
        <Input id="empName" value={user.name} disabled />
      </Field>
    </div>
  );
}

function TimeBox({
  value, onChange, max, aria,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  aria: string;
}) {
  return (
    <Input
      type="number" min="0" max={max} inputMode="numeric" aria-label={aria} placeholder="00"
      className="tnum px-2 text-center" value={value}
      onChange={(e) => {
        const n = e.target.value.replace(/\D/g, "").slice(0, 2);
        if (n === "" || Number(n) <= max) onChange(n);
      }}
      onBlur={(e) => e.target.value && onChange(pad2(Number(e.target.value)))}
    />
  );
}
