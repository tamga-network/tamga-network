/**
 * Vitest globalSetup — testlerin geçici klasörleri tek bir çalışma köküne (CL75, 2026-11-25).
 * Testler ve test edilen CLI'lar `os.tmpdir()` altında klasör açıyor (`tamga-*`, `chain-*`, `perm-*`, `private-names-*` …); bir kısmı
 * silinmiyordu, Windows'ta açık veritabanı tutamağı silmeyi de engelleyebiliyordu — haftalar içinde onlarca GB birikti. Burada her
 * çalışma için tek bir kök açılır ve TEMP/TMP/TMPDIR ona çevrilir: işçiler ve testlerin başlattığı alt süreçler (npx tsx …) bu ortamı
 * devralır, bütün geçici klasörler kökün altına düşer; çalışma bitince kök bir kerede silinir. Yarıda kesilen çalışmaların kökleri bir
 * sonraki çalışmanın başında temizlenir (6 saatten eski; aynı anda süren başka bir çalışmanınki silinmez).
 * tamga-platform da bu dosyayı kullanır (kök: tamga-network/scripts).
 */
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PREFIX = "tamga-vitest-";
const STALE_MS = 6 * 3600_000;

const rmQuiet = (p: string) => {
  try {
    rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch (e) {
    // Windows: kapanmamış bir tutamak (ör. gömülü veritabanı) silmeyi engelleyebilir — test sonucunu bozmaz, sonraki çalışma temizler
    console.warn(`test-tmpdir: ${p} silinemedi (${(e as Error).message})`);
  }
};

export default function setup() {
  const base = tmpdir();
  const now = Date.now();
  for (const name of readdirSync(base)) {
    if (!name.startsWith(PREFIX)) continue;
    const p = join(base, name);
    try {
      if (now - statSync(p).mtimeMs > STALE_MS) rmQuiet(p);
    } catch {
      /* başka süreç sildi */
    }
  }
  const prev = { TEMP: process.env.TEMP, TMP: process.env.TMP, TMPDIR: process.env.TMPDIR };
  const root = mkdtempSync(join(base, PREFIX));
  process.env.TEMP = process.env.TMP = process.env.TMPDIR = root;
  return () => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    rmQuiet(root);
  };
}
