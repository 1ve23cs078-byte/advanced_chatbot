"use client";
import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

export default function LoginPage() {
  const params = useSearchParams();
  const router = useRouter();
  const registered = params.get('registered');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (registered) {
      // Optionally pre-fill focus or show toast; keeping simple.
    }
  }, [registered]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn('credentials', { redirect: false, email, password });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/chat');
    }
  };

  return (
    <main className="max-w-md mx-auto px-6 py-16 space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Access your saved chat sessions.</p>
        {registered && (
          <p className="text-xs text-green-600">Registration successful. Please login.</p>
        )}
      </div>
      <form onSubmit={submit} className="space-y-4 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-sm p-6 rounded-lg border">
        <label className="flex flex-col gap-1 text-sm">
          <span>Email</span>
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="px-3 py-2 rounded border bg-white dark:bg-neutral-800" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Password</span>
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="px-3 py-2 rounded border bg-white dark:bg-neutral-800" />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button disabled={loading} type="submit" className="w-full inline-flex justify-center items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium shadow hover:bg-blue-500 disabled:opacity-50">{loading ? 'Signing in…' : 'Login'}</button>
        <p className="text-xs text-center text-gray-600 dark:text-gray-400">Need an account? <Link href="/register" className="text-blue-600 hover:underline">Register</Link></p>
      </form>
    </main>
  );
}
