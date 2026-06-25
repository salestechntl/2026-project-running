import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------- Button ---------------- */
type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-[hsl(227_82%_48%)] active:bg-[hsl(227_82%_44%)] hover:shadow-glow",
  secondary: "bg-ink text-ink-foreground hover:bg-[hsl(231_100%_20%)] active:bg-ink shadow-sm",
  outline: "border border-primary/25 bg-card text-primary hover:bg-primary/5 hover:border-primary/40",
  ghost: "hover:bg-muted text-foreground",
  danger: "bg-danger text-white hover:brightness-105 active:brightness-95",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-all duration-150",
        "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

/* ---------------- Card ---------------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-border/80 bg-card shadow-sm", className)}>{children}</div>
  );
}

/* ---------------- Field (label + input wrapper) ---------------- */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-primary">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/* ---------------- Input ---------------- */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-xl border border-input bg-card px-3.5 text-[15px] text-foreground shadow-xs transition-colors",
        "placeholder:text-muted-foreground/70",
        "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

/* ---------------- PasswordInput (toggle visibility) ---------------- */
export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-11", className)}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          aria-pressed={visible}
          className={cn(
            "absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg",
            "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
          )}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

/* ---------------- Select ---------------- */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-input bg-card pl-3.5 pr-10 text-[15px] text-foreground shadow-xs transition-colors",
          "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
          "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8"
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  ),
);
Select.displayName = "Select";

/* ---------------- Badge ---------------- */
const badgeTones = {
  neutral: "bg-muted text-muted-foreground",
  accent: "bg-primary/12 text-primary",
  gold: "bg-accent/15 text-[hsl(38_90%_38%)]",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-[hsl(32_80%_38%)]",
  danger: "bg-danger text-white",
  ink: "bg-ink/10 text-ink",
  info: "bg-primary/8 text-primary",
} as const;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof badgeTones;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------- ConfirmDialog ---------------- */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-up" onClick={onCancel} />
      <div className="relative w-full max-w-sm animate-scale-in rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              tone === "danger" ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary",
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {message && <div className="mt-1 text-sm text-muted-foreground">{message}</div>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- AlertDialog ---------------- */
export function AlertDialog({
  open,
  title = "แจ้งเตือน",
  message,
  confirmLabel = "ตกลง",
  tone = "danger",
  onClose,
}: {
  open: boolean;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "warning" | "primary";
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-up" onClick={onClose} />
      <div className="relative w-full max-w-sm animate-scale-in rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              tone === "danger" && "bg-danger/10 text-danger",
              tone === "warning" && "bg-warning/15 text-[hsl(32_80%_34%)]",
              tone === "primary" && "bg-primary/10 text-primary",
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            <div className="mt-1 text-sm text-muted-foreground">{message}</div>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onClose}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- RejectReasonDialog ---------------- */
export function RejectReasonDialog({
  open,
  title = "ยืนยันไม่ผ่านรายการ",
  message,
  confirmLabel = "ไม่ผ่าน",
  cancelLabel = "ยกเลิก",
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setError(undefined);
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("กรุณาระบุเหตุผลที่ไม่ผ่าน");
      textareaRef.current?.focus();
      return;
    }
    onConfirm(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-up" onClick={busy ? undefined : onCancel} />
      <div className="relative w-full max-w-md animate-scale-in rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {message && <div className="mt-1 text-sm text-muted-foreground">{message}</div>}
          </div>
        </div>
        <div className="mt-5">
          <Field label="เหตุผลที่ไม่ผ่าน" required error={error} htmlFor="reject-reason">
            <textarea
              ref={textareaRef}
              id="reject-reason"
              rows={3}
              value={reason}
              disabled={busy}
              placeholder="ระบุเหตุผลที่ไม่ผ่าน"
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(undefined);
              }}
              className={cn(
                "w-full resize-y rounded-xl border border-input bg-card px-3.5 py-2.5 text-[15px] text-foreground shadow-xs transition-colors",
                "placeholder:text-muted-foreground/70",
                "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
              )}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <Button variant="outline" onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button variant="danger" onClick={handleConfirm} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Loading ---------------- */
export function LoadingSpinner({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" };
  return (
    <Loader2
      className={cn(sizes[size], "animate-spin text-primary", className)}
      aria-hidden
    />
  );
}

export function LoadingBlock({
  label = "กำลังโหลด…",
  className,
  compact,
}: {
  label?: string;
  className?: string;
  /** ความสูงน้อยลง — ใช้ใน card / sidebar */
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground",
        compact ? "py-6" : "py-10",
        className,
      )}
    >
      <LoadingSpinner size="lg" />
      <span>{label}</span>
    </div>
  );
}

/* ---------------- Stat ---------------- */
export function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-xs">
      <div className="h-1 bg-primary" />
      <div className="p-3 sm:p-4">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
          {label}
        </p>
        <p className="mt-1 flex items-baseline gap-1">
          <span className="tnum text-xl font-bold text-foreground sm:text-2xl">{value}</span>
          {unit && <span className="text-xs text-muted-foreground sm:text-sm">{unit}</span>}
        </p>
      </div>
    </div>
  );
}
