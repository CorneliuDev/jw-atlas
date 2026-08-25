// src/app/admin/moderation/actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canModerateContent } from "@/lib/content/permissions";
import { revalidatePath } from "next/cache";

type ContentType = "places" | "notes";

export async function approveContent(contentType: ContentType, id: string) {
  const user = await getCurrentAppUser();
  if (!canModerateContent(user)) {
    throw new Error("Not authorized to moderate content.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from(contentType)
    .update({ status: "approved" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  // TODO (Step 9 follow-up / Phase 3 notifications): insert a row into
  // `notifications` here so the submitter is told their content was
  // approved, per spec §6.1 step 4. Deferred since `notifications` table
  // doesn't exist yet (Phase 3 per spec §10) — flagging so it's not lost.
  revalidatePath("/admin/moderation");
}

export async function rejectContent(contentType: ContentType, id: string, reason: string) {
  const user = await getCurrentAppUser();
  if (!canModerateContent(user)) {
    throw new Error("Not authorized to moderate content.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from(contentType)
    .update({ status: "rejected" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  // Same TODO as above — reason param is accepted now so the UI/API shape
  // is ready, but isn't persisted anywhere until notifications exist.
  revalidatePath("/admin/moderation");
}