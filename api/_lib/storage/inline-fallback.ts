import type { SupabaseClient } from "@supabase/supabase-js";
import { isDataUrl } from "./data-url.js";
import type { AttachmentView, ImageSlotInput } from "./attachments.js";

/** Store images inline when Storage bucket / attachments table is not ready yet. */
export async function inlineRunImagesFallback(
  supabase: SupabaseClient,
  runId: string,
  slots: ImageSlotInput[],
): Promise<AttachmentView | null> {
  const inline = slots.map((s) => s.preview).filter(isDataUrl);
  if (inline.length === 0) return null;

  const { error } = await supabase.from("run_entries").update({ strava_images: inline }).eq("id", runId);
  if (error) {
    console.error("inline run images fallback error:", error);
    return null;
  }

  return { urls: inline, refs: [] };
}

export async function inlineWeightImageFallback(
  supabase: SupabaseClient,
  weightId: string,
  slots: ImageSlotInput[],
): Promise<AttachmentView | null> {
  const inline = slots.map((s) => s.preview).filter(isDataUrl);
  if (inline.length === 0) return null;

  const { error } = await supabase.from("weight_entries").update({ proof_image: inline[0] }).eq("id", weightId);
  if (error) {
    console.error("inline weight image fallback error:", error);
    return null;
  }

  return { urls: inline, refs: [] };
}
