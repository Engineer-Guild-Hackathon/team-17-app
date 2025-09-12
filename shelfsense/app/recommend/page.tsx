// app/recommend/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/** ---- small helpers ---- **/
async function fetchJSON(input: any, init?: RequestInit) {
  const res = await fetch(input, init);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: 'invalid-json', body: text }; }
}

function bookLink(b: any) {
  if (b?.source?.info_url) return b.source.info_url as string;
  if (b?.source === 'google' && b?.source_id) {
    return `https://books.google.com/books?id=${encodeURIComponent(b.source_id)}`;
  }
  if (b?.source_id && b?.source === 'openlibrary') {
    return `https://openlibrary.org/${encodeURIComponent(b.source_id)}`;
  }
  const q = [b?.title, (b?.authors || [])[0]].filter(Boolean).join(' ');
  return `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(q)}`;
}

/** ★ おすすめ1冊だけ保存（保存先は Recommended Library） */
async function saveRecommendedOne(item: any, setMsg: (s: string) => void) {
  const res = await fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ list: 'recommended', items: [item] }),
  });
  const json = await res.json();
  if (json?.saved != null) setMsg(`Recommended Library に 1 件保存しました。`);
  else setMsg('保存レスポンス: ' + JSON.stringify(json));
}

/** ---- タイトル入力 → LLM+Web 推薦 ---- **/
function RecommendLLM() {
  const [titles, setTitles] = useState('');
  const [n, setN] = useState(5); // デフォルト5冊
  const [language, setLanguage] = useState<'ja' | 'en'>('ja');
  const [hardness, setHardness] = useState<'auto' | 'easy' | 'normal' | 'hard'>('auto');

  const [resp, setResp] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 直近結果の復元 / 保存（ページ遷移しても残る）
  useEffect(() => {
    try {
      const j = localStorage.getItem('ss_last_llm');
      if (j) setResp(JSON.parse(j));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (resp) localStorage.setItem('ss_last_llm', JSON.stringify(resp));
    } catch {}
  }, [resp]);

  const onSubmit = async (e: any) => {
    e.preventDefault();
    setResp(null);
    setMsg(null);
    setLoading(true);
    const arr = titles.split('\n').map(s => s.trim()).filter(Boolean);
    const json = await fetchJSON('/api/recommend-llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles: arr, n, language, hardness }),
    });
    setResp(json);
    setLoading(false);
  };

  return (
    <div className="space-y-2 p-4 border rounded-xl bg-white">
      <h3 className="font-semibold">LLM+Web 推薦（タイトル入力 / DB不要）</h3>

      <form onSubmit={onSubmit} className="space-y-2">
        <textarea
          className="w-full p-2 rounded-xl border"
          rows={4}
          placeholder={`1行に1冊のタイトルを入力\n例:\n深層学習\nやさしいC++`}
          value={titles}
          onChange={e => setTitles(e.target.value)}
        />
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            冊数
            <input
              type="number"
              min={1}
              max={20}
              className="ml-2 input w-24 p-2 rounded-xl border"
              value={n}
              onChange={e => setN(Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            言語
            <select
              className="ml-2 input p-2 rounded-xl border"
              value={language}
              onChange={e => setLanguage(e.target.value as any)}
            >
              <option value="ja">ja</option>
              <option value="en">en</option>
            </select>
          </label>
          <label className="text-sm">
            難易度
            <select
              className="ml-2 input p-2 rounded-xl border"
              value={hardness}
              onChange={e => setHardness(e.target.value as any)}
            >
              <option value="auto">auto</option>
              <option value="easy">easy</option>
              <option value="normal">normal</option>
              <option value="hard">hard</option>
            </select>
          </label>
          <button className="btn px-4 py-2 border rounded-xl" disabled={loading}>
            {loading ? '生成中…' : '生成（LLM+Web）'}
          </button>
        </div>
      </form>

      {/* 読み取った本（候補） → Library 保存（従来どおり） */}
      {resp?.resolved?.length ? (
        <div className="space-y-2">
          <h4 className="font-medium">読み取った本（候補） {resp.resolved.length}件</h4>
          <ul className="space-y-2 text-sm">
            {resp.resolved.map((b: any, i: number) => (
              <li key={i} className="p-2 border rounded-md">
                <div className="font-semibold">
                  <a href={bookLink(b)} target="_blank" rel="noreferrer" className="hover:underline">
                    {b.title}
                  </a>
                </div>
                <div className="text-gray-600">{(b.authors || []).join(', ')}</div>
                <div className="text-xs text-gray-500">{b.isbn13 || ''}</div>
                <div className="mt-2 flex gap-2">
                  <button
                    className="btn px-2 py-1 border rounded"
                    onClick={async () => {
                      setMsg(null);
                      const json = await fetchJSON('/api/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ list: 'library', items: [b] }),
                      });
                      setMsg(json?.saved != null ? 'Library に 1 件保存しました。' : '保存レスポンス: ' + JSON.stringify(json));
                    }}
                  >
                    ＋ Library 保存（この1冊）
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* おすすめ（各本ごとボタンのみ / 保存先は Recommended Library） */}
      {resp?.recommendations?.length ? (
        <div className="space-y-2">
          <h4 className="font-medium">おすすめ（{resp.recommendations.length}件）</h4>

          <ul className="space-y-2 text-sm">
            {resp.recommendations.map((r: any, i: number) => (
              <li key={i} className="p-2 border rounded-md">
                <div className="font-semibold">
                  <a href={bookLink(r)} target="_blank" rel="noreferrer" className="hover:underline">
                    {r.title}
                  </a>
                </div>
                <div className="text-gray-600">{(r.authors || []).join(', ')}</div>
                <div className="text-xs mt-1 whitespace-pre-wrap">{r.reason}</div>
                {/* ★ relatedTo を理由の直下に表示 */}
                {r.relatedTo?.length ? (
                  <div className="text-[11px] text-gray-500 mt-1">
                    関連: {r.relatedTo.join(', ')}
                  </div>
                ) : null}
                <div className="mt-2">
                  {/* ラベルは「＋ Library に追加」だが、保存先は recommended */}
                  <button
                    className="btn px-2 py-1 border rounded"
                    onClick={() => saveRecommendedOne(r, (m) => setMsg(m))}
                  >
                    ＋ Library に追加（この1冊）
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {resp && (
        <details className="text-xs">
          <summary className="cursor-pointer select-none">RAW JSON</summary>
          <pre className="whitespace-pre-wrap max-h-80 overflow-auto">
            {JSON.stringify(resp, null, 2)}
          </pre>
        </details>
      )}
      {msg && <p className="text-xs text-green-700">{msg}</p>}
    </div>
  );
}

/** ---- 画像1枚 → LLM+Web 推薦 ---- **/
function RecommendFromImage() {
  const [file, setFile] = useState<File | null>(null);
  const [n, setN] = useState(5); // デフォルト5冊
  const [language, setLanguage] = useState<'ja' | 'en'>('ja');
  const [hardness, setHardness] = useState<'auto' | 'easy' | 'normal' | 'hard'>('auto');

  const [resp, setResp] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // 直近結果の復元 / 保存（ページ遷移しても残る）
  useEffect(() => {
    try {
      const j = localStorage.getItem('ss_last_img');
      if (j) setResp(JSON.parse(j));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (resp) localStorage.setItem('ss_last_img', JSON.stringify(resp));
    } catch {}
  }, [resp]);

  const onSubmit = async (e: any) => {
    e.preventDefault();
    if (!file) return;
    setResp(null);
    setMsg(null);
    setLoading(true);
    const fd = new FormData();
    fd.append('image', file);
    fd.append('n', String(n));
    fd.append('language', language);
    fd.append('hardness', hardness);
    const json = await fetchJSON('/api/recommend-from-image', { method: 'POST', body: fd });
    setResp(json);
    setLoading(false);
  };

  return (
    <div className="space-y-2 p-4 border rounded-xl bg-white">
      <h3 className="font-semibold">画像1枚から即推薦（背表紙OK / DB不要）</h3>

      <form onSubmit={onSubmit} className="space-y-2">
        <input
          type="file"
          accept="image/*,.heic,.HEIC"
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            冊数
            <input
              type="number"
              min={1}
              max={20}
              className="ml-2 input w-24 p-2 rounded-xl border"
              value={n}
              onChange={e => setN(Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            言語
            <select
              className="ml-2 input p-2 rounded-xl border"
              value={language}
              onChange={e => setLanguage(e.target.value as any)}
            >
              <option value="ja">ja</option>
              <option value="en">en</option>
            </select>
          </label>
          <label className="text-sm">
            難易度
            <select
              className="ml-2 input p-2 rounded-xl border"
              value={hardness}
              onChange={e => setHardness(e.target.value as any)}
            >
              <option value="auto">auto</option>
              <option value="easy">easy</option>
              <option value="normal">normal</option>
              <option value="hard">hard</option>
            </select>
          </label>
          <button className="btn px-4 py-2 border rounded-xl" disabled={loading || !file}>
            {loading ? '生成中…' : '生成（画像→LLM+Web）'}
          </button>
        </div>
      </form>

      {/* 画像から確定した本（resolved） → Library 保存（従来どおり） */}
      {resp?.resolved?.length ? (
        <div className="space-y-2">
          <h4 className="font-medium">読み取った本（候補） {resp.resolved.length}件</h4>
          <ul className="space-y-2 text-sm">
            {resp.resolved.map((b: any, i: number) => (
              <li key={i} className="p-2 border rounded-md">
                <div className="font-semibold">
                  <a href={bookLink(b)} target="_blank" rel="noreferrer" className="hover:underline">
                    {b.title}
                  </a>
                </div>
                <div className="text-gray-600">{(b.authors || []).join(', ')}</div>
                <div className="text-xs text-gray-500">{b.isbn13 || ''}</div>
                <div className="mt-2">
                  <button
                    className="btn px-2 py-1 border rounded"
                    onClick={async () => {
                      setMsg(null);
                      const json = await fetchJSON('/api/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ list: 'library', items: [b] }),
                      });
                      setMsg(json?.saved != null ? 'Library に 1 件保存しました。' : '保存レスポンス: ' + JSON.stringify(json));
                    }}
                  >
                    ＋ Library 保存（この1冊）
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* おすすめ（各本ごとボタンのみ / 保存先は Recommended Library） */}
      {resp?.recommendations?.length ? (
        <div className="space-y-2">
          <h4 className="font-medium">おすすめ {resp.recommendations.length}件</h4>

          <ul className="space-y-2 text-sm">
            {resp.recommendations.map((r: any, i: number) => (
              <li key={i} className="p-2 border rounded-md">
                <div className="font-semibold">
                  <a href={bookLink(r)} target="_blank" rel="noreferrer" className="hover:underline">
                    {r.title}
                  </a>
                </div>
                <div className="text-gray-600">{(r.authors || []).join(', ')}</div>
                <div className="text-xs mt-1 whitespace-pre-wrap">{r.reason}</div>
                {/* ★ relatedTo を理由の直下に表示 */}
                {r.relatedTo?.length ? (
                  <div className="text-[11px] text-gray-500 mt-1">
                    関連: {r.relatedTo.join(', ')}
                  </div>
                ) : null}
                <div className="mt-2">
                  {/* ラベルは「＋ Library に追加」だが、保存先は recommended */}
                  <button
                    className="btn px-2 py-1 border rounded"
                    onClick={() => saveRecommendedOne(r, (m) => setMsg(m))}
                  >
                    ＋ Library に追加（この1冊）
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {resp && (
        <details className="text-xs">
          <summary className="cursor-pointer select-none">RAW JSON</summary>
          <pre className="whitespace-pre-wrap max-h-80 overflow-auto">
            {JSON.stringify(resp, null, 2)}
          </pre>
        </details>
      )}
      {msg && <p className="text-xs text-green-700">{msg}</p>}
    </div>
  );
}

/** ---- ページ全体 ---- **/
export default function RecommendPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">おすすめ生成（DB不要モード）</h2>
        <div className="flex gap-3">
          <Link href="/recommended-library" className="text-sm text-blue-600 hover:underline">
            Recommended Library
          </Link>
          <Link href="/library" className="text-sm text-blue-600 hover:underline">
            Library
          </Link>
          <Link href="/" className="text-sm text-blue-600 hover:underline">
            ← ホームへ
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <RecommendLLM />
        <RecommendFromImage />
      </div>
    </div>
  );
}