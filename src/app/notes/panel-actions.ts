// src/app/notes/panel-actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canCreateContent } from "@/lib/content/permissions";

export async function createNotePanel(formData: FormData) {
  const user = await getCurrentAppUser();
  const permission = canCreateContent(user);
  if (!permission.allowed) return { error: permission.reason ?? "Not allowed." };

  const placeId = formData.get("placeId") as string;
  const title = formData.get("title") as string;
  const body = formData.get("body") as string;
  const dateDisplay = formData.get("dateDisplay") as string;
  const dateSortStartRaw = formData.get("dateSortStart") as string;
  const approximate = formData.get("approximate") === "on";
  const scriptureReference = formData.get("scriptureReference") as string;
  const publish = formData.get("publish") === "on";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("notes").insert({
    place_id: placeId || null,
    title,
    body,
    date_display: dateDisplay || null,
    date_sort_start: dateSortStartRaw ? parseInt(dateSortStartRaw, 10) : null,
    approximate,
    scripture_reference: scriptureReference || null,
    status: permission.initialStatus,
    visibility: publish ? "public" : "private",
    created_by: user!.id,
  });

  if (error) return { error: error.message };
  return { success: true, status: permission.initialStatus, published: publish };
}