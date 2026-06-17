import type { SupabaseClient } from "@supabase/supabase-js";
import { ATTACHMENTS_BUCKET, MAX_ATTACHMENTS_PER_RUN, SIGNED_URL_TTL } from "./config.js";
import { isDataUrl, parseDataUrl } from "./data-url.js";

export type EntryType = "run" | "weight";

export interface DbAttachmentRow {
  id: string;
  entry_type: EntryType;
  entry_id: string;
  version: number;
  storage_path: string;
  file_hash: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_by: string;
  is_current: boolean;
  uploaded_at: string;
}

export interface AttachmentView {
  urls: string[];
  refs: string[];
}

export interface ImageSlotInput {
  /** data URL for new upload, or signed URL for display (ignored if ref set) */
  preview: string;
  /** storage path from prior save — keeps existing file without re-upload */
  ref?: string;
}

async function signedUrl(supabase: SupabaseClient, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) {
    console.error("signedUrl error:", path, error);
    return null;
  }
  return data.signedUrl;
}

export async function loadAttachmentViews(
  supabase: SupabaseClient,
  entryType: EntryType,
  entryIds: string[],
): Promise<Map<string, AttachmentView>> {
  const map = new Map<string, AttachmentView>();
  if (entryIds.length === 0) return map;

  const { data, error } = await supabase
    .from("attachments")
    .select("*")
    .eq("entry_type", entryType)
    .in("entry_id", entryIds)
    .eq("is_current", true)
    .order("uploaded_at", { ascending: true });

  if (error) {
    console.error("loadAttachmentViews error:", error);
    return map;
  }

  const byEntry = new Map<string, DbAttachmentRow[]>();
  for (const row of (data ?? []) as DbAttachmentRow[]) {
    const list = byEntry.get(row.entry_id) ?? [];
    list.push(row);
    byEntry.set(row.entry_id, list);
  }

  for (const [entryId, rows] of byEntry) {
    const urls: string[] = [];
    const refs: string[] = [];
    for (const row of rows) {
      const url = await signedUrl(supabase, row.storage_path);
      if (url) {
        urls.push(url);
        refs.push(row.storage_path);
      }
    }
    map.set(entryId, { urls, refs });
  }

  return map;
}

async function nextAttachmentVersion(supabase: SupabaseClient, entryType: EntryType, entryId: string): Promise<number> {
  const { data } = await supabase
    .from("attachments")
    .select("version")
    .eq("entry_type", entryType)
    .eq("entry_id", entryId)
    .order("version", { ascending: false })
    .limit(1);

  const max = (data?.[0] as { version: number } | undefined)?.version ?? 0;
  return max + 1;
}

async function nextEntryVersion(supabase: SupabaseClient, entryType: EntryType, entryId: string): Promise<number> {
  const { data } = await supabase
    .from("entry_versions")
    .select("version")
    .eq("entry_type", entryType)
    .eq("entry_id", entryId)
    .order("version", { ascending: false })
    .limit(1);

  const max = (data?.[0] as { version: number } | undefined)?.version ?? 0;
  return max + 1;
}

export async function snapshotEntry(
  supabase: SupabaseClient,
  entryType: EntryType,
  entryId: string,
  snapshot: Record<string, unknown>,
  changedBy: string,
  changeReason?: string,
): Promise<void> {
  const version = await nextEntryVersion(supabase, entryType, entryId);
  const { data: current } = await supabase
    .from("attachments")
    .select("storage_path, file_hash, mime_type, file_size_bytes")
    .eq("entry_type", entryType)
    .eq("entry_id", entryId)
    .eq("is_current", true);

  const { error } = await supabase.from("entry_versions").insert({
    entry_type: entryType,
    entry_id: entryId,
    version,
    snapshot: {
      ...snapshot,
      attachments: current ?? [],
    },
    changed_by: changedBy,
    change_reason: changeReason ?? null,
  });

  if (error) console.error("snapshotEntry error:", error);
}

async function verifyRef(
  supabase: SupabaseClient,
  entryType: EntryType,
  entryId: string,
  storagePath: string,
): Promise<DbAttachmentRow | null> {
  const { data } = await supabase
    .from("attachments")
    .select("*")
    .eq("entry_type", entryType)
    .eq("entry_id", entryId)
    .eq("storage_path", storagePath)
    .eq("is_current", true)
    .maybeSingle();

  return (data as DbAttachmentRow | null) ?? null;
}

async function uploadImage(
  supabase: SupabaseClient,
  entryType: EntryType,
  entryId: string,
  version: number,
  index: number,
  uploadedBy: string,
  dataUrl: string,
): Promise<DbAttachmentRow | null> {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;

  const storagePath = `${entryType}/${entryId}/v${version}_${index}.${parsed.ext}`;

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, parsed.buffer, {
      contentType: parsed.mimeType,
      upsert: true,
    });

  if (uploadError) {
    console.error("storage upload error:", uploadError);
    return null;
  }

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      entry_type: entryType,
      entry_id: entryId,
      version,
      storage_path: storagePath,
      file_hash: parsed.hash,
      mime_type: parsed.mimeType,
      file_size_bytes: parsed.buffer.length,
      uploaded_by: uploadedBy,
      is_current: true,
    })
    .select("*")
    .single();

  if (error) {
    console.error("attachment insert error:", error);
    return null;
  }

  return data as DbAttachmentRow;
}

