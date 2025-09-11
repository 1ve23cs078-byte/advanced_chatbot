import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function Landing() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-16 space-y-16">
      <section className="space-y-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Explore Generative AI Parameters Interactively</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          A teaching sandbox for understanding model temperature, top‑p sampling, token latency, and streaming behavior using Google Gemini.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/chat" className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-blue-600 text-white font-medium shadow hover:bg-blue-500 transition">
            Launch Chat <ArrowRight size={16} />
          </Link>
          <a href="https://ai.google.dev/" target="_blank" className="inline-flex items-center gap-2 px-6 py-3 rounded-md border font-medium hover:bg-gray-50 dark:hover:bg-neutral-800 transition">
            Gemini Docs
          </a>
        </div>
      </section>
      <section className="grid md:grid-cols-3 gap-8">
        {FEATURES.map(f => (
          <div key={f.title} className="p-5 border rounded-lg bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm space-y-3">
            <div className="text-blue-600 font-semibold text-sm uppercase tracking-wide">{f.tag}</div>
            <h3 className="font-semibold text-lg">{f.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>
      <section className="rounded-xl border bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Ready to experiment?</h2>
          <p className="text-sm opacity-90 max-w-md">Open the chat playground, tweak parameters live, and observe the differences in generation style, determinism and latency.</p>
        </div>
        <Link href="/chat" className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-white text-blue-700 font-medium shadow hover:bg-blue-50 transition">
          Go to Chat <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}

const FEATURES = [
  { tag: 'Streaming', title: 'Token‑level Insight', desc: 'See tokens stream in real time with simple latency metrics to build intuition about model throughput.' },
  { tag: 'Controls', title: 'Parameter Playground', desc: 'Adjust temperature, top‑p and max tokens, then compare response style and determinism.' },
  { tag: 'Persistence', title: 'Saved Sessions', desc: 'Login to save, rename, search, and revisit prior conversations for study.' },
];
