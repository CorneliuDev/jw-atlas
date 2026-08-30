import { login, signInWithGoogle } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="p-8 font-sans max-w-[400px] text-clay-900">
      <h1 className="text-clay-900">Log in</h1>

      {params.error && (
        <p className="text-red-600">{decodeURIComponent(params.error)}</p>
      )}

      <form action={login} className="flex flex-col gap-3">
        <label>
          Email
          <input name="email" type="email" required className="w-full" />
        </label>
        <label>
          Password
          <input name="password" type="password" required className="w-full" />
        </label>
        <button type="submit" className="bg-clay-600 text-white rounded px-3 py-2">
          Log in
        </button>
      </form>

      <p className="my-4">— or —</p>
      <form action={signInWithGoogle}>
        <button type="submit" className="bg-white border border-gray-300 rounded px-3 py-2">
          Continue with Google
        </button>
      </form>

      <p>
        Don&apos;t have an account? <a href="/signup">Sign up</a>
      </p>
    </main>
  );
}
