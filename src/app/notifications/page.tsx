import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/content/permissions";
import Link from "next/link";
import { redirect } from "next/navigation";

async function markAllRead(userId: string) {
  "use server";

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
}

export default async function NotificationsPage() {
  const user = await getCurrentAppUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, message, reason, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const markAllReadForUser = markAllRead.bind(null, user.id);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 600 }}>
      <h1>Notifications</h1>
      <p><Link href="/">Back to map</Link></p>

      <form action={markAllReadForUser}>
        <button type="submit">Mark all as read</button>
      </form>

      {notifications?.length === 0 && <p style={{ color: "#888" }}>No notifications yet.</p>}

      {notifications?.map((notification) => (
        <div
          key={notification.id}
          style={{
            padding: "0.75rem",
            marginTop: 8,
            borderRadius: 6,
            background: notification.read ? "white" : "#F0F7F4",
            border: "1px solid #eee",
          }}
        >
          <p style={{ margin: 0 }}>{notification.message}</p>
          {notification.reason && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>
              Reason: {notification.reason}
            </p>
          )}
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#999" }}>
            {new Date(notification.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </main>
  );
}
