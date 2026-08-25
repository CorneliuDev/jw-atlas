"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canCreateContent } from "@/lib/content/permissions";
import { redirect } from "next/navigation";

export async function createNote(formData: FormData) {
  const user = await getCurrentAppUser();
  const permission = canCreateContent(user);

  if (!permission.allowed) {
    redirect(`/notes/new?error=${encodeURIComponent(permission.reason ?? "Not allowed.")}`);
  }

  const placeId = formData.get("placeId") as string;
  const title = formData.get("title") as string;
  const body = formData.get("body") as string;
  const dateDisplay = formData.get("dateDisplay") as string;
  const dateSortStartRaw = formData.get("dateSortStart") as string;
  const approximate = formData.get("approximate") === "on";
  const scriptureReference = formData.get("scriptureReference") as string;

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("notes").insert({
    place_id: placeId || null,
    title,
    body,
    date_display: dateDisplay || null,
    // Signed integer sort value: negative = BC, positive = AD. e.g. "1446 BC"
    // is entered as -1446. We just parse whatever number the user gives;
    // the form label explains the convention.
    date_sort_start: dateSortStartRaw ? parseInt(dateSortStartRaw, 10) : null,
    approximate,
    scripture_reference: scriptureReference || null,
    status: permission.initialStatus,
    created_by: user!.id,
  });

  if (error) {
    redirect(`/notes/new?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/notes/new?success=1&status=${permission.initialStatus}`);
}
