import { createNote } from "@/app/notes/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  // Only approved places make sense to attach a note to from this simple
  // form. (Later steps will replace this with a proper map-click flow.)
  const { data: places } = await supabase
    .from("places")
    .select("id, name")
    .eq("status", "approved")
    .order("name");

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 500 }}>
      <h1>Add a note</h1>

      {params.error && (
        <p style={{ color: "red" }}>{decodeURIComponent(params.error)}</p>
      )}
      {params.success && (
        <p style={{ color: "green" }}>
          Note submitted! Status: <strong>{params.status}</strong>
          {params.status === "pending" && " (awaiting admin approval)"}
        </p>
      )}

      <form action={createNote} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Place (optional)
          <select name="placeId" style={{ width: "100%" }}>
            <option value="">— none —</option>
            {places?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input name="title" type="text" required style={{ width: "100%" }} />
        </label>
        <label>
          Body
          <textarea name="body" required style={{ width: "100%" }} />
        </label>
        <label>
          Date display text (e.g. &quot;c. 1446 BC&quot;)
          <input name="dateDisplay" type="text" style={{ width: "100%" }} />
        </label>
        <label>
          Date sort value (year as a number — use negative for BC, e.g. -1446 for 1446 BC)
          <input name="dateSortStart" type="number" style={{ width: "100%" }} />
        </label>
        <label>
          <input name="approximate" type="checkbox" /> Date is approximate
        </label>
        <label>
          Scripture reference
          <input name="scriptureReference" type="text" style={{ width: "100%" }} />
        </label>
        <button type="submit">Submit note</button>
      </form>

      {(!places || places.length === 0) && (
        <p style={{ color: "#888", marginTop: "1rem" }}>
          No approved places yet — you can still submit a general note
          without one, or go add a place first at{" "}
          <a href="/places/new">/places/new</a>.
        </p>
      )}
    </main>
  );
}
