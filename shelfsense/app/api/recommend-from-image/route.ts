// app/api/recommend-from-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { extractBooksFromImage } from '@/lib/ai';
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
    api: z.enum(['google','openlibrary']).optional(),
    id: z.string().optional(),
    info_url: z.string().url().optional(),
  }).optional(),
});
const Result = z.object({
  extractedSeeds: z.array(z.object({
    title: z.string().optional(),
    authors: z.array(z.string()).optional(),
    isbn: z.string().optional(),
    confidence: z.number().optional(),
  })),
  recommendations: z.array(Rec),
});

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('image') as File | null;
    const n = Number(form.get('n') || 8);
    const language = String(form.get('language') || 'ja');
    const hardness = String(form.get('hardness') || 'auto');
    if (!file) return NextResponse.json({ error: 'image required' }, { status: 400 });

    // HEIC等 → JPEG + autorotate + 最低幅補正
    let buf = Buffer.from(await file.arrayBuffer());
    let img = sharp(buf).rotate();
    const meta = await img.metadata();
    if ((meta.width || 0) < 1200) img = img.resize({ width: 1600, withoutEnlargement: false });
    buf = await img.jpeg({ quality: 85 }).toBuffer();
    const base64 = `data:image/jpeg;base64,${buf.toString('base64')}`;

    // 1) 画像から候補抽出
    const seeds = await extractBooksFromImage(base64); // [{title?, authors?, isbn?, confidence?}, ...]

    // 2) 抽出が薄くても、タイトル/著者/ISBNを使って候補プールをWebから収集
    const queries = new Set<string>();
    for (const s of seeds.slice(0, 8)) {
      if (s.isbn) queries.add(`isbn:${s.isbn}`);
      if (s.title) queries.add(`intitle:"${s.title}"`);
      if (s.authors?.[0]) queries.add(`inauthor:"${s.authors[0]}"`);
      if (s.title) {
        const head = s.title.split(/[：:\-\s]/)[0]?.slice(0, 12) || s.title.slice(0, 12);
        queries.add(head);
      }
    }
    if (queries.size === 0) queries.add('programming'); // 最低限の保険

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

    // ★ 検出して突合できた本を薄く保存（最大20件）
    try {
      const rowsToSave = candidates.slice(0, 20).map((b: any) => ({
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
      `- ${s.title || '(title?)'}${s.authors?.length ? ` / ${s.authors.join(', ')}` : ''}${s.isbn ? ` [ISBN:${s.isbn}]` : ''}`
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
              'この画像から推測できた本を参考に、候補リストから',
              `${n} 冊、日本語で推薦してください。`,
              `難易度: ${hardness} / 言語優先: ${language}`,
              '理由も1〜2文で。抽出が不完全でも推測OK。',
              '必ず厳格JSONで出力。'
            ].join(' ')
          },
          { type: 'text', text: `【抽出候補（画像から）】\n${seedText || '(empty)'}` },
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

    return NextResponse.json({
      extractedSeeds: seeds,
      recommendations: out.slice(0, n),
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'recommend-from-image-failed', detail: e?.message || String(e) }, { status: 500 });
  }
}