// src/app/admin/users/actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canModerateContent } from "@/lib/content/permissions";
import { revalidatePath } from "next/cache";

type Role = "user" | "contributor" | "admin";

export async function changeUserRole(targetUserId: string, newRole: Role) {
  const admin = await getCurrentAppUser();
  if (!canModerateContent(admin)) {
    throw new Error("Not authorized.");
  }

  const supabase = await createSupabaseServerClient();

  const { data: target, error: fetchError } = await supabase
    .from("users")
    .select("role")
    .eq("id", targetUserId)
    .single();

  if (fetchError || !target) throw new Error("User not found.");

  const { error: updateError } = await supabase
    .from("users")
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (updateError) throw new Error(updateError.message);

  // Per spec §6.3: log who promoted whom, when.
  await supabase.from("role_change_log").insert({
    target_user_id: targetUserId,
    changed_by: admin!.id,
    old_role: target.role,
    new_role: newRole,
  });

  revalidatePath("/admin/users");
}