'use client';
import { useEffect, useRef, useState } from 'react';
import Quagga from '@ericblade/quagga2';

const ISBN13_PATTERN = /^97[89]\d{10}$/; // 978/979 で始まる13桁のみ

export default function BarcodeScanner() {
  const mountRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);         // StrictModeでの二重起動防止
  const handlingRef = useRef(false);        // 連続検出の同時処理防止
  const handlerRef = useRef<any>(null);     // offDetected に使う参照

  const [code, setCode] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>('※ 上段の「978/979〜」バーコードを狙ってください（下段の 19… は価格コードで無視されます）');
  const [lookup, setLookup] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!mountRef.current || startedRef.current) return;
      setError(null);

      Quagga.init(
        {
          inputStream: {
            name: 'Live',
            type: 'LiveStream',
            target: mountRef.current,
            constraints: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader'] },
          locate: true,
          numOfWorkers: navigator.hardwareConcurrency ? Math.min(4, navigator.hardwareConcurrency) : 2,
        },
        (err) => {
          if (cancelled) return;
          if (err) { setError(err.message || String(err)); return; }

          Quagga.start();
          startedRef.current = true;

          // 既存ハンドラ解除 → 新規登録（多重登録防止）
          if (handlerRef.current) {
            try { Quagga.offDetected(handlerRef.current); } catch {}
          }

          handlerRef.current = async (data: any) => {
            if (handlingRef.current) return; // 重複ガード
            const raw = data?.codeResult?.code;
            if (!raw) return;

            // ★ ISBN13 以外（例：19で始まる価格コード）は無視してスキャン継続
            if (!ISBN13_PATTERN.test(raw)) {
              setHint('価格コードなどを検出 → 上段の「978/979〜」バーコードにゆっくり近づけてください');
              return;
            }

            // ここから先は有効なISBNとして処理（1回のみ）
            handlingRef.current = true;
            setHint(null);
            setCode(raw);
            setLookup(null);

            // 停止＆リセット（固まり対策）
            try { Quagga.stop(); } catch {}
            try { Quagga.reset(); } catch {}
            startedRef.current = false;

            try {
              const res = await fetch(`/api/lookup?isbn=${encodeURIComponent(raw)}`);
              const json = await res.json();
              setLookup(json);
            } catch (e: any) {
              setError(e?.message || String(e));
            } finally {
              handlingRef.current = false;
            }
          };

          Quagga.onDetected(handlerRef.current);
        }
      );
    };

    start();

    // アンマウント時のクリーンアップ
    return () => {
      cancelled = true;
      try { if (handlerRef.current) Quagga.offDetected(handlerRef.current); } catch {}
      try { Quagga.stop(); } catch {}
      try { Quagga.reset(); } catch {}
      startedRef.current = false;
      handlingRef.current = false;
    };
  }, []);

  return (
    <div className="space-y-2">
      <div ref={mountRef} className="w-full aspect-video bg-black/60 rounded-2xl" />
      <p className="text-sm text-gray-500">検出コード: {code || '-'}</p>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      {lookup && (
        <pre className="text-xs whitespace-pre-wrap max-h-48 overflow-auto">
          {JSON.stringify(lookup, null, 2)}
        </pre>
      )}
      {error && <p className="text-xs text-red-500">エラー: {error}</p>}
      <button
        className="btn"
        onClick={() => {
          // 再スキャン（いったんページをリロードする簡易実装）
          setCode(null); setLookup(null); setHint('※ 上段の「978/979〜」バーコードを狙ってください（下段の 19… は価格コードで無視されます）');
          location.reload();
        }}
      >
        もう一度スキャン
      </button>
    </div>
  );
}