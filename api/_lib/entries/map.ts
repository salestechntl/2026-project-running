import type { EntryStatus } from "./status.js";

export type { EntryStatus };
export type RunType = "discipline" | "mission";
export type WeightPeriod = "start" | "end";

export interface DbRunRow {
  id: string;
  employee_id: string;
  run_date: string;
  run_type: RunType;
  distance_km: number;
  duration_sec: number;
  mission_month: string;
  note: string | null;
  status: EntryStatus;
  reject_note: string | null;
  staff_edit_note: string | null;
  strava_images: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface DbWeightRow {
  id: string;
  employee_id: string;
  month: string;
  period: WeightPeriod;
  weight_kg: number;
  status: EntryStatus;
  reject_note: string | null;
  staff_edit_note: string | null;
  proof_image: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunEntryDto {
  id: string;
  employeeId: string;
  date: string;
  runType: RunType;
  distanceKm: number;
  durationSec: number;
  missionTag: string;
  stravaImages?: string[];
  /** storage paths — send back on edit to avoid re-upload (API mode) */
  stravaImageRefs?: string[];
  note?: string;
  status: EntryStatus;
  rejectNote?: string;
  staffEditNote?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WeightEntryDto {
  id: string;
  employeeId: string;
  month: string;
  period: WeightPeriod;
  weightKg: number;
  proofImage?: string;
  proofImageRef?: string;
  status: EntryStatus;
  rejectNote?: string;
  staffEditNote?: string;
  createdAt: number;
  updatedAt: number;
}

function ts(iso: string): number {
  return Date.parse(iso);
}

export function mapRun(row: DbRunRow, images?: { urls: string[]; refs: string[] }): RunEntryDto {
  const inline = Array.isArray(row.strava_images) ? row.strava_images : [];
  const urls = images?.urls.length ? images.urls : inline.length > 0 ? inline : undefined;
  const refs = images?.refs.length ? images.refs : undefined;
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.run_date,
    runType: row.run_type,
    distanceKm: Number(row.distance_km),
    durationSec: row.duration_sec,
    missionTag: row.mission_month,
    stravaImages: urls,
    stravaImageRefs: refs,
    note: row.note ?? undefined,
    status: row.status,
    rejectNote: row.reject_note ?? undefined,
    staffEditNote: row.staff_edit_note ?? undefined,
    createdAt: ts(row.created_at),
    updatedAt: ts(row.updated_at),
  };
}

export function mapWeight(row: DbWeightRow, image?: { url: string; ref: string }): WeightEntryDto {
  const proofImage = image?.url ?? row.proof_image ?? undefined;
  return {
    id: row.id,
    employeeId: row.employee_id,
    month: row.month,
    period: row.period,
    weightKg: Number(row.weight_kg),
    proofImage: proofImage ?? undefined,
    proofImageRef: image?.ref,
    status: row.status,
    rejectNote: row.reject_note ?? undefined,
    staffEditNote: row.staff_edit_note ?? undefined,
    createdAt: ts(row.created_at),
    updatedAt: ts(row.updated_at),
  };
}

export interface ImageSlotInput {
  preview: string;
  ref?: string;
}

export function validateImageSlots(previews: unknown, refs?: unknown): ImageSlotInput[] | null {
  if (!Array.isArray(previews) || previews.length === 0) return null;
  if (previews.length > 5) return null;
  const refList = Array.isArray(refs) ? refs : [];
  const slots: ImageSlotInput[] = [];

  for (let i = 0; i < previews.length; i++) {
    const preview = previews[i];
    if (typeof preview !== "string") return null;
    const ref = typeof refList[i] === "string" && refList[i] ? refList[i] : undefined;
    if (ref) {
      slots.push({ preview, ref });
    } else if (preview.startsWith("data:image/")) {
      slots.push({ preview });
    } else {
      return null;
    }
  }

  return slots;
}

export function validateProofSlot(
  preview: unknown,
  ref?: unknown,
): ImageSlotInput | null | undefined {
  if (preview == null || preview === "") return undefined;
  if (typeof preview !== "string") return null;
  if (typeof ref === "string" && ref) return { preview, ref };
  if (preview.startsWith("data:image/")) return { preview };
  return null;
}

/** @deprecated inline-only validation — local demo mode */
export function validateImages(images: unknown): string[] | null {
  if (images == null) return [];
  if (!Array.isArray(images)) return null;
  if (images.length > 5) return null;
  let total = 0;
  for (const img of images) {
    if (typeof img !== "string" || !img.startsWith("data:image/")) return null;
    total += img.length;
    if (total > MAX_IMAGE_BYTES) return null;
  }
  return images;
}

const MAX_IMAGE_BYTES = 1_500_000;

export function validateProofImage(image: unknown): string | null | undefined {
  if (image == null || image === "") return undefined;
  if (typeof image !== "string" || !image.startsWith("data:image/")) return null;
  if (image.length > MAX_IMAGE_BYTES) return null;
  return image;
}
