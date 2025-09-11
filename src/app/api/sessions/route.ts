import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { chatsCollection } from '../../../lib/db';
import type { CreateChatSessionRequest, StoredChatSession, ChatListResponse, ChatListItem } from '../../../lib/types';

export const runtime = 'nodejs';

// GET /api/sessions -> list sessions (lightweight metadata)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(5, parseInt(searchParams.get('pageSize') || '20', 10)));
    const q = (searchParams.get('q') || '').trim();
  const session = await getServerSession(authOptions);
    if (!session) return new Response('Unauthorized', { status: 401 });
  const userId = (session.user as { id?: string; email?: string }).id || session.user?.email || 'unknown';
    const col = await chatsCollection();
  const filter: Record<string, unknown> = { userId };
  if (q) filter.title = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } as const;
    const total = await col.countDocuments(filter);
    const docs: Partial<StoredChatSession>[] = await col
      .find(filter, { projection: { messages: 0 } })
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray();
    const items: ChatListItem[] = docs
      .filter(d => d.sessionId && d.title && d.createdAt && d.updatedAt && d.model)
      .map(d => ({
        sessionId: d.sessionId as string,
        title: d.title as string,
        createdAt: d.createdAt as string,
        updatedAt: d.updatedAt as string,
        model: d.model as string,
      }));
    const resp: ChatListResponse = {
      items,
      page,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
    return Response.json(resp);
  } catch {
    return new Response('Failed to list sessions', { status: 500 });
  }
}

// POST /api/sessions -> create a session
export async function POST(req: NextRequest) {
  let body: CreateChatSessionRequest;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const { title, messages = [], config } = body || {};
  if (!config?.model) return new Response('Missing config.model', { status: 400 });
  try {
  const session = await getServerSession(authOptions);
    if (!session) return new Response('Unauthorized', { status: 401 });
  const userId = (session.user as { id?: string; email?: string }).id || session.user?.email || 'unknown';
    const col = await chatsCollection();
    const now = new Date().toISOString();
    const newSession: StoredChatSession = {
      sessionId: randomUUID(),
      title: title || (messages.find(m => m.role === 'user')?.content?.slice(0, 60) || 'New Chat'),
      messages,
      model: config.model,
      temperature: config.temperature,
      topP: config.topP,
      maxTokens: config.maxTokens,
      userId,
      createdAt: now,
      updatedAt: now,
    };
    await col.insertOne(newSession as unknown as StoredChatSession);
    return Response.json({ sessionId: newSession.sessionId });
  } catch {
    return new Response('Failed to create', { status: 500 });
  }
}

// DELETE /api/sessions?id=SESSION_ID
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });
  try {
  const session = await getServerSession(authOptions);
  if (!session) return new Response('Unauthorized', { status: 401 });
  const userId = (session.user as { id?: string; email?: string }).id || session.user?.email || '__';
    const col = await chatsCollection();
    await col.deleteOne({ sessionId: id, userId });
    return new Response(null, { status: 204 });
  } catch {
    return new Response('Failed to delete', { status: 500 });
  }
}

// PATCH /api/sessions -> update title or replace messages
export async function PATCH(req: NextRequest) {
  let body: Partial<StoredChatSession> & { sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const { sessionId, title, messages, model, temperature, topP, maxTokens } = body || {};
  if (!sessionId) return new Response('Missing sessionId', { status: 400 });
  try {
  const session = await getServerSession(authOptions);
  if (!session) return new Response('Unauthorized', { status: 401 });
  const userId = (session.user as { id?: string; email?: string }).id || session.user?.email || '__';
    const col = await chatsCollection();
  const update: Partial<StoredChatSession> & { updatedAt: string } = { updatedAt: new Date().toISOString() };
    if (title) update.title = title;
    if (messages) update.messages = messages;
    if (model) update.model = model;
    if (temperature != null) update.temperature = temperature;
    if (topP != null) update.topP = topP;
    if (maxTokens != null) update.maxTokens = maxTokens;
    await col.updateOne({ sessionId, userId }, { $set: update });
    return new Response(null, { status: 204 });
  } catch {
    return new Response('Failed to update', { status: 500 });
  }
}
