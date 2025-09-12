// app/recommended-library/page.tsx
import Link from 'next/link';
import { supabase } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 書誌行から表紙URLを導出（フォールバックあり） */
function coverUrlFromBook(b: any): string | null {
  if (b?.cover_url) return b.cover_url;
  if (b?.source === 'google' && b?.source_id) {
    return `https://books.google.com/books/content?id=${encodeURIComponent(
      b.source_id
    )}&printsec=frontcover&img=1&zoom=1`;
  }
  if (b?.source === 'openlibrary' && b?.source_id) {
    const olid = String(b.source_id).replace(/^OLID:/i, '');
    return `https://covers.openlibrary.org/b/olid/${encodeURIComponent(olid)}-M.jpg`;
  }
  return null;
}

/** 書誌行から外部の情報ページURLを導出 */
function infoLinkFromBook(b: any): string | null {
  const info = b?.metadata?.infoLink || b?.metadata?.info_url;
  if (info) return info as string;

  if (b?.source === 'google' && b?.source_id) {
    return `https://books.google.com/books?id=${encodeURIComponent(b.source_id)}`;
  }
  if (b?.source === 'openlibrary') {
    const key = String(b?.metadata?.key || b?.source_id || '').replace(/^OLID:/i, '');
    if (key) {
      if (key.startsWith('/works/')) return `https://openlibrary.org${key}`;
      return `https://openlibrary.org/books/${encodeURIComponent(key)}`;
    }
  }

  const q = [b?.title, (b?.authors || [])[0]].filter(Boolean).join(' ');
  if (q) return `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(q)}`;
  return null;
}

export default async function RecommendedLibraryPage() {
  // recommended_items に紐づく books を取得
  const { data, error } = await supabase
    .from('recommended_items')
    .select('id, created_at, reason, books(*)')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Recommended Library</h2>
        <p className="text-red-600 text-sm">読み込みエラー: {error.message}</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← ホームへ
        </Link>
      </div>
    );
  }

  // 取得結果をフラット化
  const rowsRaw =
    (data || []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      reason: r.reason,
      book: r.books,
    })) || [];

  // ★ 重複防止（同一 book_id を1回だけ表示）
  const seen = new Set<string>();
  const rows = rowsRaw.filter((r) => {
    const bid = r.book?.id as string | undefined;
    if (!bid) return true; // book が取れない異常系はそのまま通す
    if (seen.has(bid)) return false;
    seen.add(bid);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Recommended Library</h2>
        <div className="flex gap-3">
          <Link href="/library" className="text-sm text-blue-600 hover:underline">
            Library
          </Link>
          <Link href="/recommend" className="text-sm text-blue-600 hover:underline">
            おすすめ生成へ
          </Link>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← ホームへ
          </Link>
        </div>
      </div>

      {!rows.length ? (
        <p className="text-sm text-gray-500">
          まだおすすめは保存されていません。おすすめ生成ページから保存してみてください。
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const b = r.book;
            const img = coverUrlFromBook(b);
            const href = infoLinkFromBook(b) || '#';
            return (
              <li key={r.id} className="p-3 border rounded-xl bg-white flex gap-3 items-start">
                {img ? (
                  <img src={img} alt={b.title} className="w-16 h-24 object-cover rounded" />
                ) : (
                  <div className="w-16 h-24 bg-gray-200 rounded flex items-center justify-center text-xs">
                    No image
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold break-words">
                    <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
                      {b.title}
                    </a>
                  </div>
                  <div className="text-sm text-gray-600">{(b.authors || []).join(', ')}</div>
                  <div className="text-xs text-gray-500">{b.isbn13 || ''}</div>
                  {r.reason ? (
                    <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{r.reason}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}