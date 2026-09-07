// src/app/territories/edit-panel-actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canModifyContent, canCreateContent } from "@/lib/content/permissions";

export async function updateTerritoryPanel(territoryId: string, formData: FormData) {
  const user = await getCurrentAppUser();
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase.from("territories").select("*").eq("id", territoryId).single();
  if (!existing) return { error: "Territory not found." };
  if (!canModifyContent(user, existing.created_by)) return { error: "Not authorized." };

  const permission = canCreateContent(user);
  const publish = formData.get("publish") === "on";

  const updated = {
    name: (formData.get("name") as string) || existing.name,
    description: (formData.get("description") as string) || null,
    scripture_reference: ((formData.get("scriptureReference") as string) || "") || null,
    date_sort_start: parseInt(formData.get("dateSortStart") as string, 10),
    date_sort_end: formData.get("dateSortEnd") ? parseInt(formData.get("dateSortEnd") as string, 10) : null,
    status: permission.initialStatus,
    visibility: publish ? "public" : "private",
  };

  const { error } = await supabase.from("territories").update(updated).eq("id", territoryId);
  if (error) return { error: error.message };

  await supabase.from("content_versions").insert({
    content_type: "territories",
    content_id: territoryId,
    edited_by: user!.id,
    diff_snapshot: { before: existing, after: updated },
  });

  const personIds = formData.getAll("personIds") as string[];
  await supabase.from("person_territories").delete().eq("territory_id", territoryId);
  if (personIds.length > 0) {
    await supabase.from("person_territories").insert(
      personIds.map((personId) => ({ person_id: personId, territory_id: territoryId }))
    );
  }

  return { success: true, status: permission.initialStatus, published: publish };
}
