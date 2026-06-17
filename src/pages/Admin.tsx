import { useEffect, useState } from "react";
import {
  Image as ImageIcon, Images, Footprints, Scale, ChevronRight, ChevronLeft, Inbox, X,
  CheckCircle2, AlertTriangle, Undo2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { missionName } from "@/lib/missions";
import {
  setRunEntryStatus, setWeightEntryStatus,
  countNewForMember, markMemberSeen, fetchRuns,
  DATA_CHANGED_EVENT, RUN_TYPE_LABEL,
  type RunEntry, type WeightEntry, type EntryStatus,
} from "@/lib/entries";
import { useRuns, useWeights } from "@/lib/hooks/useEntries";
import { useSubordinates } from "@/lib/hooks/useTeam";
import { formatThaiDate, pad2 } from "@/lib/utils";
import { Card, Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

export default function Admin() {
  const { user } = useAuth();
  const { team } = useSubordinates(user?.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gallery, setGallery] = useState<{ images: string[]; index: number } | null>(null);
  const [runCounts, setRunCounts] = useState<Record<string, number>>({});
  const [freshCounts, setFreshCounts] = useState<Record<string, number>>({});
  const openGallery = (images: string[]) => images.length > 0 && setGallery({ images, index: 0 });

  useEffect(() => {
    if (team.length > 0 && !selectedId) setSelectedId(team[0].id);
  }, [team, selectedId]);

  const selected = team.find((t) => t.id === selectedId);
  const { runs, refresh: refreshRuns } = useRuns(selected?.id);
  const { weights, refresh: refreshWeights } = useWeights(selected?.id);
  const bump = () => {
    void refreshRuns();
    void refreshWeights();
  };

  useEffect(() => {
    if (!user || team.length === 0) return;
    let cancelled = false;
    const load = async () => {
      const counts: Record<string, number> = {};
      const fresh: Record<string, number> = {};
      await Promise.all(
        team.map(async (member) => {
          const [memberRuns, freshCount] = await Promise.all([
            fetchRuns(member.id),
            countNewForMember(user.id, member.id),
          ]);
          counts[member.id] = memberRuns.length;
          fresh[member.id] = freshCount;
        }),
      );
      if (!cancelled) {
        setRunCounts(counts);
        setFreshCounts(fresh);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user, team]);

  useEffect(() => {
    if (!user || !selectedId) return;
    void markMemberSeen(user.id, selectedId).then(() => {
      setFreshCounts((prev) => ({ ...prev, [selectedId]: 0 }));
    });
  }, [user?.id, selectedId]);

  useEffect(() => {
    const onChange = () => bump();
    window.addEventListener(DATA_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, onChange);
  }, [refreshRuns, refreshWeights]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">ข้อมูลทีมของฉัน</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ตรวจสอบรายการที่ลูกทีมบันทึก — กด “ขอให้แก้ไข” เพื่อเปิดสิทธิ์ให้เจ้าตัวกลับไปแก้รายการย้อนหลังได้
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Team list */}
        <aside className="space-y-2">
          <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            สมาชิกในทีม · {team.length} คน
          </p>
          {team.map((member) => {
            const count = runCounts[member.id] ?? 0;
            const fresh = freshCounts[member.id] ?? 0;
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
                  <span className="tnum block text-xs text-muted-foreground">รหัส {member.id} · {count} กิจกรรม</span>
                </span>
                {fresh > 0 && (
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow-sm"
                    title="มีรายการใหม่/อัปเดตที่ยังไม่ได้เปิดดู"
                  >
                    {fresh}
                  </span>
                )}
                <ChevronRight className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              </button>
            );
          })}
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
                  <Badge tone="accent"><Footprints className="h-3 w-3" /> {runs.length} วิ่ง</Badge>
                  <Badge tone="neutral"><Scale className="h-3 w-3" /> {weights.length} น้ำหนัก</Badge>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">รายการวิ่ง</h3>
                {runs.length === 0 ? (
                  <EmptyState text="ยังไม่มีการบันทึกการวิ่ง" />
                ) : (
                  <Card className="divide-y divide-border overflow-hidden">
                    {runs.map((r) => <RunRow key={r.id} run={r} onPreview={openGallery} onChange={bump} />)}
                  </Card>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">บันทึกน้ำหนัก</h3>
                {weights.length === 0 ? (
                  <EmptyState text="ยังไม่มีการบันทึกน้ำหนัก" />
                ) : (
                  <Card className="divide-y divide-border overflow-hidden">
                    {weights.map((w) => <WeightRow key={w.id} weight={w} onPreview={openGallery} onChange={bump} />)}
                  </Card>
                )}
              </div>
            </>
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

/* ---------- status controls (reject / restore) ---------- */
function StatusControls({
  status,
  onReject,
  onRestore,
}: {
  status: EntryStatus;
  onReject: () => void;
  onRestore: () => void;
}) {
  if (status === "rejected") {
    return (
      <div className="flex items-center gap-1.5">
        <Badge tone="warning"><AlertTriangle className="h-3 w-3" /> รอแก้ไข</Badge>
        <button
          onClick={onRestore}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Undo2 className="h-3.5 w-3.5" /> ยกเลิก
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Badge tone="success"><CheckCircle2 className="h-3 w-3" /> ส่งแล้ว</Badge>
      <Button size="sm" variant="outline" onClick={onReject} className="h-8 px-2.5 text-xs">
        ขอให้แก้ไข
      </Button>
    </div>
  );
}

function askReason(): string | null {
  return window.prompt("ระบุสิ่งที่ต้องการให้แก้ไข (ไม่บังคับ)", "") ;
}

function RunRow({ run, onPreview, onChange }: { run: RunEntry; onPreview: (images: string[]) => void; onChange: () => void }) {
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
            {run.distanceKm.toFixed(2)} กม. · {fmtDuration(run.durationSec)} ชม.{run.note ? ` · ${run.note}` : ""}
          </p>
        </div>
        <StatusControls
          status={run.status}
          onReject={async () => {
            const r = askReason();
            if (r === null) return;
            await setRunEntryStatus(run.id, "rejected", r || undefined);
            onChange();
          }}
          onRestore={async () => {
            await setRunEntryStatus(run.id, "submitted");
            onChange();
          }}
        />
      </div>
      {run.status === "rejected" && run.rejectNote && (
        <p className="mt-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-[hsl(32_80%_34%)]">หมายเหตุ: {run.rejectNote}</p>
      )}
    </div>
  );
}

function WeightRow({ weight, onPreview, onChange }: { weight: WeightEntry; onPreview: (images: string[]) => void; onChange: () => void }) {
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
        </div>
        <StatusControls
          status={weight.status}
          onReject={async () => {
            const r = askReason();
            if (r === null) return;
            await setWeightEntryStatus(weight.id, "rejected", r || undefined);
            onChange();
          }}
          onRestore={async () => {
            await setWeightEntryStatus(weight.id, "submitted");
            onChange();
          }}
        />
      </div>
      {weight.status === "rejected" && weight.rejectNote && (
        <p className="mt-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-[hsl(32_80%_34%)]">หมายเหตุ: {weight.rejectNote}</p>
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
