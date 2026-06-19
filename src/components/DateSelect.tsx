import { useMemo } from "react";
import { Select } from "@/components/ui";
import { cn, formatThaiDate, pad2 } from "@/lib/utils";

function addDaysISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

/** รายการวันที่ yyyy-mm-dd จาก min ถึง max (รวมปลายทาง) */
function dateRangeOptions(min: string, max: string): string[] {
  if (!min || !max || min > max) return max ? [max] : [];
  const dates: string[] = [];
  let cur = min;
  while (cur <= max) {
    dates.push(cur);
    cur = addDaysISO(cur, 1);
  }
  return dates;
}

export function DateSelect({
  id,
  value,
  min,
  max,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  min: string;
  max: string;
  onChange: (iso: string) => void;
  className?: string;
}) {
  const options = useMemo(() => {
    const dates = dateRangeOptions(min, max);
    return [...dates].reverse();
  }, [min, max]);

  const safeValue = useMemo(() => {
    if (value && options.includes(value)) return value;
    if (value && value >= min && value <= max) return value;
    return max;
  }, [value, options, min, max]);

  return (
    <Select
      id={id}
      value={safeValue}
      onChange={(e) => onChange(e.target.value)}
      className={cn("tnum", className)}
      aria-label="วันที่วิ่ง"
    >
      {options.map((iso) => (
        <option key={iso} value={iso}>
          {formatThaiDate(iso)}
        </option>
      ))}
    </Select>
  );
}
