// app/layout.tsx
import './globals.css';
import Link from 'next/link';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <header className="border-b bg-white">
          <nav className="mx-auto max-w-5xl px-4 py-3 flex gap-4 items-center">
            <Link href="/" className="font-semibold">ShelfSense</Link>
            <Link href="/" className="text-sm text-gray-600 hover:text-black">Home</Link>
            <Link href="/recommend" className="text-sm text-gray-600 hover:text-black">Recommend</Link>
            <Link href="/library" className="text-sm text-gray-600 hover:text-black">Library</Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}