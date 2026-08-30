import { signUp, signInWithGoogle } from "@/app/auth/actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="p-8 font-sans max-w-[400px] text-clay-900">
      <h1 className="text-clay-900">Sign up</h1>

      {params.error && (
        <p className="text-red-600">{decodeURIComponent(params.error)}</p>
      )}
      {params.success && (
        <p className="text-green-600">
          Account created! Check your email to confirm, then{" "}
          <a href="/login">log in</a>.
        </p>
      )}

      <form action={signUp} className="flex flex-col gap-3">
        <label>
          Display name
          <input name="displayName" type="text" required className="w-full" />
        </label>
        <label>
          Email
          <input name="email" type="email" required className="w-full" />
        </label>
        <label>
          Password
          <input name="password" type="password" required minLength={6} className="w-full" />
        </label>
        <button type="submit" className="bg-clay-600 text-white rounded px-3 py-2">
          Create account
        </button>
      </form>

      <p className="my-4">— or —</p>
      <form action={signInWithGoogle}>
        <button type="submit" className="bg-white border border-gray-300 rounded px-3 py-2">
          Continue with Google
        </button>
      </form>

      <p>
        Already have an account? <a href="/login">Log in</a>
      </p>
    </main>
  );
}
