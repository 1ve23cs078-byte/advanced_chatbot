## GenAI Basics Chatbot (Teaching Demo)

An instructor‑friendly Next.js (App Router) project demonstrating core Generative AI interaction patterns:

- Prompt → streaming response loop
- Model selection (Gemini variants)
- Sampling parameters: temperature & top‑p
- Token & latency observability
- Secure server‑only API key handling (Route Handlers)
- Minimal, accessible chat UI with progressive streaming

Day 1 scope deliberately excludes: function calling, tools, grounding, auth, persistence.

---

## 1. Why Next.js for AI

Next.js App Router provides:

- Server Components by default → keep secrets server‑side, smaller client bundles.
- Route Handlers (`app/api/.../route.ts`) for backend logic without a separate server.
- Native streaming (Edge / Node) for perceived latency improvements.
- Co-located UI + server logic for teaching clarity.

---

## 2. Setup

1. Install dependencies:
```bash
npm install
```
2. Copy environment file:
```bash
cp .env.example .env.local
```
3. Add your Gemini API key to `.env.local`:
```
GEMINI_API_KEY=your_key_here
```
4. Start dev server:
```bash
npm run dev
```
5. Open: http://localhost:3000

---

## 3. File Tour

| Path | Purpose |
|------|---------|
| `app/page.tsx` | Landing + chat shell (client component imports). |
| `app/components/Chat.tsx` | Chat UI, streaming ingestion, parameter controls, metrics. |
| `app/api/chat/route.ts` | Server Route Handler: validates request, calls Gemini streaming API, emits SSE‑like tokens. |
| `lib/ai/gemini.ts` | Server helper to init SDK (central secret usage). |
| `lib/types.ts` | Shared TypeScript types (messages, config, stream envelopes). |
| `.env.example` | Template for environment variables. |

Keep total file count small for classroom readability.

---

## 4. How Streaming Works

1. Client sends POST `/api/chat` with messages + parameters.
2. Route Handler calls `generateContentStream` on the Gemini SDK.
3. For each streamed chunk: we extract `chunk.text()` and flush a line prefixed with `data:` (Server‑Sent Events style) back to the browser.
4. Client parses each line, appends partial text live.
5. Final meta line includes approximate token count & elapsed ms.

Benefit: Students see words appear before the full answer is ready → improved perceived latency and engagement.

---

## 5. Parameters to Experiment With

| Parameter | Effect | Teaching Tip |
|-----------|--------|--------------|
| Temperature | Controls randomness of sampling | Compare 0 vs 0.9 on creative prompts. |
| Top‑P | Cuts off low‑probability tail | Show interplay: fix Temp=0.7 and adjust Top‑P 1 → 0.5. |
| Max Tokens | Output length cap | Demonstrate truncation and iterative prompting. |

Encourage students to vary one at a time and observe tone, determinism, and structure changes.

---

## 6. Security Checklist

- ✅ API key only referenced in `lib/ai/gemini.ts` (server context).
- ✅ Environment variables loaded from `.env.local` (never committed).
- ✅ No direct client calls to Gemini; browser only hits `/api/chat`.
- ✅ Streaming uses lightweight SSE; no key leakage in payload.
- ✅ System prompt kept simple; no sensitive data stored.

---

## 7. Observability & Metrics

- Approx token counter increments per streamed chunk (teaching simplification; not exact tokenizer).
- Latency recorded once stream closes (time from request start to final chunk).
- Collapsible panel shows raw prompt and the live streaming buffer for inspection.

Discuss extension ideas: precise token counting via model API metadata, cost display, per‑chunk latency histogram.

---

## 8. Extending After Day 1

| Next Step | Description |
|-----------|-------------|
| Function Calling | Allow model to request tool invocation / structured responses. |
| Grounding / RAG | Inject retrieved documents for factual answers. |
| Multi‑Modal | Add image or audio inputs (Gemini supports). |
| Moderation Layer | Pre/post content filtering and audit logging. |
| Persistence | Save conversation state to a DB for later review. |
| Auth & Rate Limits | Protect keys and control usage quotas. |

---

## 9. Instructor Demo Flow

1. Show directory tree → highlight `api/chat` & `lib/ai/gemini.ts`.
2. Open browser → ask a deterministic factual question (Temp=0).
3. Repeat with higher temperature → highlight creative variance.
4. Lower Top‑P → observe more conservative wording.
5. Short max tokens (e.g. 32) → show truncation → ask students how to continue.
6. Toggle details panel → show raw prompt & partial buffer mid‑stream.
7. Emphasize server boundary & secret handling.

Discussion prompts:
* Why stream vs wait for full answer?
* How would we add retrieval grounding safely?
* What are ethical considerations when letting students query a model?

---

## 10. API Contract (Client → Server)

POST `/api/chat`
```json
{
	"messages": [{"role":"user","content":"Hello"}],
	"model": "gemini-1.5-pro",
	"temperature": 0.7,
	"topP": 0.9,
	"maxTokens": 256
}
```

Streamed response: lines prefixed with `data:` (SSE style)
```
data: {"type":"token","data":"Hello"}
...
data: {"type":"meta","data":{"tokens":42,"elapsedMs":812}}
data: [DONE]
```

---

## 11. Accessibility Notes

- Live region for streaming assistant bubble when active.
- Visible focus outline via `:focus-visible`.
- Semantic buttons + labels.

---

## 12. Troubleshooting

| Symptom | Fix |
|---------|-----|
| 401 / 500 from `/api/chat` | Ensure `GEMINI_API_KEY` set and valid. |
| Empty streaming | Check console for network errors; verify no ad‑block interference. |
| Token count seems off | It is approximate: per chunk, not tokenizer accurate. |
| Import error for SDK | Run `npm install`. |

---

## 13. License & Attribution

Educational template. Adapt freely; remove classroom notes for production.

---

Happy teaching! 🎓
