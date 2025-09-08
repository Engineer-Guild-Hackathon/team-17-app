// app/api/extract/route.ts
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { ocrImage } from '@/lib/ocr';
import { extractCandidatesFromText } from '@/lib/ai';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('image') as File | null;
    if (!file) return NextResponse.json({ error: 'image required' }, { status: 400 });

    // HEIC/JPEG/PNG等 → autorotate + 軽い前処理
    let buf = Buffer.from(await file.arrayBuffer());
    let img = sharp(buf).rotate().grayscale().normalize();
    const meta = await img.metadata();
    // 背表紙は細いので最低幅を確保
    if ((meta.width || 0) < 1200) img = img.resize({ width: 1600, withoutEnlargement: false });
    buf = await img.jpeg({ quality: 85 }).toBuffer();

    const lines = await ocrImage(buf);
    const text = lines.join('\n');
    const candidates = await extractCandidatesFromText(text);

    return NextResponse.json({ ocr: { lines }, candidates });
  } catch (e: any) {
    return NextResponse.json({ error: 'extract-failed', detail: e?.message || String(e) }, { status: 500 });
  }
}