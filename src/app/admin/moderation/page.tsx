// src/app/admin/moderation/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentAppUser, canModerateContent } from "@/lib/content/permissions";
import { redirect } from "next/navigation";
import { approveContent, rejectContent } from "./actions";

export default async function ModerationQueuePage() {
  const user = await getCurrentAppUser();

  if (!canModerateContent(user)) {
    redirect("/");
  }

  const supabase = await createSupabaseServerClient();

  const { data: pendingPlaces } = await supabase
    .from("places")
    .select("id, name, description, latitude, longitude, created_by, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const { data: pendingNotes } = await supabase
    .from("notes")
    .select("id, title, body, date_display, created_by, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 700 }}>
      <h1>Moderation queue</h1>
      <p><a href="/">← Back to map</a></p>

      <h2>Pending places ({pendingPlaces?.length ?? 0})</h2>
      {pendingPlaces?.length === 0 && <p style={{ color: "#888" }}>Nothing pending.</p>}
      {pendingPlaces?.map((place) => (
        <div key={place.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginBottom: "0.75rem" }}>
          <strong>{place.name}</strong>
          <p style={{ fontSize: 13, color: "#666" }}>
            {place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}
          </p>
          {place.description && <p>{place.description}</p>}
          <form action={async () => { "use server"; await approveContent("places", place.id); }} style={{ display: "inline" }}>
            <button type="submit">Approve</button>
          </form>{" "}
          <form action={async () => { "use server"; await rejectContent("places", place.id, ""); }} style={{ display: "inline" }}>
            <button type="submit">Reject</button>
          </form>
        </div>
      ))}

      <h2>Pending notes ({pendingNotes?.length ?? 0})</h2>
      {pendingNotes?.length === 0 && <p style={{ color: "#888" }}>Nothing pending.</p>}
      {pendingNotes?.map((note) => (
        <div key={note.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginBottom: "0.75rem" }}>
          <strong>{note.title}</strong>
          {note.date_display && <p style={{ fontSize: 13, color: "#666" }}>{note.date_display}</p>}
          <p>{note.body}</p>
          <form action={async () => { "use server"; await approveContent("notes", note.id); }} style={{ display: "inline" }}>
            <button type="submit">Approve</button>
          </form>{" "}
          <form action={async () => { "use server"; await rejectContent("notes", note.id, ""); }} style={{ display: "inline" }}>
            <button type="submit">Reject</button>
          </form>
        </div>
      ))}
    </main>
  );
}