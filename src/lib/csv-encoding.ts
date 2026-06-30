/** อ่านไฟล์ CSV — รองรับ UTF-8 (รวม BOM) และ CSV ภาษาไทยจาก Excel (Windows-874 / TIS-620) */

const THAI_LEGACY_ENCODINGS = ["windows-874", "iso-8859-11"] as const;

function stripUtf8Bom(bytes: Uint8Array): Uint8Array {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return bytes.subarray(3);
  }
  return bytes;
}

function decode(bytes: Uint8Array, encoding: string): string {
  return new TextDecoder(encoding).decode(bytes);
}

/** คะแนนยิ่งสูง = น่าจะ decode ถูกต้อง (มีไทยมาก, ไม่มีตัวเพี้ยน) */
function scoreDecodedText(text: string): number {
  let thai = 0;
  let penalty = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x0e00 && c <= 0x0e7f) thai++;
    if (c === 0xfffd) penalty += 8;
    if (ch === "Ã" || ch === "Â" || ch === "à") penalty += 2;
  }
  return thai * 12 - penalty;
}

export function decodeCsvBytes(bytes: Uint8Array): string {
  const payload = stripUtf8Bom(bytes);

  // Prefer strict UTF-8: ไฟล์ UTF-8 จริงจะ decode ผ่านแบบ fatal เสมอ
  // ส่วนไฟล์ TIS-620 / Windows-874 มักมี byte ที่ไม่ใช่ UTF-8 ที่ถูกต้อง
  // ทำให้ throw แล้วค่อย fallback ไป legacy encoding ด้านล่าง
  // (ป้องกันการเดา windows-874 ผิดจน UTF-8 ไทยกลายเป็น mojibake "เธ...")
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(payload);
  } catch {
    /* ไม่ใช่ UTF-8 ที่ถูกต้อง — ลอง legacy encoding ของไทย */
  }

  let best = "";
  let bestScore = -Infinity;

  for (const encoding of THAI_LEGACY_ENCODINGS) {
    try {
      const text = decode(payload, encoding);
      const score = scoreDecodedText(text);
      if (score > bestScore) {
        bestScore = score;
        best = text;
      }
    } catch {
      /* encoding not supported */
    }
  }

  return best || decode(payload, "utf-8");
}

export async function readCsvTextFromFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return decodeCsvBytes(bytes);
}
