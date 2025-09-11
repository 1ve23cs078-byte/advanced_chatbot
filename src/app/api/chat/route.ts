// Route Handler for streaming chat completions.
// Demonstrates: server-only secret usage, streaming text tokens, simple metrics.
// The client posts chat state + model parameters; we stream back tokens
// so learners can observe latency and incremental rendering.

import { NextRequest } from 'next/server';
import { streamGemini } from '../../../lib/ai/gemini';
import type { ChatRequestBody } from '../../../lib/types';

export const runtime = 'nodejs'; // Ensure Node runtime for SDK.

export async function POST(req: NextRequest) {
  const started = Date.now();
  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { messages, model, temperature, topP, maxTokens } = body || {};
  if (!Array.isArray(messages) || !model) {
    return new Response('Missing required fields', { status: 400 });
  }

  try {
    const stream = await streamGemini({ messages, model, temperature, topP, maxTokens });

    // Build a text/event-stream (or chunked text) like response.
    // Here we just emit each token as a line beginning with 'data:'.
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let tokenCount = 0;
        try {
          for await (const chunk of stream.stream) {
            const text = chunk.text();
            if (text) {
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
