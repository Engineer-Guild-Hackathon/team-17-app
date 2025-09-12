// app/api/save/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { upsertBooksShallow, addLibraryByBooks, addRecommendedByBooks } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { list, items = [] } = body || {};
    if (!Array.isArray(items) || !items.length) {
      return NextResponse.json({ error: 'no-items' }, { status: 400 });
    }
    if (list !== 'library' && list !== 'recommended') {
      return NextResponse.json({ error: 'invalid-list' }, { status: 400 });
    }

    // 1) 書誌 upsert（books にまとめて反映）
    const savedBooks = await upsertBooksShallow(items); // => [{ id, ... }]
    const bookIds = savedBooks.map((b: any) => b.id);

    // 2) list に応じて片方だけ登録（混入防止）
    let saved = 0;
    if (list === 'library') {
      saved = await addLibraryByBooks(bookIds); // library_items のみ
    } else if (list === 'recommended') {
      // reason が item にあるなら活かす（なければ null）
      saved = await addRecommendedByBooks(bookIds, items.map((it: any) => it.reason || null)); // recommended_items のみ
    }

    return NextResponse.json({ saved });
  } catch (e: any) {
    return NextResponse.json({ error: 'save-failed', detail: e?.message || String(e) }, { status: 500 });
  }
}