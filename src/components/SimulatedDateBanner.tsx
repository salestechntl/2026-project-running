import { AlertTriangle } from "lucide-react";
import { getSimulatedTodayISO } from "@/lib/effective-date";
import { formatThaiDate } from "@/lib/utils";

export function SimulatedDateBanner() {
  const simulated = getSimulatedTodayISO();
  if (!simulated) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-50 shrink-0 border-b border-warning/50 bg-warning/15 px-4 py-2 text-center text-xs font-medium text-[hsl(32_80%_28%)] backdrop-blur-sm"
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        โหมดทดสอบ: จำลองวันที่ {formatThaiDate(simulated)} — อย่าเปิดใช้บน Production จริง
      </span>
    </div>
  );
}
