"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canCreateContent } from "@/lib/content/permissions";
import { redirect } from "next/navigation";

export async function createPlace(formData: FormData) {
  const user = await getCurrentAppUser();
  const permission = canCreateContent(user);

  if (!permission.allowed) {
    redirect(`/places/new?error=${encodeURIComponent(permission.reason ?? "Not allowed.")}`);
  }

  const name = formData.get("name") as string;
  const latitude = parseFloat(formData.get("latitude") as string);
  const longitude = parseFloat(formData.get("longitude") as string);
  const description = formData.get("description") as string;
  const sourceReference = formData.get("sourceReference") as string;
  const sourceUrl = formData.get("sourceUrl") as string;

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("places").insert({
    name,
    latitude,
    longitude,
    description,
    source_reference: sourceReference || null,
    source_url: sourceUrl || null,
    status: permission.initialStatus,
    created_by: user!.id,
  });

  if (error) {
    redirect(`/places/new?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/places/new?success=1&status=${permission.initialStatus}`);
}
