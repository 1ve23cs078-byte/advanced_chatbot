"use client";
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import React from 'react';

export function LoginControls() {
  const { data: session, status } = useSession();
  if (status === 'loading') return <span className="opacity-60">…</span>;
  if (!session) return (
    <div className="flex items-center gap-2">
      <Link href="/login" className="px-3 py-1 border rounded hover:bg-gray-50 dark:hover:bg-neutral-800">Login</Link>
      <Link href="/register" className="px-3 py-1 border rounded bg-green-600 text-white hover:bg-green-500">Register</Link>
    </div>
  );
  return (
    <div className="flex items-center gap-2">
      <Link href="/chat" className="px-2 py-1 text-xs border rounded bg-blue-600 text-white hover:bg-blue-500">Chat</Link>
      <span className="hidden md:inline text-xs max-w-[140px] truncate" title={session.user?.email || ''}>{session.user?.email}</span>
      <button onClick={() => signOut()} className="px-2 py-1 text-xs border rounded">Logout</button>
    </div>
  );
}
