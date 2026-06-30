import { Link } from "react-router-dom";
import { PenLine, BarChart3, Users, ArrowRight, Scale, TrendingUp, Target, CheckCircle2, Circle, Calendar, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { currentMonthKey, missionForMonth, monthLabel } from "@/lib/missions";
import { useHomeStats } from "@/lib/hooks/useEntries";
import { Stat } from "@/components/ui";
import { LoadStateView } from "@/components/LoadStateView";
import { cn } from "@/lib/utils";

export default function Home() {
  const { user, isLead, isChecker, isSuperAdmin } = useAuth();
  const orgWideTeam = isChecker || isSuperAdmin;
  const manageTeam = isLead || orgWideTeam;
  const { stats, loading: statsLoading, loadSlow: statsLoadSlow, loadError: statsLoadError, refresh: refreshStats } = useHomeStats(user?.id, manageTeam, user?.id);

  if (!user) return null;

  const weighMonth = stats?.monthKey ?? currentMonthKey();
  const monthKm = stats?.monthKm ?? 0;
  const monthRunCount = stats?.monthRunCount ?? 0;
  const hasStart = stats?.weightStartDone ?? false;
  const hasEnd = stats?.weightEndDone ?? false;
  const weightDone = hasStart && hasEnd;
  const teamCount = stats?.teamCount ?? 0;

  const menu = [
    {
      to: "/app/log",
      icon: PenLine,
      title: "บันทึกข้อมูล",
      desc: "บันทึกการวิ่งประจำวัน และน้ำหนักต้นเดือน–สิ้นเดือน",
      cta: "เริ่มบันทึก",
      featured: true,
    },
    {
      to: "/app/dashboard",
      icon: BarChart3,
      title: "Dashboard",
      desc: "ดูสถิติและภาพรวมผลการวิ่งบน Tableau",
      cta: "เปิด Dashboard",
    },
    ...(manageTeam
      ? [
          {
            to: "/app/admin",
            icon: Users,
            title: orgWideTeam ? "ข้อมูลทีมทั้งองค์กร" : "ข้อมูลทีมของฉัน",
            desc: orgWideTeam
              ? `ตรวจสอบรายการที่พนักงาน ${statsLoading ? "…" : teamCount} คนบันทึกเข้ามา`
              : `ตรวจสอบรายการที่ลูกทีม ${statsLoading ? "…" : teamCount} คนบันทึกเข้ามา`,
            cta: "ดูข้อมูลทีม",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      {/* Mission of the month */}
      {(() => {
        const cur = currentMonthKey();
        const m = missionForMonth(cur);
        if (!m) return null;
        return (
          <section className="relative overflow-hidden rounded-2xl border border-primary/20 hero-surface p-5 animate-fade-up sm:p-6">
            <div className="hero-glow pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-50 blur-2xl" />
            <div className="relative">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-accent">
                <Target className="h-3.5 w-3.5" /> ภารกิจประจำเดือน · {monthLabel(cur)}
              </p>
              <h2 className="mt-1.5 font-display text-xl font-extrabold tracking-tight">{m.name}</h2>
              <p className="mt-1 text-sm text-ink-foreground/70">{m.objective}</p>
            </div>
          </section>
        );
      })()}

      {/* Weight-of-the-month status */}
      <section className="animate-fade-up">
        <div
          className={cn(
            "flex flex-col gap-4 rounded-2xl border p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between",
            weightDone ? "border-success/30 bg-success/[0.06]" : "border-primary/25 bg-primary/[0.04]",
          )}
        >
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                weightDone ? "bg-success/15 text-success" : "bg-primary/10 text-primary",
              )}
            >
              <Scale className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                น้ำหนักประจำเดือน · {monthLabel(weighMonth)}
              </p>
              <LoadStateView
                loading={statsLoading}
                slow={statsLoadSlow}
                error={statsLoadError}
                onRetry={() => void refreshStats()}
                label="กำลังโหลดข้อมูลน้ำหนัก…"
                compact
              >
              {!statsLoading && !statsLoadError && (
              <div className="mt-2 flex flex-wrap gap-2">
                <WeightChip label="ต้นเดือน" done={hasStart} />
                <WeightChip label="สิ้นเดือน" done={hasEnd} />
              </div>
              )}
              </LoadStateView>
              {!statsLoading && !statsLoadError && (
              <ul className="mt-3 space-y-1">
                <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  บันทึกน้ำหนักต้นเดือนได้เฉพาะวันที่ 1 ของเดือน
                </li>
                <li className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  กรอกน้ำหนักสิ้นเดือนได้วันสุดท้ายของเดือนและวันที่ 1–2 เดือนถัดไป
                </li>
              </ul>
              )}
            </div>
          </div>
          <Link
            to="/app/log?tab=weight"
            className={cn(
              "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-5 text-sm font-semibold transition-all",
              weightDone
                ? "border border-input bg-card text-foreground hover:bg-muted"
                : "bg-primary text-primary-foreground shadow-sm hover:brightness-105 hover:shadow-glow",
            )}
          >
            {weightDone ? "ดู / แก้ไข" : "กรอกน้ำหนัก"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Personal stats */}
      <section>
        <LoadStateView
          loading={statsLoading}
          slow={statsLoadSlow}
          error={statsLoadError}
          onRetry={() => void refreshStats()}
          label="กำลังโหลดสถิติการวิ่ง…"
        >
          <StatGroup title="เดือนนี้" caption={monthLabel(weighMonth)} icon={Target} tone="primary">
            <Stat label="ระยะทางสะสม" value={monthKm.toFixed(1)} unit="กม." />
            <Stat label="จำนวนครั้งที่วิ่ง" value={String(monthRunCount)} unit="ครั้ง" />
          </StatGroup>
        </LoadStateView>
      </section>

      {/* Menu */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">เมนูหลัก</h2>
        <div className={`grid gap-4 ${menu.length >= 3 ? "md:grid-cols-3" : "sm:grid-cols-2"}`}>
          {menu.map((m, i) => (
            <Link
              key={m.to}
              to={m.to}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 shadow-sm transition-all duration-200 animate-scale-in hover:-translate-y-0.5 hover:shadow-lg focus-visible:-translate-y-0.5 ${
                m.featured
                  ? "hero-surface border-primary/30 text-ink-foreground shadow-md"
                  : "border-border/80 bg-card hover:border-primary/30 hover:shadow-md"
              }`}
            >
              {m.featured && (
                <>
                  <div className="hero-glow pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-40 blur-2xl" />
                  <div className="hero-glow-accent pointer-events-none absolute -bottom-8 left-4 h-32 w-32 rounded-full opacity-25 blur-2xl" />
                </>
              )}
              <div className="relative">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    m.featured ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                  }`}
                >
                  <m.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg font-bold tracking-tight">{m.title}</h3>
                <p className={`mt-1 text-sm ${m.featured ? "text-ink-foreground/70" : "text-muted-foreground"}`}>
                  {m.desc}
                </p>
              </div>
              <span
                className={`relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold ${
                  m.featured ? "text-accent" : "text-primary"
                }`}
              >
                {m.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick hints */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">บันทึกทุกการวิ่ง</p>
            <p className="text-xs text-muted-foreground">แนบภาพจาก Strava เพื่อยืนยันผล · ภารกิจกำหนดตามเดือนอัตโนมัติ</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-xs">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Scale className="h-[18px] w-[18px]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">ชั่งน้ำหนัก 2 ครั้ง/เดือน</p>
            <p className="text-xs text-muted-foreground">กรอกน้ำหนักพร้อมแนบภาพ ทั้งต้นเดือนและสิ้นเดือน</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatGroup({
  title,
  caption,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  caption: string;
  icon: LucideIcon;
  tone: "ink" | "primary";
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-2.5 flex items-center gap-2 px-0.5">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            tone === "ink" ? "bg-ink/10 text-ink" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11px] text-muted-foreground">{caption}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">{children}</div>
    </div>
  );
}

function WeightChip({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        done ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
      )}
    >
      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
      {label}
      <span className="font-normal opacity-80">· {done ? "บันทึกแล้ว" : "ยังไม่กรอก"}</span>
    </span>
  );
}