/**
 * Replace current attachments for an entry with the given slots.
 * - `ref` keeps an existing storage object
 * - `preview` as data URL uploads a new file
 */
export async function syncEntryAttachments(
  supabase: SupabaseClient,
  entryType: EntryType,
  entryId: string,
  uploadedBy: string,
  slots: ImageSlotInput[],
  options?: { max?: number },
): Promise<AttachmentView | { error: string }> {
  const max = options?.max ?? (entryType === "run" ? MAX_ATTACHMENTS_PER_RUN : 1);
  if (slots.length === 0) return { error: "ต้องแนบภาพอย่างน้อย 1 รูป" };
  if (slots.length > max) return { error: `แนบได้สูงสุด ${max} รูป` };

  const version = await nextAttachmentVersion(supabase, entryType, entryId);
  const keptPaths: string[] = [];
  const newRows: DbAttachmentRow[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.ref) {
      const existing = await verifyRef(supabase, entryType, entryId, slot.ref);
      if (!existing) return { error: "ไม่พบไฟล์แนบเดิม กรุณาเลือกรูปใหม่" };
      keptPaths.push(slot.ref);
      newRows.push(existing);
      continue;
    }
    if (!isDataUrl(slot.preview)) {
      return { error: "รูปภาพไม่ถูกต้อง กรุณาเลือกไฟล์ใหม่" };
    }
    const uploaded = await uploadImage(supabase, entryType, entryId, version, i, uploadedBy, slot.preview);
    if (!uploaded) return { error: "อัปโหลดรูปไม่สำเร็จ" };
    keptPaths.push(uploaded.storage_path);
    newRows.push(uploaded);
  }

  const { data: stale } = await supabase
    .from("attachments")
    .select("id, storage_path")
    .eq("entry_type", entryType)
    .eq("entry_id", entryId)
    .eq("is_current", true);

  const keptSet = new Set(keptPaths);
  const toRetire = ((stale ?? []) as { id: string; storage_path: string }[]).filter((r) => !keptSet.has(r.storage_path));

  if (toRetire.length > 0) {
    await supabase
      .from("attachments")
      .update({ is_current: false })
      .in(
        "id",
        toRetire.map((r) => r.id),
      );
  }

  const urls: string[] = [];
  const refs: string[] = [];
  for (const row of newRows) {
    const url = await signedUrl(supabase, row.storage_path);
    if (url) {
      urls.push(url);
      refs.push(row.storage_path);
    }
  }

  if (urls.length === 0) return { error: "ไม่สามารถสร้างลิงก์รูปภาพได้" };

  return { urls, refs };
}

/** Migrate legacy inline base64 columns into Storage (best-effort). */
export async function migrateLegacyRunImages(
  supabase: SupabaseClient,
  entryId: string,
  uploadedBy: string,
  inlineImages: string[] | null,
): Promise<AttachmentView | null> {
  if (!inlineImages?.length) return null;

  const { count } = await supabase
    .from("attachments")
    .select("*", { count: "exact", head: true })
    .eq("entry_type", "run")
    .eq("entry_id", entryId)
    .eq("is_current", true);

  if ((count ?? 0) > 0) return null;

  const slots = inlineImages.filter(isDataUrl).map((preview) => ({ preview }));
  if (slots.length === 0) return null;

  const result = await syncEntryAttachments(supabase, "run", entryId, uploadedBy, slots);
  if ("error" in result) return null;

  await supabase.from("run_entries").update({ strava_images: [] }).eq("id", entryId);
  return result;
}

export async function migrateLegacyWeightImage(
  supabase: SupabaseClient,
  entryId: string,
  uploadedBy: string,
  inlineImage: string | null,
): Promise<AttachmentView | null> {
  if (!inlineImage || !isDataUrl(inlineImage)) return null;

  const { count } = await supabase
    .from("attachments")
    .select("*", { count: "exact", head: true })
    .eq("entry_type", "weight")
    .eq("entry_id", entryId)
    .eq("is_current", true);

  if ((count ?? 0) > 0) return null;

  const result = await syncEntryAttachments(supabase, "weight", entryId, uploadedBy, [{ preview: inlineImage }], {
    max: 1,
  });
  if ("error" in result) return null;

  await supabase.from("weight_entries").update({ proof_image: null }).eq("id", entryId);
  return result;
}

export function buildImageSlots(
  previews: string[],
  refs?: string[],
): ImageSlotInput[] {
  return previews.map((preview, i) => ({
    preview,
    ref: refs?.[i],
  }));
}
