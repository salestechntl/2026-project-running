import { createHash } from "node:crypto";
import { MAX_ATTACHMENT_BYTES } from "./config.js";

export interface ParsedDataUrl {
  mimeType: string;
  buffer: Buffer;
  hash: string;
  ext: string;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function parseDataUrl(dataUrl: string): ParsedDataUrl | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;

  const mimeType = match[1].toLowerCase();
  if (!EXT_BY_MIME[mimeType]) return null;

  let buffer: Buffer;
  try {
    buffer = Buffer.from(match[2], "base64");
  } catch {
    return null;
  }

  if (buffer.length === 0 || buffer.length > MAX_ATTACHMENT_BYTES) return null;

  const hash = createHash("sha256").update(buffer).digest("hex");
  return { mimeType, buffer, hash, ext: EXT_BY_MIME[mimeType] };
}

export function isDataUrl(value: string): boolean {
  return value.startsWith("data:image/");
}
