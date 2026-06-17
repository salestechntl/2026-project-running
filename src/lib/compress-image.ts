/** Target base64 payload size — keeps JSON body under Vercel's ~4.5 MB limit (with form fields + multiple images). */
const TARGET_BYTES = 900_000;
const MAX_INPUT_BYTES = 6 * 1024 * 1024;

const ALLOWED_INPUT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function isAllowedImageType(type: string): boolean {
  return ALLOWED_INPUT_TYPES.has(type.toLowerCase());
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

/**
 * Read an image file and return a JPEG/PNG data URL small enough for API upload.
 */
export async function fileToUploadDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WebP)");
  }
  if (!isAllowedImageType(file.type)) {
    throw new Error("รองรับเฉพาะ JPG, PNG, WebP, GIF — หากเป็นรูปจาก iPhone (HEIC) ให้แปลงเป็น JPG ก่อน");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("ไฟล์ใหญ่เกินไป (สูงสุด 6 MB)");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("ไม่สามารถประมวลผลรูปได้");
    ctx.drawImage(img, 0, 0, w, h);

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    let quality = outputType === "image/png" ? undefined : 0.85;
    let blob = await canvasToBlob(canvas, outputType, quality ?? 1);

    if (!blob) throw new Error("บีบอัดรูปไม่สำเร็จ");

    if (outputType === "image/jpeg") {
      while (blob.size > TARGET_BYTES && (quality ?? 0.85) > 0.45) {
        quality = (quality ?? 0.85) - 0.1;
        blob = (await canvasToBlob(canvas, outputType, quality)) ?? blob;
      }
    }

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
      reader.readAsDataURL(blob!);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
