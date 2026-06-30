import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Footprints, ArrowRight, IdCard, Lock, KeyRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { APP_VERSION } from "@/lib/version";
import { normalizeEmployeeId } from "@/lib/employee-id";
import { passwordsMatch, validatePassword, validatePasswordCharacters, PASSWORD_FORMAT_HINT } from "@/lib/password";
import { Button, Field, Input, PasswordInput } from "@/components/ui";

export default function ChangePassword() {
  const { changePassword, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [employeeId, setEmployeeId] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [employeeError, setEmployeeError] = useState<string>();
  const [currentError, setCurrentError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [confirmError, setConfirmError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate("/app", { replace: true });
  }, [user, authLoading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setEmployeeError(undefined);
    setCurrentError(undefined);
    setPasswordError(undefined);
    setConfirmError(undefined);

    const id = normalizeEmployeeId(employeeId);
    if (!id) {
      setEmployeeError("กรุณากรอกรหัสพนักงาน");
      return;
    }
    if (!currentPassword) {
      setCurrentError("กรุณากรอกรหัสผ่านเดิม");
      return;
    }

    const pwError = validatePassword(newPassword);
    if (pwError) {
      setPasswordError(pwError);
      return;
    }

    const matchError = passwordsMatch(newPassword, confirm);
    if (matchError) {
      setConfirmError(matchError);
      return;
    }

    setLoading(true);
    const res = await changePassword(id, currentPassword, newPassword);
    setLoading(false);

    if (!res.ok) {
      if (res.needsPassword) {
        navigate(`/set-password?employee_id=${encodeURIComponent(id)}`, { replace: true });
        return;
      }
      if (res.error === "รหัสผ่านเดิมไม่ถูกต้อง") {
        setCurrentError(res.error);
        return;
      }
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
              <p className="text-sm text-muted-foreground">เปลี่ยนรหัสผ่าน</p>
            </div>
          </div>

          {success ? (
            <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-5 text-sm text-success">
              เปลี่ยนรหัสผ่านสำเร็จ กำลังพาไปหน้าเข้าสู่ระบบ…
            </div>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">เปลี่ยนรหัสผ่าน</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                กรอกรหัสผ่านเดิมและตั้งรหัสผ่านใหม่ — รหัสพนักงานต้องตรงกับที่มีในระบบ
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

                <Field label="รหัสผ่านเดิม" required htmlFor="current-password" error={currentError}>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <PasswordInput
                      id="current-password"
                      autoComplete="current-password"
                      placeholder="รหัสผ่านปัจจุบัน"
                      className="pl-11"
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        if (currentError) setCurrentError(undefined);
                      }}
                    />
                  </div>
                </Field>

                <Field
                  label="รหัสผ่านใหม่"
                  required
                  htmlFor="new-password"
                  hint={PASSWORD_FORMAT_HINT}
                  error={passwordError}
                >
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <PasswordInput
                      id="new-password"
                      autoComplete="new-password"
                      placeholder="ตั้งรหัสผ่านใหม่"
                      className="pl-11"
                      value={newPassword}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewPassword(value);
                        setPasswordError(validatePasswordCharacters(value) ?? undefined);
                      }}
                    />
                  </div>
                </Field>

                <Field label="ยืนยันรหัสผ่านใหม่" required htmlFor="confirm" error={confirmError}>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                    <PasswordInput
                      id="confirm"
                      autoComplete="new-password"
                      placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
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
                  disabled={loading || !!validatePasswordCharacters(newPassword)}
                >
                  {loading ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link to="/" className="font-medium text-primary hover:underline">
                    กลับไปเข้าสู่ระบบ
                  </Link>
                  {" · "}
                  <Link to="/set-password" className="font-medium text-primary hover:underline">
                    สร้างรหัสผ่านครั้งแรก
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
