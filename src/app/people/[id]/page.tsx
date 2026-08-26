// src/app/people/[id]/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: person } = await supabase
    .from("people")
    .select("id, name, description, birth_date_sort, death_date_sort, scripture_reference, tribes(name)")
    .eq("id", id)
    .eq("status", "approved")
    .single();

  if (!person) notFound();

  const { data: placeLinks } = await supabase
    .from("person_places")
    .select("places(id, name, latitude, longitude)")
    .eq("person_id", id);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 600 }}>
      <h1>{person.name}</h1>
      {person.tribes && (
        <p style={{ color: "#666" }}>
          Tribe: {(person.tribes as unknown as { name: string }[])[0]?.name}
        </p>
      )}
      {person.scripture_reference && <p style={{ color: "#666" }}>{person.scripture_reference}</p>}
      {person.description && <p>{person.description}</p>}

      <h2>Everywhere associated with {person.name}</h2>
      {(!placeLinks || placeLinks.length === 0) && (
        <p style={{ color: "#888" }}>No places linked yet.</p>
      )}
      <ul>
        {placeLinks?.map((link, i) => {
          const place = link.places as unknown as { id: string; name: string };
          return (
            <li key={i}>
              <a href={`/?focusPlace=${place.id}`}>{place.name}</a>
            </li>
          );
        })}
      </ul>

      <p><a href="/">← Back to map</a></p>
    </main>
  );
}