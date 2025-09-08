// app/library/page.tsx  ※サーバーコンポーネント
import Image from 'next/image';
import Link from 'next/link';
import { listBooks } from '@/lib/db';

export default async function LibraryPage() {
  const books = await listBooks(500); // title, authors, cover_url 等

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Library（読み込んだ本）</h2>
        <Link href="/" className="text-sm text-blue-600 hover:underline">← ホームへ</Link>
      </div>
      {!books.length && <p className="text-sm text-gray-600">まだ本がありません。バーコード、タイトル入力、画像推薦をお試しください。</p>}
      <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {books.map((b: any) => (
          <li key={b.id} className="p-3 border rounded-xl bg-white">
            <div className="flex gap-3">
              {b.cover_url ? (
                // next/image でも <img> でも可
                <img src={b.cover_url} alt={b.title} className="w-16 h-24 object-cover rounded" />
              ) : (
                <div className="w-16 h-24 bg-gray-200 rounded flex items-center justify-center text-xs">No image</div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-sm">{b.title}</div>
                <div className="text-xs text-gray-600">{(b.authors || []).join(', ')}</div>
                <div className="text-[10px] text-gray-500 mt-1">{b.isbn13 || ''}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}