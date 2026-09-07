// src/app/people/panel-actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canCreateContent } from "@/lib/content/permissions";

export async function createPersonPanel(formData: FormData) {
  const user = await getCurrentAppUser();
  const permission = canCreateContent(user);
  if (!permission.allowed) return { error: permission.reason ?? "Not allowed." };

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const birthDateSortRaw = formData.get("birthDateSort") as string;
  const deathDateSortRaw = formData.get("deathDateSort") as string;
  const tribeId = formData.get("tribeId") as string;
  const scriptureReference = formData.get("scriptureReference") as string;
  const publish = formData.get("publish") === "on";
  const placeIds = formData.getAll("placeIds") as string[];
  const territoryIds = formData.getAll("territoryIds") as string[];
  const routeIds = formData.getAll("routeIds") as string[];

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
      visibility: publish ? "public" : "private",
      created_by: user!.id,
    })
    .select("id")
    .single();

  if (error || !person) return { error: error?.message ?? "Failed to create person." };

  if (placeIds.length > 0) {
    await supabase.from("person_places").insert(placeIds.map((placeId) => ({ person_id: person.id, place_id: placeId })));
  }
  if (territoryIds.length > 0) {
    await supabase
      .from("person_territories")
      .insert(territoryIds.map((territoryId) => ({ person_id: person.id, territory_id: territoryId })));
  }
  if (routeIds.length > 0) {
    await supabase.from("person_routes").insert(routeIds.map((routeId) => ({ person_id: person.id, route_id: routeId })));
  }

  return { success: true, status: permission.initialStatus, published: publish };
}