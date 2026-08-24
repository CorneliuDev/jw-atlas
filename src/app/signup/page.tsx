import { signUp } from "@/app/auth/actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 400 }}>
      <h1>Sign up</h1>

      {params.error && (
        <p style={{ color: "red" }}>{decodeURIComponent(params.error)}</p>
      )}
      {params.success && (
        <p style={{ color: "green" }}>
          Account created! Check your email to confirm, then{" "}
          <a href="/login">log in</a>.
        </p>
      )}

      <form action={signUp} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Display name
          <input name="displayName" type="text" required style={{ width: "100%" }} />
        </label>
        <label>
          Email
          <input name="email" type="email" required style={{ width: "100%" }} />
        </label>
        <label>
          Password
          <input name="password" type="password" required minLength={6} style={{ width: "100%" }} />
        </label>
        <button type="submit">Create account</button>
      </form>

      <p>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </main>
  );
}
