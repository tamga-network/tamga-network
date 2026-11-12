/**
 * Süreçler arası klasör kilidi (yayın klasöründe `anchors.lock`, `registry.lock`). `mkdir` atomiktir: klasörü açan kilidi alır.
 * Sahibi ölen kilit kalıcı olmasın diye değişiklik zamanı `staleMs`'den (30 sn) eski kilit bayat sayılır ve devralınır.
 *
 * 0.8.3: kilit TUTULURKEN değişiklik zamanı `beatMs`'de (5 sn) bir tazelenir. Önce tazeleme yoktu: 30 sn'yi aşan bir iş (liste
 * derlemesi, arşivleme) sürerken ikinci bir yazar kilidi "bayat" sayıp devralabiliyor, iki süreç aynı anda yazabiliyordu. Süreç
 * ölürse tazeleme de durur ve kilit `staleMs` sonra yine devralınabilir. Tazeleme olay döngüsünde çalışır: `fn` içinde `staleMs`'den
 * uzun süren kesintisiz eşzamanlı (sync) bir iş olmamalıdır.
 */
import { mkdirSync, rmSync, statSync, utimesSync } from "node:fs";
import { dirname } from "node:path";

export interface DirLockOptions {
  /** bu kadar süredir tazelenmemiş kilit bayattır (varsayılan 30 sn) */
  staleMs?: number;
  /** tutulurken tazeleme aralığı (varsayılan 5 sn) */
  beatMs?: number;
  /** kilidi en çok bu kadar bekle (varsayılan 10 sn) */
  waitMs?: number;
}

export async function withDirLockAt<T>(lock: string, fn: () => Promise<T>, opt: DirLockOptions = {}): Promise<T> {
  const staleMs = opt.staleMs ?? 30_000;
  const beatMs = opt.beatMs ?? 5_000;
  const waitMs = opt.waitMs ?? 10_000;
  mkdirSync(dirname(lock), { recursive: true }); // ilk derlemede (yeni klon) çıktı klasörü henüz yok
  const t0 = Date.now();
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      try {
        if (Date.now() - statSync(lock).mtimeMs > staleMs) {
          rmSync(lock, { recursive: true, force: true });
          continue;
        }
      } catch {
        /* yarışta silinmiş olabilir */
      }
      if (Date.now() - t0 > waitMs)
        throw new Error(`${lock.split(/[\\/]/).pop()}: kilit alınamadı (${Math.round(waitMs / 1000)} sn)`);
      await new Promise((r) => setTimeout(r, 50 + Math.floor(Math.random() * 100)));
    }
  }
  const beat = setInterval(() => {
    try {
      const t = new Date();
      utimesSync(lock, t, t);
    } catch {
      /* kilit klasörü yoksa (dışarıdan silinmiş) yapılacak bir şey yok */
    }
  }, beatMs);
  beat.unref();
  try {
    return await fn();
  } finally {
    clearInterval(beat);
    rmSync(lock, { recursive: true, force: true });
  }
}
