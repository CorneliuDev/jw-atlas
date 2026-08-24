import { supabase } from "@/lib/supabase/client";

export default async function Home() {
  // Simple connectivity check: ask Supabase for its own timestamp.
  // No tables exist yet, so we call a built-in Postgres function instead of
  // querying a table. If this succeeds, the client + env vars are wired up
  // correctly. We'll delete this test call once we have real tables.
  const { data, error } = await supabase.rpc("now");

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>JW Atlas — Supabase connectivity check</h1>
      {error ? (
        <div>
          <p style={{ color: "red" }}>
            ❌ Could not reach Supabase. Error below:
          </p>
          <pre>{JSON.stringify(error, null, 2)}</pre>
        </div>
      ) : (
        <div>
          <p style={{ color: "green" }}>✅ Supabase connection successful.</p>
          <p>Server time from Supabase: {JSON.stringify(data)}</p>
        </div>
      )}
    </main>
  );
}