import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Footprints, ArrowRight, IdCard, Lock, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { APP_VERSION } from "@/lib/version";
import { normalizeEmployeeId } from "@/lib/employee-id";
import { passwordsMatch, validatePassword, validatePasswordCharacters, PASSWORD_FORMAT_HINT } from "@/lib/password";
import { Button, Field, Input, PasswordInput } from "@/components/ui";

export default function SetPassword() {
  const { setPassword, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [employeeId, setEmployeeId] = useState(searchParams.get("employee_id") ?? "");
  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [employeeError, setEmployeeError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [confirmError, setConfirmError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate("/app", { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fromQuery = searchParams.get("employee_id");
    if (fromQuery) setEmployeeId(fromQuery);
  }, [searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setEmployeeError(undefined);
    setPasswordError(undefined);
    setConfirmError(undefined);

    const id = normalizeEmployeeId(employeeId);
    if (!id) {
      setEmployeeError("กรุณากรอกรหัสพนักงาน");
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      setPasswordError(pwError);
      return;
    }

    const matchError = passwordsMatch(password, confirm);
    if (matchError) {
      setConfirmError(matchError);
      return;
    }

    setLoading(true);
    const res = await setPassword(id, password);
    setLoading(false);

    if (!res.ok) {
      setPasswordError(res.error);
      return;
    }

    setSuccess(true);
    setTimeout(() => navigate("/", { replace: true }), 1500);
  }

  return (
    <div className="relative min-h-screen bg-background">
      <div className="flex min-h-screen items-center justify-center p-6 pb-16 sm:p-10">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-glow">
              <Footprints className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-lg font-extrabold tracking-tight">Running Camp 2026</p>
              <p className="text-sm text-muted-foreground">สร้างรหัสผ่านครั้งแรก</p>
            </div>
          </div>

          {success ? (
            <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-5 text-sm text-success">
              ตั้งรหัสผ่านสำเร็จ กำลังพาไปหน้าเข้าสู่ระบบ…
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">สร้างรหัสผ่าน</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                สำหรับพนักงานที่ยังไม่เคยตั้งรหัสผ่าน — รหัสพนักงานต้องตรงกับที่มีในระบบ
              </p>

              <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
                <Field label="รหัสพนักงาน" required htmlFor="emp" error={employeeError}>
                  <div className="relative">
                    <IdCard className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="emp"
                      type="text"
                      autoFocus
                      autoComplete="username"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="เช่น 80001234 หรือ AS123456"
                      className="pl-11 tnum"
                      value={employeeId}
                      onChange={(e) => {
                        setEmployeeId(e.target.value);
                        if (employeeError) setEmployeeError(undefined);
                      }}
                    />
                  </div>
                </Field>

                <Field
                  label="รหัสผ่าน"
                  required
                  htmlFor="password"
                  hint={PASSWORD_FORMAT_HINT}
                  error={passwordError}
                >
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <PasswordInput
                      id="password"
                      autoComplete="new-password"
                      placeholder="ตั้งรหัสผ่าน"
                      className="pl-11"
                      value={password}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPasswordValue(value);
                        setPasswordError(validatePasswordCharacters(value) ?? undefined);
                      }}
                    />
                  </div>
                </Field>

                <Field label="ยืนยันรหัสผ่าน" required htmlFor="confirm" error={confirmError}>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <PasswordInput
                      id="confirm"
                      autoComplete="new-password"
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      className="pl-11"
                      value={confirm}
                      onChange={(e) => {
                        setConfirm(e.target.value);
                        if (confirmError) setConfirmError(undefined);
                      }}
                    />
                  </div>
                </Field>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={loading || !!validatePasswordCharacters(password)}
                >
                  {loading ? "กำลังบันทึก…" : "บันทึกรหัสผ่าน"}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  มีรหัสผ่านแล้ว?{" "}
                  <Link to="/" className="font-medium text-primary hover:underline">
                    กลับไปเข้าสู่ระบบ
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-border/80 bg-background/95 px-4 py-2.5 text-center text-xs tabular-nums text-muted-foreground backdrop-blur-sm">
        Version {APP_VERSION}
      </footer>
    </div>
  );
}
