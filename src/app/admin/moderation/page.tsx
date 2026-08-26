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

  const pendingPlaceIds = (pendingPlaces ?? []).map((place) => place.id);
  const { data: editVersions } = pendingPlaceIds.length > 0
    ? await supabase
        .from("content_versions")
        .select("id, content_id, diff_snapshot, created_at, edited_by")
        .eq("content_type", "places")
        .in("content_id", pendingPlaceIds)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] };

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

      <h2>Recent edits (diff view)</h2>
      {editVersions?.length === 0 && <p style={{ color: "#888" }}>No pending edits.</p>}
      {editVersions?.map((version) => {
        const diff = version.diff_snapshot as {
          before: Record<string, unknown>;
          after: Record<string, unknown>;
        };
        return (
          <div key={version.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginBottom: "0.75rem", fontSize: 13 }}>
            <strong>Edit to place {version.content_id}</strong>
            <table style={{ width: "100%", marginTop: 8 }}>
              <thead>
                <tr><th align="left">Field</th><th align="left">Before</th><th align="left">After</th></tr>
              </thead>
              <tbody>
                {Object.keys(diff.before).map((key) => (
                  <tr key={key} style={{ background: diff.before[key] !== diff.after[key] ? "#FFF3E0" : "transparent" }}>
                    <td>{key}</td>
                    <td>{String(diff.before[key])}</td>
                    <td>{String(diff.after[key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

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