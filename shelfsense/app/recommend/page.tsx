'use client';
import Link from 'next/link';
import { useState } from 'react';

async function fetchJSON(input: RequestInfo | URL, init?: RequestInit) {
  const res = await fetch(input, init);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { error: 'invalid-json', body: text }; }
}

function RecommendLLM() {
  const [titles, setTitles] = useState('');
  const [n, setN] = useState(8);
  const [language, setLanguage] = useState<'ja'|'en'>('ja');
  const [hardness, setHardness] = useState<'auto'|'easy'|'normal'|'hard'>('auto');
  const [resp, setResp] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResp(null); setLoading(true);
    const arr = titles.split('\n').map(s => s.trim()).filter(Boolean);
    const json = await fetchJSON('/api/recommend-llm', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ titles: arr, n, language, hardness })
    });
    setResp(json); setLoading(false);
  };

  return (
    <div className="space-y-2 p-4 border rounded-xl bg-white">
      <h3 className="font-semibold">LLM+Web 推薦（タイトル入力 / DB不要）</h3>
      <form onSubmit={onSubmit} className="space-y-2">
        <textarea className="w-full p-2 rounded-xl border" rows={4}
          placeholder={`1行に1冊のタイトルを入力\n例:\n深層学習\nやさしいC++`}
          value={titles} onChange={e=>setTitles(e.target.value)} />
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">冊数
            <input type="number" min={1} max={20} className="ml-2 input w-24 p-2 rounded-xl border"
              value={n} onChange={e=>setN(Number(e.target.value))} />
          </label>
          <label className="text-sm">言語
            <select className="ml-2 input p-2 rounded-xl border"
              value={language} onChange={e=>setLanguage(e.target.value as any)}>
              <option value="ja">ja</option><option value="en">en</option>
            </select>
          </label>
          <label className="text-sm">難易度
            <select className="ml-2 input p-2 rounded-xl border"
              value={hardness} onChange={e=>setHardness(e.target.value as any)}>
              <option value="auto">auto</option><option value="easy">easy</option>
              <option value="normal">normal</option><option value="hard">hard</option>
            </select>
          </label>
          <button className="btn px-4 py-2 border rounded-xl" disabled={loading}>
            {loading ? '生成中…' : '生成（LLM+Web）'}
          </button>
        </div>
      </form>
      {resp && <pre className="text-xs whitespace-pre-wrap max-h-80 overflow-auto">
        {JSON.stringify(resp, null, 2)}
      </pre>}
    </div>
  );
}

function RecommendFromImage() {
  const [file, setFile] = useState<File | null>(null);
  const [n, setN] = useState(8);
  const [language, setLanguage] = useState<'ja'|'en'>('ja');
  const [hardness, setHardness] = useState<'auto'|'easy'|'normal'|'hard'>('auto');
  const [resp, setResp] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setResp(null); setLoading(true);
    const fd = new FormData();
    fd.append('image', file);
    fd.append('n', String(n));
    fd.append('language', language);
    fd.append('hardness', hardness);
    const json = await fetchJSON('/api/recommend-from-image', { method: 'POST', body: fd });
    setResp(json); setLoading(false);
  };

  return (
    <div className="space-y-2 p-4 border rounded-xl bg-white">
      <h3 className="font-semibold">画像1枚から即推薦（背表紙OK / DB不要）</h3>
      <form onSubmit={onSubmit} className="space-y-2">
        <input type="file" accept="image/*,.heic,.HEIC" onChange={e=>setFile(e.target.files?.[0] || null)} />
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">冊数
            <input type="number" min={1} max={20} className="ml-2 input w-24 p-2 rounded-xl border"
              value={n} onChange={e=>setN(Number(e.target.value))} />
          </label>
          <label className="text-sm">言語
            <select className="ml-2 input p-2 rounded-xl border"
              value={language} onChange={e=>setLanguage(e.target.value as any)}>
              <option value="ja">ja</option><option value="en">en</option>
            </select>
          </label>
          <label className="text-sm">難易度
            <select className="ml-2 input p-2 rounded-xl border"
              value={hardness} onChange={e=>setHardness(e.target.value as any)}>
              <option value="auto">auto</option><option value="easy">easy</option>
              <option value="normal">normal</option><option value="hard">hard</option>
            </select>
          </label>
          <button className="btn px-4 py-2 border rounded-xl" disabled={loading || !file}>
            {loading ? '生成中…' : '生成（画像→LLM+Web）'}
          </button>
        </div>
      </form>
      {resp && <pre className="text-xs whitespace-pre-wrap max-h-80 overflow-auto">
        {JSON.stringify(resp, null, 2)}
      </pre>}
    </div>
  );
}

export default function RecommendPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">おすすめ生成（DB不要モード）</h2>
        <Link href="/" className="text-sm text-blue-600 hover:underline">← ホームへ</Link>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <RecommendLLM />
        <RecommendFromImage />
      </div>
    </div>
  );
}