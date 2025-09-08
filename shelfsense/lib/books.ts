// lib/books.ts
export async function searchGoogleBooks(
  q: string,
  opts: { max?: number; orderBy?: 'relevance'|'newest'; langRestrict?: string } = {}
) {
  const { max = 10, orderBy = 'relevance', langRestrict } = opts;
  const params = new URLSearchParams({
    q, printType: 'books', maxResults: String(Math.min(max, 40)), orderBy
  });
  if (langRestrict) params.set('langRestrict', langRestrict);
  const url = `https://www.googleapis.com/books/v1/volumes?${params}`;
  const r = await fetch(url);
  const j = await r.json();

  const out = (j.items || []).map((it: any) => {
    const v = it.volumeInfo || {};
    return {
      title: v.title || '',
      authors: v.authors || [],
      isbn13: (v.industryIdentifiers || []).find((x: any) => x.type.includes('ISBN_13'))?.identifier,
      language: v.language || null,
      published_year: v.publishedDate ? Number(String(v.publishedDate).slice(0, 4)) : null,
      description: v.description || '',
      cover_url: v.imageLinks?.thumbnail || '',
      source: 'google' as const,
      source_id: it.id,
      metadata: {
        categories: v.categories || [],
        pageCount: v.pageCount || 0,
        infoLink: v.infoLink || ''
      }
    };
  });
  return out;
}

// 既存の Open Library 関数が無ければ追加
export async function searchOpenLibrary(q: string) {
  const url = `https://openlibrary.org/search.json?${new URLSearchParams({ q, limit: '20' })}`;
  const r = await fetch(url);
  const j = await r.json();
  const docs = j.docs || [];
  return docs.map((d: any) => ({
    title: d.title || '',
    authors: d.author_name || [],
    isbn13: (d.isbn || []).find((x: string) => x.length === 13),
    language: Array.isArray(d.language) ? d.language[0] : null,
    published_year: d.first_publish_year || null,
    description: d.subtitle || '',
    cover_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '',
    source: 'openlibrary' as const,
    source_id: d.key?.replace('/works/', '') || '',
    metadata: { info_url: d.key ? `https://openlibrary.org${d.key}` : '' },
  }));
}