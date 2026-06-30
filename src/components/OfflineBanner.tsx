import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/hooks/useOnline";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="alert"
      className="shrink-0 border-b border-warning/50 bg-warning/15 px-4 py-2 text-center text-xs font-medium text-[hsl(32_80%_28%)]"
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        ไม่มีการเชื่อมต่ออินเทอร์เน็ต — บันทึกข้อมูลจะทำได้เมื่อเชื่อมต่อแล้ว
      </span>
    </div>
  );
}
