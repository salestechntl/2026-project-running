import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { countDoneSteps, type SaveStepState } from "@/lib/save-progress";

function StepIcon({ status }: { status: SaveStepState["status"] }) {
  if (status === "done") return <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />;
  if (status === "running") return <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />;
  if (status === "error") return <XCircle className="h-5 w-5 shrink-0 text-danger" />;
  return <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" />;
}

export function SaveProgressDialog({
  open,
  title,
  steps,
  errorMessage,
  onClose,
}: {
  open: boolean;
  title: string;
  steps: SaveStepState[];
  errorMessage?: string;
  onClose: () => void;
}) {
  const done = countDoneSteps(steps);
  const total = steps.length;
  const failed = steps.some((s) => s.status === "error");
  const success = steps.some((s) => s.id === "complete" && s.status === "done");
  const busy = steps.some((s) => s.status === "running");
  const canClose = failed || success;

  useEffect(() => {
    if (!open || !canClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, canClose, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm" />
      <div className="relative w-full max-w-md animate-scale-in rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {failed
            ? `สำเร็จ ${done} จาก ${total} ขั้นตอน — ติดปัญหาที่ขั้นตอนที่แสดงสีแดง`
            : success
              ? `สำเร็จครบ ${total} ขั้นตอน`
              : busy
                ? `กำลังดำเนินการ… สำเร็จแล้ว ${done} จาก ${total} ขั้นตอน`
                : `เตรียมบันทึก ${total} ขั้นตอน`}
        </p>

        <ol className="mt-5 space-y-2.5">
          {steps.map((step, i) => (
            <li
              key={step.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                step.status === "done" && "border-success/30 bg-success/[0.06]",
                step.status === "running" && "border-primary/30 bg-primary/[0.05]",
                step.status === "error" && "border-danger/30 bg-danger/[0.06]",
                step.status === "pending" && "border-border bg-muted/20",
              )}
            >
              <span className="mt-0.5 flex w-5 justify-center text-xs font-bold text-muted-foreground">{i + 1}</span>
              <StepIcon status={step.status} />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "font-semibold",
                    step.status === "error" ? "text-danger" : "text-foreground",
                  )}
                >
                  {step.label}
                </p>
                {step.detail && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ol>

        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.06] px-3 py-2.5 text-sm text-danger">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {canClose && (
          <div className="mt-6 flex justify-end">
            <Button variant={failed ? "outline" : "primary"} onClick={onClose}>
              {failed ? "ปิด" : "ตกลง"}
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
