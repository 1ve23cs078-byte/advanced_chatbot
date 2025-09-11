import { NextRequest } from 'next/server';
import { chatsCollection } from '../../../../lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!id) return new Response('Missing id', { status: 400 });
  try {
  const session = await getServerSession(authOptions);
  if (!session) return new Response('Unauthorized', { status: 401 });
  const userId = (session.user as { id?: string; email?: string }).id || session.user?.email || '__';
    const col = await chatsCollection();
    const doc = await col.findOne({ sessionId: id, userId });
    if (!doc) return new Response('Not found', { status: 404 });
    return Response.json(doc);
  } catch {
    return new Response('Failed to fetch', { status: 500 });
  }
}
