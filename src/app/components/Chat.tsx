"use client";
// Chat UI: messages list, streaming assistant reply, controls panel.
// Teaching comments inline; kept in a single component tree for clarity.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage, ModelConfig, StreamEnvelope } from '../../lib/types';

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
            // Commit assistant message.
            setMessages(m => [...m, { role: 'assistant', content: fullText }]);
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
  }, [userInput, messages, config, streaming]);

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
