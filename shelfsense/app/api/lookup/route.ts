import { NextRequest, NextResponse } from 'next/server';
import { searchGoogleBooks, searchOpenLibrary } from '@/lib/books';
import { upsertBooks } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const isbn = searchParams.get('isbn') || '';
    const q = searchParams.get('q') || '';
    const query = isbn ? `isbn:${isbn}` : q;
    if (!query) return NextResponse.json({ error: 'isbn or q required' }, { status: 400 });

    const [g, o] = await Promise.all([searchGoogleBooks(query), searchOpenLibrary(query)]);
    const matches = [...g, ...o];
    if (matches.length) {
      try { await upsertBooks(matches.slice(0, 3)); } catch (e: any) {
        // upsert 失敗時も matches は返す
        return NextResponse.json({ matches, saved: 0, upsertError: e?.message || String(e) }, { status: 200 });
      }
    }
    return NextResponse.json({ matches, saved: Math.min(matches.length, 3) });
  } catch (e: any) {
    return NextResponse.json({ error: 'lookup-failed', detail: e?.message || String(e) }, { status: 500 });
  }
}