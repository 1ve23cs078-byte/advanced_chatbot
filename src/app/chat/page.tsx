import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { redirect } from 'next/navigation';
import { Chat } from '../components/Chat';

export const metadata = { title: 'Chat • GenAI Sandbox' };

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/?signin=1');
  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <header className="space-y-2 mb-4">
        <h1 className="text-2xl font-bold">Chat Playground</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-2xl">
          Adjust parameters and observe streaming behavior. Saved sessions are private to your account.
        </p>
      </header>
      <Chat />
    </main>
  );
}
