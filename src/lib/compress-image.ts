/** JSON body budget for Vercel serverless (~4.5 MB hard limit; leave room for fields). */
const VERCEL_JSON_BUDGET = 3_500_000;
const BASE64_OVERHEAD = 4 / 3;
const STORAGE_MAX_BYTES = 6 * 1024 * 1024;
const ABSOLUTE_TARGET_CAP = 900_000;

/** Accept large camera originals — compression happens client-side. */
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;

const ALLOWED_INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

let webpEncodeSupported: boolean | undefined;

export function isAllowedImageType(type: string): boolean {
  return ALLOWED_INPUT_TYPES.has(type.toLowerCase());
}

/** Per-image binary target from slot budget (e.g. max=5 for runs, max=2 for weight). */
export function targetBytesPerImage(slotBudget: number): number {
  const slots = Math.max(1, slotBudget);
  const perImage = Math.floor(VERCEL_JSON_BUDGET / slots / BASE64_OVERHEAD);
  return Math.min(perImage, ABSOLUTE_TARGET_CAP, STORAGE_MAX_BYTES - 1);
}

export function maxSideForSlotBudget(slotBudget: number): number {
  return slotBudget <= 2 ? 1600 : 1280;
}

export interface CompressImageOptions {
  targetBytes?: number;
  maxSide?: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function supportsWebpEncode(): boolean {
  if (webpEncodeSupported !== undefined) return webpEncodeSupported;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    webpEncodeSupported = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  } catch {
    webpEncodeSupported = false;
  }
  return webpEncodeSupported;
}

function canvasHasAlpha(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  const { data } = ctx.getImageData(0, 0, w, h);
  for (let i = 3; i < data.length; i += 16) {
    if (data[i] < 255) return true;
  }
  return false;
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  sourceType: string,
  targetBytes: number,
): Promise<Blob> {
  const useWebp = supportsWebpEncode() && sourceType !== "image/gif";
  const lossyType = useWebp ? "image/webp" : "image/jpeg";
  const keepPng = sourceType === "image/png" && canvasHasAlpha(ctx, canvas.width, canvas.height);

  let w = canvas.width;
  let h = canvas.height;
  let quality = 0.85;

  for (let attempt = 0; attempt < 12; attempt++) {
    if (w !== canvas.width || h !== canvas.height) {
      const resized = document.createElement("canvas");
      resized.width = w;
      resized.height = h;
      const rctx = resized.getContext("2d");
      if (!rctx) throw new Error("ไม่สามารถประมวลผลรูปได้");
      rctx.drawImage(canvas, 0, 0, w, h);
      canvas = resized;
      ctx = rctx;
    }

    const outputType = keepPng ? "image/png" : lossyType;
    let blob = await canvasToBlob(canvas, outputType, keepPng ? 1 : quality);
    if (!blob) throw new Error("บีบอัดรูปไม่สำเร็จ");
    if (blob.size <= targetBytes) return blob;

    if (!keepPng && quality > 0.4) {
      quality -= 0.1;
      continue;
    }
    if (w > 640 || h > 640) {
      w = Math.max(1, Math.round(w * 0.85));
      h = Math.max(1, Math.round(h * 0.85));
      quality = 0.82;
      continue;
    }

    return blob;
  }

  const fallback = await canvasToBlob(canvas, lossyType, 0.4);
  if (!fallback) throw new Error("บีบอัดรูปไม่สำเร็จ");
  return fallback;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Read an image file and return a compressed data URL for API upload.
 * Large originals are resized; output stays within Vercel/Supabase limits.
 */
export async function fileToUploadDataUrl(file: File, options?: CompressImageOptions): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WebP)");
  }
  if (!isAllowedImageType(file.type)) {
    throw new Error("รองรับเฉพาะ JPG, PNG, WebP, GIF — หากเป็นรูปจาก iPhone (HEIC) ให้แปลงเป็น JPG ก่อน");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("ไฟล์ใหญ่เกินไป (สูงสุด 20 MB)");
  }

  const targetBytes = options?.targetBytes ?? targetBytesPerImage(1);
  const maxSide = options?.maxSide ?? maxSideForSlotBudget(1);

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("ไม่สามารถประมวลผลรูปได้");
    ctx.drawImage(img, 0, 0, w, h);

    const blob = await encodeCanvas(canvas, ctx, file.type, targetBytes);
    return await blobToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** True while a blob preview is waiting for compression. */
export function isCompressingPreview(src: string): boolean {
  return src.startsWith("blob:");
}
