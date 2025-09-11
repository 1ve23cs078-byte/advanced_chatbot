import { Chat } from './components/Chat';

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">GenAI Basics Chatbot</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">
          Teaching demo highlighting: prompt → streaming response, model selection, temperature & top‑p sampling, token/latency metrics, and secure server-side API usage via Next.js Route Handlers.
        </p>
        <p className="text-xs text-gray-500">
          Explore parameter effects. Open the side panel (desktop) for controls and metrics. Mobile: rotate or widen to view controls.
        </p>
      </header>
      <Chat />
    </main>
  );
}
