import { login, signInWithGoogle } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 400 }}>
      <h1>Log in</h1>

      {params.error && (
        <p style={{ color: "red" }}>{decodeURIComponent(params.error)}</p>
      )}

      <form action={login} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Email
          <input name="email" type="email" required style={{ width: "100%" }} />
        </label>
        <label>
          Password
          <input name="password" type="password" required style={{ width: "100%" }} />
        </label>
        <button type="submit">Log in</button>
      </form>

      
      <p style={{ margin: "1rem 0" }}>— or —</p>
      <form action={signInWithGoogle}>
        <button type="submit">Continue with Google</button>
      </form>

      <p>
        Don&apos;t have an account? <a href="/signup">Sign up</a>
      </p>
    </main>
  );
}
