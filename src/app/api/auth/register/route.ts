import { NextRequest } from 'next/server';
import { usersCollection } from '../../../../lib/db';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import type { AppUser } from '../../../../lib/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }
  const email = body.email?.toLowerCase().trim();
  const password = body.password;
  if (!email || !password || password.length < 6) {
    return new Response('Invalid email or password too short', { status: 400 });
  }
  try {
    const col = await usersCollection();
    const exists = await col.findOne({ email });
    if (exists) return new Response('Email already registered', { status: 409 });
    const hash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const user: AppUser = { userId: randomUUID(), email, passwordHash: hash, createdAt: now, updatedAt: now };
  await col.insertOne(user as unknown as AppUser);
    return new Response(null, { status: 201 });
  } catch {
    return new Response('Registration failed', { status: 500 });
  }
}
