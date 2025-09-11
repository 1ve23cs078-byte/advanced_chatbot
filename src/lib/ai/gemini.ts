// Server-only Gemini helper.
// Centralizes SDK client creation so the API key never leaves the server.
// Route Handlers import this function to perform streaming generations.

import { GoogleGenerativeAI, GenerativeModel, GenerateContentRequest, SafetySetting } from '@google/generative-ai';

// Ensure this file is only ever imported on the server.
if (typeof window !== 'undefined') {
  throw new Error('lib/ai/gemini.ts must not be imported in the browser.');
}

const API_KEY = process.env.GEMINI_API_KEY; // NEVER expose in the client.
if (!API_KEY) {
  console.warn('[Gemini] GEMINI_API_KEY not set. Streaming route will fail.');
}

let client: GoogleGenerativeAI | null = null;

function getClient() {
  if (!client) {
    client = new GoogleGenerativeAI(API_KEY ?? '');
  }
  return client;
}

export interface StreamParams {
  model: string;
  temperature: number;
  topP: number;
  maxTokens?: number;
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
}

// Map our chat history into a single prompt for this Day 1 demo.
// (Later lessons: structured history, tool results, system prompts.)
function buildPrompt(messages: StreamParams['messages']): string {
  return messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');
}

export async function streamGemini({ model, temperature, topP, maxTokens, messages }: StreamParams) {
  const genModel: GenerativeModel = getClient().getGenerativeModel({ model });
  const prompt = buildPrompt(messages);

  const request: GenerateContentRequest = {
    contents: [
      {
        role: 'user', // Collapsing roles for simplicity in this baseline demo.
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature,
      topP,
      maxOutputTokens: maxTokens,
    },
    safetySettings: [
      // For teaching: show these exist; defaults are usually fine.
      // Keeping minimal; instructors can extend.
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' } as SafetySetting,
    ],
  } as GenerateContentRequest;

  // Gemini Node SDK streaming.
  const result = await genModel.generateContentStream(request);
  return result; // Caller will iterate over stream events.
}
