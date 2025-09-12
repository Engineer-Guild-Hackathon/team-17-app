// app/recommended/page.tsx
import Link from 'next/link';
import { listRecommended } from '@/lib/db';

export default async function RecommendedPage() {
  const rows = await listRecommended(100);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Recommended（おすすめ保存）</h2>
        <Link href="/" className="text-sm text-blue-600 hover:underline">← ホームへ</Link>
      </div>
      {!rows.length && <p className="text-sm text-gray-600">まだ保存されたおすすめはありません。</p>}
      <ul className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {rows.map((r: any) => (
          <li key={r.id} className="p-3 border rounded-xl bg-white">
            <div className="flex gap-3">
              {r.book?.cover_url
                ? <img src={r.book.cover_url} alt={r.book.title} className="w-16 h-24 object-cover rounded" />
                : <div className="w-16 h-24 bg-gray-200 rounded flex items-center justify-center text-xs">No image</div>}
              <div className="min-w-0">
                <div className="font-semibold text-sm">{r.book?.title}</div>
                <div className="text-xs text-gray-600">{(r.book?.authors || []).join(', ')}</div>
                <div className="text-[10px] text-gray-500 mt-1">{r.book?.isbn13 || ''}</div>
                <div className="text-[10px] text-gray-500 mt-2 line-clamp-3">{r.reason || ''}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}