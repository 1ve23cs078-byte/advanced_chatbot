"use client";
// Chat UI: messages list, streaming assistant reply, controls panel.
// Teaching comments inline; kept in a single component tree for clarity.

import React, { useCallback, useEffect, useRef, useState } from 'react';
// Avoid importing Node's crypto polyfill in the browser; use Web Crypto if available.
function generateUUID(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as { randomUUID: () => string }).randomUUID();
    }
  } catch {}
  // Fallback RFC4122-ish v4 generator.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
import type { ChatMessage, ModelConfig, StreamEnvelope, ChatListItem, StoredChatSession, ChatListResponse } from '../../lib/types';
import { useSession } from 'next-auth/react';

const DEFAULT_CONFIG: ModelConfig = {
  model: 'gemini-1.5-pro',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 256,
};

interface PendingAssistantState {
  text: string;
  tokens: number;
  elapsedMs?: number;
}

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'system',
      content:
        'You are a helpful teaching assistant. Provide concise answers that are safe and appropriate for a classroom demo.',
    },
  ]);
  const [config, setConfig] = useState<ModelConfig>(() => {
    try {
      const raw = localStorage.getItem('genai-config');
      return raw ? { ...DEFAULT_CONFIG, ...JSON.parse(raw) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });
  const [userInput, setUserInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [pending, setPending] = useState<PendingAssistantState | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [lastPrompt, setLastPrompt] = useState('');
  const [sessions, setSessions] = useState<ChatListItem[]>([]);
  const [sessionSearch, setSessionSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // const [loadingSession, setLoadingSession] = useState(false); // reserved for future loading UX
  const [saving, setSaving] = useState(false);
  const { data: session } = useSession();

  // Load session list on mount.
  const refreshSessions = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (sessionSearch.trim()) params.set('q', sessionSearch.trim());
      const res = await fetch(`/api/sessions?${params.toString()}`);
      if (res.ok) {
        const data: ChatListResponse = await res.json();
        setSessions(data.items);
        setTotalPages(data.totalPages);
      }
    } catch {}
  }, [page, sessionSearch]);

  useEffect(() => {
    refreshSessions();
  }, [page, sessionSearch, refreshSessions]);

  const createSession = useCallback(async () => {
    // Optimistic stub
    const tempId = 'temp-' + Date.now();
    const title = messages.find(m => m.role === 'user' && m.content.trim())?.content?.slice(0,60) || 'New Chat';
    setSessions(s => [{ sessionId: tempId, title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), model: config.model }, ...s]);
    setActiveSessionId(tempId);
    setSaving(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, messages, config }),
      });
      if (res.ok) {
        const { sessionId } = await res.json();
        setActiveSessionId(sessionId);
      }
    } catch {}
    finally {
      setSaving(false);
      refreshSessions();
    }
  }, [messages, config, refreshSessions]);

  const loadSession = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data: StoredChatSession = await res.json();
        setMessages(data.messages);
        setActiveSessionId(id);
        setConfig(c => ({ ...c, model: data.model, temperature: data.temperature, topP: data.topP, maxTokens: data.maxTokens }));
      }
    } catch {}
  }, [setMessages, setActiveSessionId, setConfig]);

  const deleteSession = useCallback(async (id: string) => {
    if (!confirm('Delete this chat?')) return;
    try {
      await fetch(`/api/sessions?id=${id}`, { method: 'DELETE' });
      if (id === activeSessionId) {
        setActiveSessionId(null);
        reset();
      }
      refreshSessions();
    } catch {}
  }, [activeSessionId, refreshSessions]);

  const startRename = (s: ChatListItem) => {
    setRenamingId(s.sessionId);
    setRenameValue(s.title);
  };

  const submitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingId) return;
    const newTitle = renameValue.trim();
    if (!newTitle) { setRenamingId(null); return; }
    try {
      await fetch('/api/sessions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: renamingId, title: newTitle }) });
      setSessions(s => s.map(item => item.sessionId === renamingId ? { ...item, title: newTitle } : item));
    } catch {}
    setRenamingId(null);
  };

  // Persist config.
  useEffect(() => {
    localStorage.setItem('genai-config', JSON.stringify(config));
  }, [config]);

  // Auto-scroll on new streaming tokens.
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, pending]);

  const sendMessage = useCallback(async () => {
    if (!userInput.trim() || streaming) return;
    // If there is no active session yet but the user is authenticated, pre-generate a session id
    // so the server can auto-create & persist from the very first message.
    let sid = activeSessionId;
    if (!sid && session) {
      sid = generateUUID();
      setActiveSessionId(sid);
    }
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userInput }];
    setMessages(newMessages);
    setUserInput('');
    setPending({ text: '', tokens: 0 });
    setStreaming(true);
    abortRef.current = new AbortController();
    setLastPrompt(userInput);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: newMessages,
          model: config.model,
          temperature: config.temperature,
          topP: config.topP,
          maxTokens: config.maxTokens,
          sessionId: sid || undefined,
        }),
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error('Network error');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let fullText = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // The server sends lines beginning with 'data:'. Split to process SSE-like format.
        const lines = chunk.split(/\n/).filter(Boolean);
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const json = line.replace(/^data: /, '');
          if (json === '[DONE]') {
            // Commit assistant message (server already persisted both sides if session established).
            setMessages(m => [...m, { role: 'assistant', content: fullText }]);
            refreshSessions();
            setPending(p => (p ? { ...p } : p));
            setStreaming(false);
            setPending(null);
            return;
          }
          try {
            const envelope: StreamEnvelope = JSON.parse(json) as StreamEnvelope;
            if (envelope.type === 'token') {
              const tokenText = String(envelope.data);
              fullText += tokenText;
              setPending(p => (p ? { ...p, text: fullText, tokens: p.tokens + 1 } : p));
            } else if (envelope.type === 'meta') {
              const meta = envelope.data as { tokens: number; elapsedMs: number };
              setPending(p => (p ? { ...p, elapsedMs: meta.elapsedMs, tokens: meta.tokens } : p));
            } else if (envelope.type === 'error') {
              setPending(null);
              setStreaming(false);
              setMessages(m => [...m, { role: 'assistant', content: '[Error: ' + envelope.data + ']' }]);
            }
          } catch {
            // Ignore malformed lines.
          }
        }
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError') return;
      setStreaming(false);
      setPending(null);
      setMessages(m => [...m, { role: 'assistant', content: '[Request failed]' }]);
    }
  }, [userInput, messages, config, streaming, activeSessionId, refreshSessions, session]);

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages(messages => messages.slice(0, 1)); // Keep system prompt only.
    setPending(null);
    setUserInput('');
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-4 mt-4">
      <div className="flex flex-col flex-1 border rounded-md overflow-hidden">
        <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-4 bg-background/60">
          {messages.filter(m => m.role !== 'system').map((m, i) => (
            <MessageBubble key={i} role={m.role} text={m.content} />
          ))}
          {pending && (
            <MessageBubble
              role="assistant"
              text={pending.text || '...'}
              streaming={streaming}
            />
          )}
        </div>
        <form
          onSubmit={e => {
            e.preventDefault();
            sendMessage();
          }}
          className="border-t bg-background p-3 flex gap-2 items-end"
        >
          <textarea
            className="flex-1 resize-none rounded-md border p-2 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ask something about GenAI parameters..."
            value={userInput}
            aria-label="Chat input"
            onChange={e => setUserInput(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              disabled={streaming}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
            >
              Send
            </button>
            {streaming && (
              <button
                type="button"
                onClick={stop}
                className="px-2 py-1 text-xs rounded bg-gray-200"
              >
                Stop
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              className="px-2 py-1 text-xs rounded bg-red-100 text-red-700"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
      <aside className="w-80 hidden md:flex flex-col gap-4 text-sm" aria-label="Controls panel">
        {!session && (
          <section className="border rounded-md p-3 text-xs space-y-2">
            <p className="font-semibold">Login to save chats</p>
            <p>Authentication enables: persistent sessions, rename, search.</p>
          </section>
        )}
        {session && (
        <section className="border rounded-md p-3 space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-sm">Sessions</h2>
            <button
              type="button"
              onClick={createSession}
              disabled={saving}
              className="text-xs px-2 py-1 rounded bg-green-600 text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={sessionSearch}
              onChange={e => { setSessionSearch(e.target.value); setPage(1); }}
              placeholder="Search..."
              className="w-full border rounded px-2 py-1 text-xs"
            />
          </div>
          <div className="space-y-1 max-h-40 overflow-auto">
            {sessions.map(s => (
              <div key={s.sessionId} className={`flex items-center gap-1 text-xs p-1 rounded ${s.sessionId === activeSessionId ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-gray-100 dark:hover:bg-neutral-800'}`}> 
                {renamingId === s.sessionId ? (
                  <form onSubmit={submitRename} className="flex gap-1 flex-1">
                    <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} className="flex-1 border rounded px-1" />
                    <button type="submit" className="px-1 text-green-600">✔</button>
                    <button type="button" onClick={() => setRenamingId(null)} className="px-1 text-gray-500">✕</button>
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex-1 text-left truncate"
                      title={s.title}
                      onClick={() => loadSession(s.sessionId)}
                    >
                      {s.title || 'Untitled'}
                    </button>
                    <button type="button" onClick={() => startRename(s)} className="text-blue-600 px-1" aria-label="Rename">✎</button>
                    <button
                      type="button"
                      onClick={() => deleteSession(s.sessionId)}
                      className="text-red-600 px-1"
                      aria-label="Delete session"
                    >×</button>
                  </>
                )}
              </div>
            ))}
            {!sessions.length && <p className="text-[10px] text-gray-500">No sessions yet.</p>}
          </div>
          {totalPages > 1 && (
            <div className="flex justify-between items-center text-[10px] mt-1">
              <button disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))} className="px-1 py-0.5 border rounded disabled:opacity-40">Prev</button>
              <span>Page {page}/{totalPages}</span>
              <button disabled={page>=totalPages} onClick={() => setPage(p => Math.min(totalPages, p+1))} className="px-1 py-0.5 border rounded disabled:opacity-40">Next</button>
            </div>
          )}
        </section>
  )}
        <section className="border rounded-md p-3 space-y-3">
          <h2 className="font-semibold text-sm">Model & Parameters</h2>
          <label className="flex flex-col gap-1">
            <span className="text-xs">Model</span>
            <select
              className="border rounded p-1 text-sm bg-white text-black dark:bg-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={config.model}
              onChange={e => setConfig((c: ModelConfig) => ({ ...c, model: e.target.value }))}
            >
              <option value="gemini-1.5-pro">gemini-1.5-pro</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
            </select>
          </label>
          <Slider
            label="Temperature"
            tooltip="Higher = more creative, lower = deterministic"
            value={config.temperature}
            onChange={v => setConfig((c: ModelConfig) => ({ ...c, temperature: v }))}
          />
          <Slider
            label="Top‑P"
            tooltip="Prob. mass cutoff; lower narrows word choices"
            value={config.topP}
            onChange={v => setConfig((c: ModelConfig) => ({ ...c, topP: v }))}
          />
          <label className="flex flex-col gap-1">
            <span className="text-xs">Max Tokens</span>
            <input
              type="number"
              min={32}
              max={2048}
              value={config.maxTokens}
              onChange={e =>
                setConfig((c: ModelConfig) => ({ ...c, maxTokens: parseInt(e.target.value) || 0 }))
              }
              className="border rounded p-1 text-sm"
            />
          </label>
          <p className="text-xs text-gray-600">
            Temperature + Top‑P typically tuned together. Keep one moderate while
            adjusting the other to observe differences.
          </p>
        </section>
        <section className="border rounded-md p-3 space-y-2">
          <h2 className="font-semibold text-sm">Metrics</h2>
          {pending?.elapsedMs != null && (
            <p><span className="font-mono">Latency:</span> {pending.elapsedMs} ms</p>
          )}
          {pending && (
            <p><span className="font-mono">Tokens:</span> {pending.tokens}</p>
          )}
          <button
            type="button"
            className="text-xs underline"
            onClick={() => setShowDetails(d => !d)}
            aria-expanded={showDetails}
          >
            {showDetails ? 'Hide Details' : 'Show Details'}
          </button>
          {showDetails && (
            <div className="text-xs space-y-1">
              <details open>
                <summary className="cursor-pointer text-sm font-medium">Last Prompt</summary>
                <pre className="whitespace-pre-wrap p-2 bg-gray-50 dark:bg-neutral-800 text-black dark:text-neutral-100 rounded border max-h-32 overflow-auto">{lastPrompt || '—'}</pre>
              </details>
              <details>
                <summary className="cursor-pointer text-sm font-medium">Streaming Output (live)</summary>
                <pre className="whitespace-pre-wrap p-2 bg-gray-50 dark:bg-neutral-800 text-black dark:text-neutral-100 rounded border max-h-40 overflow-auto">{pending?.text || '—'}</pre>
              </details>
            </div>
          )}
        </section>
        <section className="border rounded-md p-3 space-y-2">
          <h2 className="font-semibold text-sm">Safety / Classroom Note</h2>
          <p className="text-xs text-gray-700">
            This demo may produce inaccurate or biased content. Avoid submitting
            sensitive personal data. Parameters are for educational purposes.
          </p>
        </section>
      </aside>
    </div>
  );
}

function MessageBubble({ role, text, streaming }: { role: string; text: string; streaming?: boolean }) {
  const isUser = role === 'user';
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      aria-live={streaming ? 'polite' : undefined}
    >
      <div
        className={`max-w-[70%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm shadow-sm border ${
          isUser
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white dark:bg-neutral-900 border-gray-200 dark:border-neutral-700'
        } ${streaming ? 'animate-pulse-slow' : ''}`}
      >
        <div className="text-[10px] uppercase tracking-wide opacity-60 mb-1">
          {isUser ? 'User' : 'Assistant'}
        </div>
        {text || (streaming ? 'Thinking…' : '')}
      </div>
    </div>
  );
}

function Slider({ label, value, onChange, tooltip }: { label: string; value: number; onChange: (v: number) => void; tooltip: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs flex items-center gap-1">
        {label}
        <span className="text-gray-400" aria-label={tooltip} title={tooltip}>
          ⓘ
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
      <span className="text-[10px] font-mono">{value.toFixed(2)}</span>
    </label>
  );
}
