// MongoDB client singleton for Next.js App Router.
// Uses lazy init to avoid creating multiple connections during hot reload.

import { MongoClient, Db, Collection } from 'mongodb';
import type { StoredChatSession, AppUser } from './types';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.warn('[db] MONGODB_URI not set – persistence disabled.');
}

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

async function getClient(): Promise<MongoClient> {
  if (!uri) throw new Error('MONGODB_URI missing');
  if (client) return client;
  if (!clientPromise) {
    clientPromise = MongoClient.connect(uri, {
      // Server API Strict mode optional; leaving basic for demo simplicity.
    }).then((c: MongoClient) => {
      client = c;
      return c;
    });
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const c = await getClient();
  const dbName = process.env.MONGODB_DB || 'gemini_chatbot';
  return c.db(dbName);
}

export async function chatsCollection(): Promise<Collection<StoredChatSession>> {
  const db = await getDb();
  const col = db.collection<StoredChatSession>('chats');
  // Create indexes (idempotent) – not awaited each request for perf; fire & forget.
  col.createIndex({ createdAt: -1 }).catch(() => {});
  return col;
}

export async function usersCollection(): Promise<Collection<AppUser>> {
  const db = await getDb();
  const col = db.collection<AppUser>('users');
  col.createIndex({ email: 1 }, { unique: true }).catch(() => {});
  return col;
}
