// Route Handler for streaming chat completions.
// Demonstrates: server-only secret usage, streaming text tokens, simple metrics.
// The client posts chat state + model parameters; we stream back tokens
// so learners can observe latency and incremental rendering.

import { NextRequest } from 'next/server';
import { streamGemini } from '../../../lib/ai/gemini';
import type { ChatRequestBody, ChatMessage } from '../../../lib/types';
import { chatsCollection } from '../../../lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';

export const runtime = 'nodejs'; // Ensure Node runtime for SDK.

export async function POST(req: NextRequest) {
  const started = Date.now();
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { messages, model, temperature, topP, maxTokens, sessionId } = (body || {}) as ChatRequestBody & { sessionId?: string };
  if (!Array.isArray(messages) || !model) {
    return new Response('Missing required fields', { status: 400 });
  }

  try {
    // Resolve auth session once so we can persist messages if authenticated.
    const session = await getServerSession(authOptions);
    const userId: string | undefined = (session?.user as { id?: string; email?: string } | undefined)?.id || session?.user?.email || undefined;

    // Auto-create or append user message before streaming so it's never lost.
    if (sessionId && userId) {
      try {
        const col = await chatsCollection();
        const existing = await col.findOne({ sessionId, userId }, { projection: { _id: 1 } });
        const nowIso = new Date().toISOString();
        if (!existing) {
          // First time seeing this sessionId: create full session document with all messages so far.
          const title = messages.find(m => m.role === 'user' && m.content.trim())?.content.slice(0, 60) || 'New Chat';
          await col.insertOne({
            sessionId,
            title,
            messages, // includes system + current user message(s)
            model,
            temperature,
            topP,
            maxTokens,
            userId,
            createdAt: nowIso,
            updatedAt: nowIso,
          } as any);
        } else {
          const lastUser = [...messages].reverse().find(m => m.role === 'user');
          if (lastUser) {
            await col.updateOne(
              { sessionId, userId },
              {
                $push: { messages: lastUser as ChatMessage },
                $set: {
                  updatedAt: nowIso,
                  model,
                  temperature,
                  topP,
                  maxTokens,
                },
              }
            );
          }
        }
      } catch (e) {
        console.warn('Failed to persist (create or append) user message pre-stream', e);
      }
    }

    const stream = await streamGemini({ messages, model, temperature, topP, maxTokens });

    // Build a text/event-stream (or chunked text) like response.
    // Here we just emit each token as a line beginning with 'data:'.
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let tokenCount = 0;
        let finalText = '';
        try {
          for await (const chunk of stream.stream) {
            const text = chunk.text();
            if (text) {
              finalText += text;
              tokenCount += 1; // Approx token count (teaching simplification).
              controller.enqueue(encoder.encode(`data: {"type":"token","data":${JSON.stringify(text)}}\n`));
            }
          }
          const elapsed = Date.now() - started;
          controller.enqueue(
            encoder.encode(
              `data: {"type":"meta","data":${JSON.stringify({ tokens: tokenCount, elapsedMs: elapsed })}}\n`
            )
          );
          controller.enqueue(encoder.encode('data: [DONE]\n'));
          // Persist assistant message if sessionId provided (append assistant reply & update timestamp).
          if (sessionId && userId) {
            try {
              const col = await chatsCollection();
              await col.updateOne(
                { sessionId, userId },
                {
                  $push: { messages: { role: 'assistant', content: finalText } as ChatMessage },
                  $set: { updatedAt: new Date().toISOString() },
                },
                { upsert: false }
              );
            } catch (e) {
              console.warn('Failed to persist assistant message', e);
            }
          }
        } catch (err: unknown) {
          controller.enqueue(
            encoder.encode(
              `data: {"type":"error","data":${JSON.stringify((err as Error).message || 'stream error')}}\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // For some proxies
      },
    });
  } catch (e: unknown) {
    const msg = (e as Error).message || 'unknown error';
    return new Response(`Upstream error: ${msg}`, { status: 500 });
  }
}
