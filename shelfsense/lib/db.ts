// lib/db.ts
import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only
if (!url || !key) throw new Error('Supabase URL or SERVICE_ROLE key is missing. Check .env.local');

export const supabase = createClient(url, key, { auth: { persistSession: false } });

type BookRow = {
  id?: string;
  title: string;
  authors?: string[];
  isbn13?: string | null;
  language?: string | null;
  published_year?: number | null;
  description?: string | null;
  cover_url?: string | null;
  source?: 'google'|'openlibrary'|'manual'|null;
  source_id?: string | null;
  metadata?: any;
};

export async function upsertBooksShallow(rows: BookRow[]) {
  if (!rows?.length) return [];
  const { data, error } = await supabase
    .from('books')
    .upsert(
      rows.map(r => ({
        title: r.title,
        authors: r.authors || [],
        isbn13: r.isbn13 || null,
        language: r.language || null,
        published_year: r.published_year ?? null,
        description: r.description || '',
        cover_url: r.cover_url || '',
        source: r.source || 'manual',
        source_id: r.source_id || null,
        metadata: r.metadata || {}
      })),
      { onConflict: 'source,source_id' }
    )
    .select('id,title,authors,isbn13,language,published_year,description,cover_url,source,source_id');
  if (error) throw error;
  return data!;
}

/* ===== Library（独立） ===== */

export async function listLibrary(limit = 500) {
  const { data, error } = await supabase
    .from('library_items')
    .select('id, created_at, book:books(id,title,authors,isbn13,cover_url,description,language,published_year,source,source_id)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data!;
}

export async function getLibraryBookIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('library_items').select('book_id');
  if (error) throw error;
  return new Set((data || []).map((d: any) => d.book_id));
}

export async function addLibraryByBooks(bookIds: string[]) {
  if (!bookIds?.length) return 0;
  const rows = bookIds.map(id => ({ book_id: id }));
  const { data, error } = await supabase.from('library_items').upsert(rows, { onConflict: 'book_id' }).select('id');
  if (error) throw error;
  return data?.length || 0;
}

export async function toggleLibrary(bookId: string) {
  const { data, error } = await supabase.from('library_items').select('id').eq('book_id', bookId).maybeSingle();
  if (error) throw error;
  if (data?.id) {
    const del = await supabase.from('library_items').delete().eq('id', data.id);
    if (del.error) throw del.error;
    return { status: 'removed' as const };
  } else {
    const ins = await supabase.from('library_items').insert({ book_id: bookId }).select('id').single();
    if (ins.error) throw ins.error;
    return { status: 'added' as const };
  }
}

/* ===== Recommended（独立） ===== */

export async function listRecommended(limit = 200) {
  const { data, error } = await supabase
    .from('recommended_items')
    .select('id,reason,created_at,book:books(id,title,authors,isbn13,cover_url,description,language,published_year,source,source_id)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data!;
}

export async function getRecommendedBookIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('recommended_items').select('book_id');
  if (error) throw error;
  return new Set((data || []).map((d: any) => d.book_id));
}

export async function addRecommendedByBooks(bookIds: string[], reasons?: Record<string, string>) {
  if (!bookIds.length) return 0;
  const rows = bookIds.map(id => ({ book_id: id, reason: reasons?.[id] || null }));
  const { data, error } = await supabase
    .from('recommended_items')
    .upsert(rows, { onConflict: 'book_id' })
    .select('id');
  if (error) throw error;
  return data?.length || 0;
}

export async function toggleRecommended(bookId: string) {
  const { data, error } = await supabase.from('recommended_items').select('id').eq('book_id', bookId).maybeSingle();
  if (error) throw error;
  if (data?.id) {
    const del = await supabase.from('recommended_items').delete().eq('id', data.id);
    if (del.error) throw del.error;
    return { status: 'removed' as const };
  } else {
    const ins = await supabase.from('recommended_items').insert({ book_id: bookId }).select('id').single();
    if (ins.error) throw ins.error;
    return { status: 'added' as const };
  }
}