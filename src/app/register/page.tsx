"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      if (!res.ok) {
        setError(await res.text());
      } else {
        setSuccess(true);
        setTimeout(() => router.push('/login?registered=1'), 1200);
      }
    } catch {
      setError('Network error');
    } finally { setLoading(false); }
  };

  return (
    <main className="max-w-md mx-auto px-6 py-16 space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create Account</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">Register to save and revisit chat sessions.</p>
      </div>
      <form onSubmit={submit} className="space-y-4 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-sm p-6 rounded-lg border">
        <label className="flex flex-col gap-1 text-sm">
          <span>Email</span>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="px-3 py-2 rounded border bg-white dark:bg-neutral-800" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Password (min 6)</span>
          <input required minLength={6} type="password" value={password} onChange={e => setPassword(e.target.value)} className="px-3 py-2 rounded border bg-white dark:bg-neutral-800" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Confirm Password</span>
          <input required minLength={6} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className="px-3 py-2 rounded border bg-white dark:bg-neutral-800" />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-green-600">Registered! Redirecting…</p>}
        <button disabled={loading} type="submit" className="w-full inline-flex justify-center items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium shadow hover:bg-green-500 disabled:opacity-50">{loading ? 'Submitting…' : 'Register'}</button>
        <p className="text-xs text-center text-gray-600 dark:text-gray-400">Already have an account? <Link href="/login" className="text-blue-600 hover:underline">Login</Link></p>
      </form>
    </main>
  );
}
