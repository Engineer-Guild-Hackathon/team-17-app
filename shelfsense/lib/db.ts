// lib/db.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // サーバのみ
export const supabase = createClient(url, key, { auth: { persistSession: false } });

export type BookRow = {
  title: string;
  authors?: string[];
  isbn13?: string | null;
  language?: string | null;
  published_year?: number | null;
  description?: string | null;
  cover_url?: string | null;
  source: 'google'|'openlibrary'|'manual';
  source_id?: string | null;
  metadata?: any;
};

/** 埋め込み不要の薄い upsert（source,source_id で衝突回避） */
export async function upsertBooksShallow(rows: BookRow[]) {
  const clean = rows.map(r => ({ ...r, metadata: r.metadata ?? {} }));
  const { data, error } = await supabase
    .from('books').upsert(clean, { onConflict: 'source,source_id' })
    .select('id,title');
  if (error) throw error;
  return data;
}

export async function listBooks(limit = 200) {
  const { data, error } = await supabase
    .from('books')
    .select('id,title,authors,cover_url,isbn13,source,source_id')
    .order('title', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}