// lib/ocr.ts  ← 置き換え
import { createWorker } from 'tesseract.js';

/**
 * Next.js の Node ランタイムで tesseract.js を確実に動かすため、
 * worker/core/lang を CDN 明示。初回だけ数秒かかります。
 */
let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker({
        logger: () => {},
        // 明示的にCDNのパスを使う（バンドルに依存しない）
        workerPath: 'https://unpkg.com/tesseract.js@5.0.3/dist/worker.min.js',
        corePath:   'https://unpkg.com/tesseract.js-core@5.0.0/tesseract-core.wasm.js',
        langPath:   'https://tessdata.projectnaptha.com/4.0.0',
      });
      // 日本語縦書き＋日本語＋英語
      await worker.loadLanguage('jpn_vert+jpn+eng');
      await worker.initialize('jpn_vert+jpn+eng');
      return worker;
    })();
  }
  return workerPromise;
}

/** 画像バッファからOCR行テキストを返す */
export async function ocrImage(buf: Buffer): Promise<string[]> {
  const worker = await getWorker();
  const { data } = await worker.recognize(buf);
  const lines = (data.lines?.map((l: any) => l.text) ?? data.text.split('\n'))
    .map((s: string) => s.replace(/\s+/g, ' ').trim())
    .filter((s: string) => s.length >= 2 && !/^[\W_]*$/.test(s));
  return lines.slice(0, 120);
}

/** 必要なら終了させるための関数（現状呼ばなくてOK） */
export async function terminateOcr() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}