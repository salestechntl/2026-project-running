import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Footprints, ArrowRight, IdCard } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { APP_VERSION } from "@/lib/version";
import { Button, Field, Input } from "@/components/ui";

export default function Login() {
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [id, setId] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate("/app", { replace: true });
  }, [user, authLoading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    const res = await login(id);
    setLoading(false);
    if (res.ok) navigate("/app");
    else setError(res.error);
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="grid min-h-screen pb-12 lg:grid-cols-[1.05fr_1fr] lg:pb-14">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden hero-surface p-10 lg:flex">
        <div className="grain absolute inset-0 opacity-50" />
        <div className="hero-glow absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-40 blur-3xl" />
        <div className="hero-glow-accent absolute -bottom-16 left-8 h-64 w-64 rounded-full opacity-30 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
            <Footprints className="h-6 w-6" />
          </span>
          <div>
            <p className="font-display text-lg font-extrabold tracking-tight">Running Camp</p>
            <p className="text-sm font-bold text-accent">2026</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-extrabold leading-[1.1] tracking-tight">
            ทุกก้าว นับเป็นความสำเร็จ
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-foreground/70">
            บันทึกการวิ่ง ติดตามน้ำหนัก และดูสถิติของทีมได้ในที่เดียว
            ร่วมสร้างสุขภาพดีไปด้วยกันตลอดปี 2026
          </p>
          <div className="mt-8 flex gap-6">
            {[
              { k: "10", l: "ผู้เข้าร่วม" },
              { k: "37.6", l: "กม. สะสมทีม" },
              { k: "6", l: "Missions" },
            ].map((s) => (
              <div key={s.l}>
                <p className="tnum text-2xl font-bold">{s.k}</p>
                <p className="text-xs text-ink-foreground/60">{s.l}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-ink-foreground/50">
          © 2026 People &amp; Culture · โครงการส่งเสริมสุขภาพพนักงาน
          <span className="mt-1 block tabular-nums text-ink-foreground/40">Version {APP_VERSION}</span>
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
              <Footprints className="h-6 w-6" />
            </span>
          </div>

          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">เข้าสู่ระบบ</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            ใช้รหัสพนักงานของคุณเพื่อเริ่มบันทึกกิจกรรม
          </p>

          <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
            <Field label="รหัสพนักงาน" required htmlFor="emp" error={error}>
              <div className="relative">
                <IdCard className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="emp"
                  inputMode="numeric"
                  autoFocus
                  autoComplete="off"
                  placeholder="เช่น 80001234"
                  className="pl-11 tnum"
                  value={id}
                  onChange={(e) => {
                    setId(e.target.value);
                    if (error) setError(undefined);
                  }}
                  aria-invalid={!!error}
                />
              </div>
            </Field>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-border/80 bg-background/95 px-4 py-2.5 text-center text-xs tabular-nums text-muted-foreground backdrop-blur-sm">
        Version {APP_VERSION}
      </footer>
    </div>
  );
}
