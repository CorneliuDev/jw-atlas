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
  const dateSortStart = parseInt(formData.get("dateSortStart") as string, 10);
  const dateSortEndRaw = formData.get("dateSortEnd") as string;
  const geometryJson = formData.get("geometry") as string;

  if (!name || isNaN(dateSortStart) || !geometryJson) {
    return { error: "Missing required fields." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("insert_territory_from_geojson", {
    p_name: name,
    p_description: description || null,
    p_date_sort_start: dateSortStart,
    p_date_sort_end: dateSortEndRaw ? parseInt(dateSortEndRaw, 10) : null,
    p_geometry_geojson: geometryJson,
    p_status: permission.initialStatus,
    p_created_by: user!.id,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, status: permission.initialStatus };
}