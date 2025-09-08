// app/api/recommend-llm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { searchGoogleBooks, searchOpenLibrary } from '@/lib/books';
import { upsertBooksShallow } from '@/lib/db';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

export const runtime = 'nodejs';

const Rec = z.object({
  title: z.string(),
  authors: z.array(z.string()).optional(),
  reason: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.object({
    api: z.enum(['google', 'openlibrary']).optional(),
    id: z.string().optional(),
    info_url: z.string().url().optional(),
  }).optional(),
});
const Result = z.object({
  extractedSeeds: z.array(z.object({
    title: z.string(),
    authors: z.array(z.string()).optional(),
    year: z.number().optional(),
    description: z.string().optional(),
  })),
  recommendations: z.array(Rec),
});

async function enrichByTitle(title: string, lang = 'ja') {
  const g = await searchGoogleBooks(`intitle:"${title}"`, { orderBy: 'relevance', langRestrict: lang });
  if (g.length) return g[0];
  const o = await searchOpenLibrary(title);
  return o[0];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { titles = [], n = 8, language = 'ja', hardness = 'auto' } = body || {};
    if (!Array.isArray(titles) || !titles.length) {
      return NextResponse.json({ error: 'titles required' }, { status: 400 });
    }

    // 1) タイトルを軽く正規化して書誌を補強
    const seeds: any[] = [];
    for (const t of titles) {
      const e = await enrichByTitle(String(t), language);
      if (e?.title) {
        seeds.push({
          title: e.title,
          authors: e.authors || [],
          year: e.published_year || undefined,
          description: e.description || '',
        });
      } else {
        seeds.push({ title: String(t) });
      }
    }

    // 2) 候補プールをWebから収集（最大60件）
    const queries = new Set<string>();
    for (const s of seeds) {
      queries.add(`intitle:"${s.title}"`);
      if (s.authors?.[0]) queries.add(`inauthor:"${s.authors[0]}"`);
      const head = s.title.split(/[：:\-\s]/)[0]?.slice(0, 12) || s.title.slice(0, 12);
      queries.add(head);
    }
    const pool: any[] = [];
    for (const q of Array.from(queries).slice(0, 6)) {
      const [g, o] = await Promise.all([
        searchGoogleBooks(q, { orderBy: q.length < 5 ? 'newest' : 'relevance', langRestrict: language }),
        searchOpenLibrary(q),
      ]);
      pool.push(...g, ...o);
    }
    const seen = new Set<string>();
    const candidates = pool.filter((b) => {
      const key = `${b.source}:${b.source_id || b.isbn13 || b.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 60);

    // ★ 入力の“種”に該当するものを薄く保存（最大20件）
    try {
      const rowsToSave = candidates
        .filter(c => seeds.some(s => s.title && c.title && c.title.includes(s.title)))
        .slice(0, 20)
        .map((b: any) => ({
          title: b.title,
          authors: b.authors,
          isbn13: b.isbn13 || null,
          language: b.language || null,
          published_year: b.published_year || null,
          description: b.description || '',
          cover_url: b.cover_url || '',
          source: b.source,
          source_id: b.source_id || null,
          metadata: b.metadata || {},
        }));
      if (rowsToSave.length) await upsertBooksShallow(rowsToSave);
    } catch {}

    // 3) LLMで最終選定（厳格JSON）
    const seedText = seeds.map(s =>
      `- ${s.title}${s.authors?.length ? ` / ${s.authors.join(', ')}` : ''}${s.year ? ` (${s.year})` : ''}`
    ).join('\n');
    const listText = candidates.map((b, i) =>
      `${i + 1}. ${b.title} / ${(b.authors || []).join(', ')}${b.published_year ? ` (${b.published_year})` : ''}\n` +
      `${b.description ? `   ${b.description.slice(0, 180)}…\n` : ''}`
    ).join('\n');

    const { object } = await generateObject({
      model: openai('gpt-4o'),
      schema: Result,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text:
            [
              'あなたは読書コンシェルジュです。以下の「参考本リスト」を好みの手がかりに、',
              `候補リストから ${n} 冊を日本語で推薦してください。`,
              `難易度の希望: ${hardness} / 言語優先: ${language}`,
              '各推薦には1〜2文の理由を。必ずスキーマどおりの厳格JSONで。'
            ].join(' ')
          },
          { type: 'text', text: `【参考本リスト】\n${seedText}` },
          { type: 'text', text: `【候補リスト（最大60件）】\n${listText}` },
        ]
      }],
    });

    // 推薦に source 情報を付与
    const out = object?.recommendations?.map((r) => {
      const hit = candidates.find(c =>
        c.title?.toLowerCase() === r.title.toLowerCase() ||
        (r.authors?.[0] && (c.authors || [])[0]?.toLowerCase() === r.authors[0].toLowerCase())
      );
      if (hit) {
        r.source = {
          api: hit.source,
          id: hit.source_id || hit.isbn13 || '',
          info_url: hit.source === 'google'
            ? (hit.metadata?.infoLink || (hit.source_id ? `https://books.google.com/books?id=${encodeURIComponent(hit.source_id)}` : undefined))
            : (hit.metadata?.info_url || ''),
        };
      }
      return r;
    }) || [];

    return NextResponse.json({ extractedSeeds: seeds, recommendations: out.slice(0, n) });
  } catch (e: any) {
    return NextResponse.json({ error: 'recommend-llm-failed', detail: e?.message || String(e) }, { status: 500 });
  }
}