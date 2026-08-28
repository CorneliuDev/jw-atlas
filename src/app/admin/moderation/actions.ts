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
  const { data: content } = await supabase
  .from(contentType)
  .select("*")
  .eq("id", id)
  .single();

  const { error } = await supabase
    .from(contentType)
    .update({ status: "approved" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  if (content) {
    const label = content.name ?? content.title ?? "your submission";
    await supabase.from("notifications").insert({
      user_id: content.created_by,
      type: "submission_approved",
      message: `"${label}" was approved and is now live.`,
    });
  }

  revalidatePath("/admin/moderation");
}

export async function rejectContent(contentType: ContentType, id: string, reason: string) {
  const user = await getCurrentAppUser();
  if (!canModerateContent(user)) {
    throw new Error("Not authorized to moderate content.");
  }

  const supabase = await createSupabaseServerClient();
  const { data: content } = await supabase
  .from(contentType)
  .select("*")
  .eq("id", id)
  .single();

  const { error } = await supabase
    .from(contentType)
    .update({ status: "rejected" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  if (content) {
    const label = content.name ?? content.title ?? "your submission";
    await supabase.from("notifications").insert({
      user_id: content.created_by,
      type: "submission_rejected",
      message: `"${label}" was rejected.`,
      reason: reason || null,
    });
  }

  revalidatePath("/admin/moderation");
}