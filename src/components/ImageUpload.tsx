import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, X, RefreshCw, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fileToUploadDataUrl,
  isCompressingPreview,
  maxSideForSlotBudget,
  targetBytesPerImage,
} from "@/lib/compress-image";

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
  const [compressing, setCompressing] = useState(false);

  async function handleFile(file?: File) {
    setError(undefined);
    if (!file) return;
    setCompressing(true);
    try {
      onChange(await fileToUploadDataUrl(file, {
        targetBytes: targetBytesPerImage(1),
        maxSide: maxSideForSlotBudget(1),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setCompressing(false);
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
          {isCompressingPreview(value) && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/70 backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
              <span className="sr-only">กำลังบีบอัดรูป</span>
            </div>
          )}
          {!disabled && !compressing && !isCompressingPreview(value) && (
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
      ) : compressing ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-9 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <span className="text-sm font-medium text-foreground">กำลังบีบอัดรูป…</span>
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
            void handleFile(e.dataTransfer.files?.[0]);
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
          <span className="text-xs text-muted-foreground">JPG, PNG, WebP · สูงสุด 20 MB (บีบอัดอัตโนมัติ)</span>
        </label>
      )}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled || compressing}
        onChange={(e) => void handleFile(e.target.files?.[0])}
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

const COMPRESS_CONCURRENCY = 2;

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function runWorker() {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  }
  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => runWorker()));
}

/** อัปโหลดรูปได้หลายไฟล์ (สูงสุด `max` รูป) */
export function ImageUploadMulti({ label, required, values, onChange, max = 5, hint }: MultiProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const valuesRef = useRef(values);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string>();
  const [compressingCount, setCompressingCount] = useState(0);
  const full = values.length >= max;
  const busy = compressingCount > 0;

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  function replaceBlob(blobUrl: string, dataUrl: string) {
    URL.revokeObjectURL(blobUrl);
    const next = valuesRef.current.map((v) => (v === blobUrl ? dataUrl : v));
    valuesRef.current = next;
    onChange(next);
  }

  function dropBlob(blobUrl: string) {
    URL.revokeObjectURL(blobUrl);
    const next = valuesRef.current.filter((v) => v !== blobUrl);
    valuesRef.current = next;
    onChange(next);
  }

  function removeAt(index: number) {
    const src = valuesRef.current[index];
    if (isCompressingPreview(src)) URL.revokeObjectURL(src);
    const next = valuesRef.current.filter((_, j) => j !== index);
    valuesRef.current = next;
    onChange(next);
  }

  async function addFiles(files: FileList | null) {
    setError(undefined);
    if (!files || files.length === 0) return;
    const room = max - valuesRef.current.length;
    if (room <= 0) {
      setError(`แนบได้สูงสุด ${max} รูป`);
      return;
    }

    const picked = Array.from(files).slice(0, room);
    if (files.length > room) {
      setError(`แนบได้อีก ${room} รูป (สูงสุด ${max} รูป)`);
    }

    const objectUrls = picked.map((file) => URL.createObjectURL(file));
    const staged = [...valuesRef.current, ...objectUrls];
    valuesRef.current = staged;
    onChange(staged);
    setCompressingCount((c) => c + picked.length);

    const targetBytes = targetBytesPerImage(max);
    const maxSide = maxSideForSlotBudget(max);

    await runWithConcurrency(picked, COMPRESS_CONCURRENCY, async (file, i) => {
      const blobUrl = objectUrls[i];
      try {
        const dataUrl = await fileToUploadDataUrl(file, { targetBytes, maxSide });
        replaceBlob(blobUrl, dataUrl);
      } catch (e) {
        dropBlob(blobUrl);
        setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
      } finally {
        setCompressingCount((c) => Math.max(0, c - 1));
      }
    });
  }

  const defaultHint = busy
    ? "กำลังบีบอัดรูปเพื่อบันทึก…"
    : `เลือกได้หลายไฟล์ · บีบอัดอัตโนมัติก่อนบันทึก (สูงสุด ${max} รูป)`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="flex items-center gap-1 text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-primary">*</span>}
        <span className="ml-1 font-normal text-muted-foreground">({values.length}/{max})</span>
        {busy && (
          <span className="ml-1 inline-flex items-center gap-1 text-xs font-normal text-primary">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            บีบอัด…
          </span>
        )}
      </label>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {values.map((src, i) => {
          const pending = isCompressingPreview(src);
          return (
            <div key={`${i}-${pending ? "pending" : "done"}`} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              <img src={src} alt={`${label} ${i + 1}`} className="h-full w-full object-cover" />
              {pending && (
                <div className="absolute inset-0 flex items-center justify-center bg-card/70 backdrop-blur-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
                </div>
              )}
              {!pending && (
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label={`ลบรูปที่ ${i + 1}`}
                  className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-md bg-card/90 text-danger shadow-sm backdrop-blur transition hover:bg-card"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {!full && (
          <label
            htmlFor={inputId}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void addFiles(e.dataTransfer.files); }}
            className={cn(
              "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-input bg-muted/40 hover:border-primary/50 hover:bg-muted",
              busy && "pointer-events-none opacity-60",
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
        disabled={busy}
        onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }}
      />
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{hint ?? defaultHint}</p>
      )}
    </div>
  );
}
