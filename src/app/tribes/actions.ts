// src/app/tribes/actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canCreateContent } from "@/lib/content/permissions";
import { redirect } from "next/navigation";

export async function createTribe(formData: FormData) {
  const user = await getCurrentAppUser();
  const permission = canCreateContent(user);

  if (!permission.allowed) {
    redirect(`/tribes/new?error=${encodeURIComponent(permission.reason ?? "Not allowed.")}`);
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tribes").insert({
    name,
    description: description || null,
    status: permission.initialStatus,
    created_by: user!.id,
  });

  if (error) {
    redirect(`/tribes/new?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/tribes/new?success=1&status=${permission.initialStatus}`);
}