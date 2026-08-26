// src/app/people/new/page.tsx
import { createPerson } from "@/app/people/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewPersonPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; status?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: tribes } = await supabase
    .from("tribes")
    .select("id, name")
    .eq("status", "approved")
    .order("name");

  const { data: places } = await supabase
    .from("places")
    .select("id, name")
    .eq("status", "approved")
    .order("name");

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 500 }}>
      <h1>Add a person</h1>

      {params.error && <p style={{ color: "red" }}>{decodeURIComponent(params.error)}</p>}
      {params.success && (
        <p style={{ color: "green" }}>
          Person submitted! Status: <strong>{params.status}</strong>
        </p>
      )}

      <form action={createPerson} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Name
          <input name="name" type="text" required style={{ width: "100%" }} />
        </label>
        <label>
          Description
          <textarea name="description" style={{ width: "100%" }} />
        </label>
        <label>
          Birth year (negative = BC)
          <input name="birthDateSort" type="number" style={{ width: "100%" }} />
        </label>
        <label>
          Death year (negative = BC)
          <input name="deathDateSort" type="number" style={{ width: "100%" }} />
        </label>
        <label>
          Tribe / nation
          <select name="tribeId" style={{ width: "100%" }}>
            <option value="">— none —</option>
            {tribes?.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label>
          Scripture reference
          <input name="scriptureReference" type="text" style={{ width: "100%" }} />
        </label>

        <fieldset>
          <legend>Associated places</legend>
          {places?.map((p) => (
            <label key={p.id} style={{ display: "block" }}>
              <input type="checkbox" name="placeIds" value={p.id} /> {p.name}
            </label>
          ))}
          {(!places || places.length === 0) && (
            <p style={{ color: "#888", fontSize: 13 }}>No approved places yet.</p>
          )}
        </fieldset>

        <button type="submit">Submit person</button>
      </form>

      <p><a href="/">← Back to map</a></p>
    </main>
  );
}