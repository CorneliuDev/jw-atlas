// src/app/places/panel-actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canCreateContent } from "@/lib/content/permissions";

export async function createPlacePanel(formData: FormData) {
  const user = await getCurrentAppUser();
  const permission = canCreateContent(user);

  if (!permission.allowed) {
    return { error: permission.reason ?? "Not allowed." };
  }

  const name = formData.get("name") as string;
  const latitude = parseFloat(formData.get("latitude") as string);
  const longitude = parseFloat(formData.get("longitude") as string);
  const description = formData.get("description") as string;
  const sourceReference = formData.get("sourceReference") as string;
  const sourceUrl = formData.get("sourceUrl") as string;
  const scriptureReference = formData.get("scriptureReference") as string;
  const tribeId = formData.get("tribeId") as string;
  // Checkbox: checked = "Publish (submit for public review)". Unchecked
  // (default) = private, never enters moderation, only visible to creator.
  const publish = formData.get("publish") === "on";

  const supabase = await createSupabaseServerClient();

  const { data: place, error } = await supabase
    .from("places")
    .insert({
      name,
      latitude,
      longitude,
      description: description || null,
      source_reference: sourceReference || null,
      source_url: sourceUrl || null,
      scripture_reference: scriptureReference || null,
      // Status is still recalculated server-side by our existing
      // enforce_content_status trigger regardless of what we send — this
      // just sets the intent; visibility is the new, separate axis.
      status: permission.initialStatus,
      visibility: publish ? "public" : "private",
      created_by: user!.id,
    })
    .select("id")
    .single();

  if (error || !place) {
    return { error: error?.message ?? "Failed to create place." };
  }

  if (tribeId) {
    await supabase.from("tribe_places").insert({ tribe_id: tribeId, place_id: place.id });
  }

  return { success: true, placeId: place.id, status: permission.initialStatus, published: publish };
}