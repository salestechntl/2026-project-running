import { BarChart3 } from "lucide-react";
import { Card } from "@/components/ui";

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="animate-fade-up">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">ภาพรวมสถิติการวิ่งของทั้งโครงการ</p>
      </header>

      <div className="space-y-3 animate-scale-in">
        <Card className="overflow-hidden rounded-2xl">
          <div className="relative flex flex-col items-center justify-center gap-4 hero-surface px-6 py-16 text-center">
            <div className="grain absolute inset-0 opacity-40" />
            <div className="hero-glow pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
              <BarChart3 className="h-8 w-8" />
            </span>
            <p className="relative text-lg font-bold">เปิดรายงาน</p>
            <span className="relative inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-ink-foreground backdrop-blur">
              ไปยัง Dashboard
            </span>
          </div>
        </Card>

        <p className="text-center text-sm font-semibold text-danger">*** อยู่ระหว่างการดำเนินการ ***</p>
      </div>
    </div>
  );
}
