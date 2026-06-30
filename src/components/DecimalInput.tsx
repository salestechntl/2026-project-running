import { Route } from "lucide-react";
import { Input } from "@/components/ui";
import { formatFixedDecimals, sanitizeDecimalInput } from "@/lib/decimal-input";
import { cn } from "@/lib/utils";

export function DecimalInput({
  id,
  value,
  onChange,
  decimals = 2,
  max,
  min,
  placeholder,
  unit = "กม.",
  disabled,
  className,
  inputClassName,
  showIcon = true,
  onBlurFormat = true,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  decimals?: number;
  max?: number;
  min?: number;
  placeholder?: string;
  unit?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  showIcon?: boolean;
  onBlurFormat?: boolean;
}) {
  const hint =
    min != null && max != null
      ? `${min.toFixed(decimals)}–${max.toFixed(decimals)} ${unit}`
      : max != null
        ? `0.01–${max.toFixed(decimals)} ${unit}`
        : undefined;

  return (
    <div className={className}>
      <div className="relative">
        {showIcon && (
          <Route className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder ?? (max != null ? max.toFixed(decimals) : undefined)}
          className={cn("tnum", showIcon ? "pl-11 pr-12" : "pr-12", inputClassName)}
          value={value}
          onChange={(e) => onChange(sanitizeDecimalInput(e.target.value, decimals))}
          onBlur={() => {
            if (!onBlurFormat || !value.trim()) return;
            let formatted = formatFixedDecimals(value, decimals);
            const n = parseFloat(formatted);
            if (max != null && Number.isFinite(n) && n > max) formatted = max.toFixed(decimals);
            if (min != null && Number.isFinite(n) && n < min) formatted = min.toFixed(decimals);
            if (formatted !== value) onChange(formatted);
          }}
        />
        {unit && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
