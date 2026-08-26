// src/app/tribes/new/page.tsx
import { createTribe } from "@/app/tribes/actions";

export default async function NewTribePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; status?: string }>;
}) {
  const params = await searchParams;

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 500 }}>
      <h1>Add a tribe / nation</h1>

      {params.error && <p style={{ color: "red" }}>{decodeURIComponent(params.error)}</p>}
      {params.success && (
        <p style={{ color: "green" }}>
          Tribe submitted! Status: <strong>{params.status}</strong>
        </p>
      )}

      <form action={createTribe} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Name
          <input name="name" type="text" required style={{ width: "100%" }} />
        </label>
        <label>
          Description
          <textarea name="description" style={{ width: "100%" }} />
        </label>
        <button type="submit">Submit tribe</button>
      </form>

      <p><a href="/">← Back to map</a></p>
    </main>
  );
}