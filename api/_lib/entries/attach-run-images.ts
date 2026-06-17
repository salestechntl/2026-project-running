import type { SupabaseClient } from "@supabase/supabase-js";
import {
  syncEntryAttachments,
  type AttachmentView,
  type ImageSlotInput,
} from "../storage/attachments.js";
import { inlineRunImagesFallback } from "../storage/inline-fallback.js";

export async function attachRunImages(
  supabase: SupabaseClient,
  runId: string,
  uploadedBy: string,
  imageSlots: ImageSlotInput[],
): Promise<AttachmentView | { error: string }> {
  const attached = await syncEntryAttachments(supabase, "run", runId, uploadedBy, imageSlots);
  if (!("error" in attached)) return attached;

  const inline = await inlineRunImagesFallback(supabase, runId, imageSlots);
  if (inline) return inline;

  return attached;
}
