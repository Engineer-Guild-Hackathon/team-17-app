// app/api/lookup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { upsertBooksShallow, addLibraryByBooks } from '@/lib/db';
import { searchGoogleBooks, searchOpenLibrary } from '@/lib/books';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const isbn = searchParams.get('isbn');
  if (!isbn) return NextResponse.json({ error: 'isbn required' }, { status: 400 });

  try {
    const [g, o] = await Promise.all([
      searchGoogleBooks(`isbn:${isbn}`),
      searchOpenLibrary(isbn),
    ]);
    const matches = [...g, ...o];
    // 書誌保存
    const savedRows = await upsertBooksShallow(matches);
    // ★ Library にも登録（従来の「booksだけ保存」だと一覧に出ないため）
    const savedCount = await addLibraryByBooks(savedRows.map((r: any) => r.id));

    return NextResponse.json({ matches: savedRows, saved: savedCount });
  } catch (e: any) {
    return NextResponse.json({ error: 'lookup-failed', detail: e?.message || String(e) }, { status: 500 });
  }
}