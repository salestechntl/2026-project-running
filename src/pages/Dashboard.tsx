import { BarChart3, ArrowUpRight } from "lucide-react";
import { TABLEAU_URL } from "@/lib/data";
import { Card } from "@/components/ui";

export default function Dashboard() {
  function open() {
    window.open(TABLEAU_URL, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">ภาพรวมสถิติการวิ่งของทั้งโครงการบน Tableau</p>
      </header>

      <Card className="overflow-hidden animate-scale-in rounded-2xl">
        <button
          onClick={open}
          className="group relative flex w-full flex-col items-center justify-center gap-4 hero-surface px-6 py-16 text-center"
        >
          <div className="grain absolute inset-0 opacity-40" />
          <div className="hero-glow pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl transition-opacity group-hover:opacity-55" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
            <BarChart3 className="h-8 w-8" />
          </span>
          <div className="relative">
            <p className="text-lg font-bold">เปิดรายงานบน Tableau</p>
            <p className="mt-1 text-sm text-ink-foreground/70">
              ท่านสามารถดูรายการโดยใช้คอมพิวเตอร์บริษัทเท่านั้น
            </p>
          </div>
          <span className="relative inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-ink-foreground backdrop-blur transition-colors group-hover:bg-white/25">
            ไปยัง Dashboard
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </button>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        ลิงก์ปลายทาง:{" "}
        <a href={TABLEAU_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
          {TABLEAU_URL}
        </a>
      </p>
    </div>
  );
}
