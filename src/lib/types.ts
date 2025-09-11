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

// Persistence Layer Types
export interface StoredChatSession {
  _id?: string; // MongoDB ObjectId serialized to string when sent to client.
  sessionId: string; // Stable UUID for client reference.
  title: string; // First user message or custom.
  messages: ChatMessage[]; // Complete transcript including system.
  model: string;
  temperature: number;
  topP: number;
  maxTokens?: number;
  userId?: string; // Owner scoping via cookie (lightweight auth demo)
  createdAt: string; // ISO string for simplicity.
  updatedAt: string; // ISO string.
}

export interface CreateChatSessionRequest {
  title?: string;
  // Optionally seed with messages (first user message); if omitted created empty aside from system.
  messages?: ChatMessage[];
  config: ModelConfig;
}

export interface UpdateChatSessionRequest {
  sessionId: string;
  messages?: ChatMessage[];
  title?: string;
  config?: Partial<ModelConfig>;
}

export interface ChatListItem {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
}

export interface ChatListResponse {
  items: ChatListItem[];
  page: number;
  totalPages: number;
  total: number;
}

// User Auth Types
export interface AppUser {
  _id?: string;
  userId: string; // stable UUID
  email: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}
