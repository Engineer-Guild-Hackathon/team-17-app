// lib/ocr.ts
import Tesseract from 'tesseract.js';

/** 画像バッファからOCR。縦書き日本語＋英語を同時認識 */
export async function ocrImage(buf: Buffer): Promise<string[]> {
  const { data } = await Tesseract.recognize(buf, 'jpn_vert+jpn+eng', {
    // 端末によっては最初の実行時に言語データをCDNから取得します
  });
  // 行テキストを優先、なければ全文を改行分割
  const lines = (data.lines?.map(l => l.text) ?? data.text.split('\n'))
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => s.length >= 2);
  // ノイズ抑制（短すぎる数字のみ等を除外）
  return lines.filter(s => !/^[\W_]*$/.test(s)).slice(0, 120);
}