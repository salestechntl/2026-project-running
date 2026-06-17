import { useId, useRef, useState } from "react";
import { ImagePlus, X, RefreshCw, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { fileToUploadDataUrl } from "@/lib/compress-image";

interface Props {
  label: string;
  required?: boolean;
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  hint?: string;
  disabled?: boolean;
}

export function ImageUpload({ label, required, value, onChange, hint, disabled }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();

  async function handleFile(file?: File) {
    setError(undefined);
    if (!file) return;
    try {
      onChange(await fileToUploadDataUrl(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="flex items-center gap-1 text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-primary">*</span>}
      </label>

      {value ? (
        <div className="group relative overflow-hidden rounded-lg border border-border bg-muted">
          <img src={value} alt={label} className={cn("max-h-64 w-full object-contain", disabled && "opacity-60")} />
          {!disabled && (
            <div className="absolute right-2 top-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-card/90 px-3 text-xs font-semibold text-foreground shadow-sm backdrop-blur transition hover:bg-card"
              >
                <RefreshCw className="h-3.5 w-3.5" /> เปลี่ยน
              </button>
              <button
                type="button"
                onClick={() => onChange(undefined)}
                aria-label="ลบรูปภาพ"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-card/90 text-danger shadow-sm backdrop-blur transition hover:bg-card"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      ) : disabled ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input bg-muted/30 px-6 py-9 text-center opacity-70">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium text-muted-foreground">ยังไม่สามารถแนบรูปได้</span>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-9 text-center transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-input bg-muted/40 hover:border-primary/50 hover:bg-muted",
          )}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ImagePlus className="h-5 w-5" />
          </span>
          <span className="text-sm font-medium text-foreground">
            ลากรูปมาวาง หรือ <span className="text-primary">เลือกไฟล์</span>
          </span>
          <span className="text-xs text-muted-foreground">JPG, PNG, WebP • สูงสุด 6 MB (บีบอัดอัตโนมัติ)</span>
        </label>
      )}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

interface MultiProps {
  label: string;
  required?: boolean;
  values: string[];
  onChange: (values: string[]) => void;
  max?: number;
  hint?: string;
}

/** อัปโหลดรูปได้หลายไฟล์ (สูงสุด `max` รูป) */
export function ImageUploadMulti({ label, required, values, onChange, max = 5, hint }: MultiProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const full = values.length >= max;

  async function addFiles(files: FileList | null) {
    setError(undefined);
    if (!files || files.length === 0) return;
    const room = max - values.length;
    if (room <= 0) {
      setError(`แนบได้สูงสุด ${max} รูป`);
      return;
    }
    const picked = Array.from(files);
    if (picked.length > room) setError(`แนบได้อีก ${room} รูป (สูงสุด ${max} รูป)`);
    const next: string[] = [];
    for (const file of picked.slice(0, room)) {
      try {
        next.push(await fileToUploadDataUrl(file));
      } catch (e) {
        setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
      }
    }
    if (next.length) onChange([...values, ...next]);
  }

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="flex items-center gap-1 text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-primary">*</span>}
        <span className="ml-1 font-normal text-muted-foreground">({values.length}/{max})</span>
      </label>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {values.map((src, i) => (
          <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
            <img src={src} alt={`${label} ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              aria-label={`ลบรูปที่ ${i + 1}`}
              className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-md bg-card/90 text-danger shadow-sm backdrop-blur transition hover:bg-card"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {!full && (
          <label
            htmlFor={inputId}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            className={cn(
              "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-input bg-muted/40 hover:border-primary/50 hover:bg-muted",
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              {values.length === 0 ? <ImagePlus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </span>
            <span className="px-1 text-xs font-medium text-primary">เพิ่มรูป</span>
          </label>
        )}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
      />
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
