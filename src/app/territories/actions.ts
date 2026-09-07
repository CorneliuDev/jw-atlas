// src/app/territories/actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canCreateContent } from "@/lib/content/permissions";

export async function createTerritory(formData: FormData) {
  const user = await getCurrentAppUser();
  const permission = canCreateContent(user);

  if (!permission.allowed) {
    return { error: permission.reason ?? "Not allowed." };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const scriptureReference = formData.get("scriptureReference") as string;
  const dateSortStart = parseInt(formData.get("dateSortStart") as string, 10);
  const dateSortEndRaw = formData.get("dateSortEnd") as string;
  const geometryJson = formData.get("geometry") as string;
  const publish = formData.get("publish") === "on";
  const personIds = formData.getAll("personIds") as string[];

  if (!name || isNaN(dateSortStart) || !geometryJson) {
    return { error: "Missing required fields." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: territory, error } = await supabase
    .from("territories")
    .insert({
      name,
      description: description || null,
      scripture_reference: scriptureReference || null,
      date_sort_start: dateSortStart,
      date_sort_end: dateSortEndRaw ? parseInt(dateSortEndRaw, 10) : null,
      status: permission.initialStatus,
      visibility: publish ? "public" : "private",
      created_by: user!.id,
      geometry: JSON.parse(geometryJson),
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (personIds.length > 0) {
    await supabase.from("person_territories").insert(
      personIds.map((personId) => ({ person_id: personId, territory_id: territory.id }))
    );
  }

  return { success: true, status: permission.initialStatus, published: publish };
}