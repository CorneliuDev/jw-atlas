import { createPlace } from "@/app/places/actions";

export default async function NewPlacePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; status?: string }>;
}) {
  const params = await searchParams;

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 500 }}>
      <h1>Add a place</h1>

      {params.error && (
        <p style={{ color: "red" }}>{decodeURIComponent(params.error)}</p>
      )}
      {params.success && (
        <p style={{ color: "green" }}>
          Place submitted! Status: <strong>{params.status}</strong>
          {params.status === "pending" && " (awaiting admin approval)"}
        </p>
      )}

      <form action={createPlace} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Name
          <input name="name" type="text" required style={{ width: "100%" }} />
        </label>
        <label>
          Latitude
          <input name="latitude" type="number" step="any" required style={{ width: "100%" }} />
        </label>
        <label>
          Longitude
          <input name="longitude" type="number" step="any" required style={{ width: "100%" }} />
        </label>
        <label>
          Description
          <textarea name="description" style={{ width: "100%" }} />
        </label>
        <label>
          Source reference (e.g. &quot;Insight on the Scriptures, Vol. 1&quot;)
          <input name="sourceReference" type="text" style={{ width: "100%" }} />
        </label>
        <label>
          Source URL
          <input name="sourceUrl" type="url" style={{ width: "100%" }} />
        </label>
        <button type="submit">Submit place</button>
      </form>
    </main>
  );
}
