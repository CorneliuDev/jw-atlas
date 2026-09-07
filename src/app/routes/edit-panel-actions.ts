// src/app/routes/edit-panel-actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canModifyContent, canCreateContent } from "@/lib/content/permissions";

export async function updateRoutePanel(routeId: string, formData: FormData) {
  const user = await getCurrentAppUser();
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase.from("routes").select("*").eq("id", routeId).single();
  if (!existing) return { error: "Route not found." };
  if (!canModifyContent(user, existing.created_by)) return { error: "Not authorized." };

  const permission = canCreateContent(user);
  const publish = formData.get("publish") === "on";

  const updated = {
    name: (formData.get("name") as string) || existing.name,
    description: (formData.get("description") as string) || null,
    scripture_reference: ((formData.get("scriptureReference") as string) || "") || null,
    date_sort_start: formData.get("dateSortStart") ? parseInt(formData.get("dateSortStart") as string, 10) : null,
    date_sort_end: formData.get("dateSortEnd") ? parseInt(formData.get("dateSortEnd") as string, 10) : null,
    status: permission.initialStatus,
    visibility: publish ? "public" : "private",
  };

  const { error } = await supabase.from("routes").update(updated).eq("id", routeId);
  if (error) return { error: error.message };

  await supabase.from("content_versions").insert({
    content_type: "routes",
    content_id: routeId,
    edited_by: user!.id,
    diff_snapshot: { before: existing, after: updated },
  });

  const personIds = formData.getAll("personIds") as string[];
  await supabase.from("person_routes").delete().eq("route_id", routeId);
  if (personIds.length > 0) {
    await supabase.from("person_routes").insert(
      personIds.map((personId) => ({ person_id: personId, route_id: routeId }))
    );
  }

  return { success: true, status: permission.initialStatus, published: publish };
}
