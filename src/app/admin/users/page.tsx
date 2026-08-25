// src/app/admin/users/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canModerateContent } from "@/lib/content/permissions";
import { redirect } from "next/navigation";
import { changeUserRole } from "./actions";

export default async function UserManagementPage() {
  const admin = await getCurrentAppUser();
  if (!canModerateContent(admin)) redirect("/");

  const supabase = await createSupabaseServerClient();
  const { data: users } = await supabase
    .from("users")
    .select("id, email, display_name, role, status")
    .order("created_at", { ascending: false });

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 700 }}>
      <h1>User management</h1>
      <p><a href="/admin/moderation">Moderation queue</a> · <a href="/">Back to map</a></p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: "0.5rem" }}>Name</th>
            <th style={{ padding: "0.5rem" }}>Email</th>
            <th style={{ padding: "0.5rem" }}>Role</th>
            <th style={{ padding: "0.5rem" }}>Status</th>
            <th style={{ padding: "0.5rem" }}>Change role</th>
          </tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
              <td style={{ padding: "0.5rem" }}>{u.display_name}</td>
              <td style={{ padding: "0.5rem" }}>{u.email}</td>
              <td style={{ padding: "0.5rem" }}>{u.role}</td>
              <td style={{ padding: "0.5rem" }}>{u.status}</td>
              <td style={{ padding: "0.5rem" }}>
                <form
                  action={async (formData) => {
                    "use server";
                    await changeUserRole(u.id, formData.get("role") as "user" | "contributor" | "admin");
                  }}
                  style={{ display: "flex", gap: 8 }}
                >
                  <select name="role" defaultValue={u.role}>
                    <option value="user">user</option>
                    <option value="contributor">contributor</option>
                    <option value="admin">admin</option>
                  </select>
                  <button type="submit">Save</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}