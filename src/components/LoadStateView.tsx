import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { USER_MESSAGES } from "@/lib/errors";
import { Button, LoadingBlock } from "@/components/ui";

export function LoadStateView({
  loading,
  slow,
  error,
  onRetry,
  label = "กำลังโหลด…",
  compact,
  children,
}: {
  loading: boolean;
  slow?: boolean;
  error?: string | null;
  onRetry?: () => void;
  label?: string;
  compact?: boolean;
  children: ReactNode;
}) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <p className="max-w-sm text-sm text-danger">{error}</p>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" />
            ลองใหม่
          </Button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <LoadingBlock compact={compact} label={label} />
        {slow && (
          <p className="pb-4 text-center text-xs text-muted-foreground">{USER_MESSAGES.loadSlow}</p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
