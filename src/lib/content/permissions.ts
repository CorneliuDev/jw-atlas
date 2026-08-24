import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserRole = "user" | "contributor" | "admin";
export type UserStatus = "active" | "silenced" | "banned";

export interface AppUser {
  id: string;
  role: UserRole;
  status: UserStatus;
}

// Fetches the currently logged-in user's app-level profile (role/status),
// not just their auth session. Every content-creation code path should call
// this rather than trusting auth alone, since role/status live in
// public.users, not in Supabase Auth itself.
export async function getCurrentAppUser(): Promise<AppUser | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, role, status")
    .eq("id", authUser.id)
    .single();

  if (error || !data) return null;

  return data as AppUser;
}

// Central permission check per spec §9.2: "one function that all content
// types call." Returns whether the user can create content at all, and if
// so, what status the new content should get (pending vs approved) —
// per spec §2 and §6.1/§6.2.
export function canCreateContent(user: AppUser | null): {
  allowed: boolean;
  initialStatus: "pending" | "approved";
  reason?: string;
} {
  if (!user) {
    return { allowed: false, initialStatus: "pending", reason: "Not logged in." };
  }

  if (user.status === "banned") {
    return { allowed: false, initialStatus: "pending", reason: "Account is banned." };
  }

  if (user.status === "silenced") {
    return { allowed: false, initialStatus: "pending", reason: "Account is silenced." };
  }

  if (user.role === "contributor" || user.role === "admin") {
    return { allowed: true, initialStatus: "approved" };
  }

  // role === "user"
  return { allowed: true, initialStatus: "pending" };
}

// Per spec §2: only admins can edit/delete any user's content; a regular
// user can only edit their own (not yet needed until Step 5's edit flow,
// but defined here now so it lives in the same shared module).
export function canModifyContent(
  user: AppUser | null,
  contentCreatedBy: string
): boolean {
  if (!user) return false;
  if (user.status === "banned") return false;
  if (user.role === "admin") return true;
  return user.id === contentCreatedBy;
}

// Per spec §2: only admins can approve/reject pending submissions.
export function canModerateContent(user: AppUser | null): boolean {
  if (!user) return false;
  return user.role === "admin";
}
