// src/app/people/actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canCreateContent } from "@/lib/content/permissions";
import { redirect } from "next/navigation";

export async function createPerson(formData: FormData) {
  const user = await getCurrentAppUser();
  const permission = canCreateContent(user);

  if (!permission.allowed) {
    redirect(`/people/new?error=${encodeURIComponent(permission.reason ?? "Not allowed.")}`);
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const birthDateSortRaw = formData.get("birthDateSort") as string;
  const deathDateSortRaw = formData.get("deathDateSort") as string;
  const tribeId = formData.get("tribeId") as string;
  const scriptureReference = formData.get("scriptureReference") as string;
  const placeIds = formData.getAll("placeIds") as string[];

  const supabase = await createSupabaseServerClient();

  const { data: person, error } = await supabase
    .from("people")
    .insert({
      name,
      description: description || null,
      birth_date_sort: birthDateSortRaw ? parseInt(birthDateSortRaw, 10) : null,
      death_date_sort: deathDateSortRaw ? parseInt(deathDateSortRaw, 10) : null,
      tribe_id: tribeId || null,
      scripture_reference: scriptureReference || null,
      status: permission.initialStatus,
      created_by: user!.id,
    })
    .select("id")
    .single();

  if (error || !person) {
    redirect(`/people/new?error=${encodeURIComponent(error?.message ?? "Failed to create person.")}`);
  }

  if (placeIds.length > 0) {
    await supabase.from("person_places").insert(
      placeIds.map((placeId) => ({ person_id: person.id, place_id: placeId }))
    );
  }

  redirect(`/people/new?success=1&status=${permission.initialStatus}`);
}