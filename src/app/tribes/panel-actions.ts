// src/app/tribes/panel-actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canCreateContent } from "@/lib/content/permissions";

export async function createTribePanel(formData: FormData) {
  const user = await getCurrentAppUser();
  const permission = canCreateContent(user);
  if (!permission.allowed) return { error: permission.reason ?? "Not allowed." };

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const publish = formData.get("publish") === "on";

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tribes").insert({
    name,
    description: description || null,
    status: permission.initialStatus,
    visibility: publish ? "public" : "private",
    created_by: user!.id,
  });

  if (error) return { error: error.message };
  return { success: true, status: permission.initialStatus, published: publish };
}