// Basic shared types for the teaching demo.
// These types are intentionally lightweight and colocated to keep the project small.

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: ChatRole;
  content: string; // Plain text only for Day 1.
}

export interface ModelConfig {
  model: string;
  temperature: number; // Creativity (0 = deterministic, 1 = more random)
  topP: number; // Nucleus sampling cap
  maxTokens?: number; // Optional server cap on generation length
}

export interface ChatRequestBody extends ModelConfig {
  messages: ChatMessage[];
}

export interface StreamMeta {
  // Lightweight teaching metrics emitted at end of stream.
  tokens: number;
  elapsedMs: number;
}

export interface StreamEnvelope {
  type: 'token' | 'meta' | 'error';
  data: string | StreamMeta;
}
