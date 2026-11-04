/**
 * Yeniden oynatmanın girdisi: imzalı liste arşivi (ADR-0073 K1 "üretim arşivini doğrular"). Okuma ve doğrulama:
 *   - `archive/lotl.vNNNN.jws`, `archive/tl-<cc>.vNNNN.jws` sürüm sırasıyla; ilk arşivlenmiş sürümden başlar (öncesi budanmış
 *     olabilir: ilk sürümün `previous_version_hash`'i boş olmayabilir);
 *   - her sürümün imzası: LOTL kök parmak izleriyle (`keys/root-fingerprints.json`), ülke listesi o ülkenin LOTL slotundaki
 *     JSON imzacılarıyla; ardışık sürümler `previous_version_hash` ile zincirli (SPEC-TRUST-0001 TL2);
 *   - çapa günlüğü: kontrol noktaları geriye izlenip arşivler birleştirilir (TL10/TL12), her satır çapa imzacısıyla imzalı, seq ve
 *     `previous_hash` zinciri kesintisiz; liste ortamı beklenenle aynı (ADR-0038 SB2).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { ListTrustSource, loadTrustSet, sha256Tag, utf8, verifyJws } from "@tamga-network/trust";

import type { ArchiveSet } from "./replay-plan.js";

const versionFiles = (dir: string, re: RegExp) =>
  readdirSync(dir)
    .map((f) => ({ f, m: re.exec(f) }))
    .filter((x): x is { f: string; m: RegExpExecArray } => !!x.m)
    .sort((a, b) => Number(a.m[a.m.length - 1]) - Number(b.m[b.m.length - 1]));

/** Liste yayıncısının çıktı klasöründen (`dist/`) arşivi okur. Çapa günlüğü tam zincir olarak birleştirilir. */
export function readArchiveDir(dist: string, environment: "production" | "sandbox"): ArchiveSet {
  const archive = resolve(dist, "archive");
  if (!existsSync(archive)) throw new Error(`replay: arşiv klasörü yok: ${archive}`);
  const lotl = versionFiles(archive, /^lotl\.v(\d+)\.jws$/).map((x) =>
    readFileSync(resolve(archive, x.f), "utf8").trim(),
  );
  const national: Record<string, string[]> = {};
  for (const x of versionFiles(archive, /^(tl-[a-z]{2})\.v(\d+)\.jws$/))
    (national[x.m[1]] ??= []).push(readFileSync(resolve(archive, x.f), "utf8").trim());
  const keys = resolve(dist, "keys", "root-fingerprints.json");
  const rootFingerprints = existsSync(keys)
    ? (JSON.parse(readFileSync(keys, "utf8")).lotl_signing_keys as Array<{ fingerprint_sha256: string }>).map(
        (k) => k.fingerprint_sha256,
      )
    : [];
  return { environment, rootFingerprints, lotl, national, anchorsJsonl: fullAnchors(dist) };
}

/** Kontrol noktalarını geriye izleyerek tam çapa zinciri (apps/trust-publisher `fullAnchorsJsonl` ile aynı kural). */
function fullAnchors(dist: string): string {
  const file = resolve(dist, "anchors.jsonl");
  let lines = existsSync(file)
    ? readFileSync(file, "utf8")
        .split(/\r?\n/)
        .filter((l) => l.trim())
    : [];
  for (;;) {
    const head = lines[0] ? JSON.parse(Buffer.from(lines[0].split(".")[1], "base64url").toString("utf8")) : null;
    if (!head || head.kind !== "checkpoint") break;
    const p = resolve(dist, head.archive.file);
    if (!existsSync(p)) break; // arşiv budanmış: plan baştaki kontrol noktasının durumundan başlar (TL12)
    const bytes = readFileSync(p, "utf8");
    if (sha256Tag(utf8(bytes)) !== head.archive.sha256)
      throw new Error(`replay: çapa arşivi özeti tutmuyor: ${head.archive.file}`);
    lines = [...bytes.split(/\r?\n/).filter((l) => l.trim()), ...lines];
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}

type SignedList = {
  version: number;
  previous_version_hash: string | null;
  environment?: string;
  anchor_signing_keys?: Array<{ fingerprint_sha256: string; status?: string }>;
  national_lists?: Array<{ state_code: string; signing_keys?: Array<{ fingerprint_sha256: string; status?: string }> }>;
  state_code?: string;
};

/** Arşivi doğrular; sorun varsa hata (plan kurulmaz). Dönen: sürüm sayıları. */
export async function verifyArchive(a: ArchiveSet): Promise<{ lotl: number; national: Record<string, number> }> {
  if (!a.lotl.length) throw new Error("replay: arşivde LOTL sürümü yok");
  if (!a.rootFingerprints.length) throw new Error("replay: kök parmak izleri yok (keys/root-fingerprints.json)");
  const chain = async (jwss: string[], fps: (k: number) => Set<string>, what: string) => {
    const out: SignedList[] = [];
    for (const [k, jws] of jwss.entries()) {
      const p = (await verifyJws<SignedList>(jws, fps(k))).payload;
      if ((p.environment ?? "production") !== a.environment)
        throw new Error(
          `replay: ${what} v${p.version} ortamı ${p.environment ?? "production"}, beklenen ${a.environment}`,
        );
      if (k > 0) {
        const prev = out[k - 1];
        if (p.version !== prev.version + 1)
          throw new Error(`replay: ${what} sürüm boşluğu v${prev.version} → v${p.version}`);
        if (p.previous_version_hash !== sha256Tag(utf8(jwss[k - 1])))
          throw new Error(`replay: ${what} v${p.version} önceki sürüm özetine zincirli değil (TL2)`);
      }
      out.push(p);
    }
    return out;
  };
  const roots = new Set(a.rootFingerprints);
  const lotls = await chain(a.lotl, () => roots, "lotl");
  const keysOf = (pick: (l: SignedList) => Array<{ fingerprint_sha256: string; status?: string }> | undefined) => {
    const s = new Set<string>();
    for (const l of lotls)
      for (const k of pick(l) ?? []) if ((k.status ?? "ACTIVE") === "ACTIVE") s.add(k.fingerprint_sha256);
    return s;
  };
  const national: Record<string, number> = {};
  for (const [file, jwss] of Object.entries(a.national)) {
    const cc = file.slice(3).toUpperCase();
    const fps = keysOf((l) => l.national_lists?.find((n) => n.state_code === cc)?.signing_keys);
    const tls = await chain(jwss, () => fps, file);
    for (const t of tls) if (t.state_code !== cc) throw new Error(`replay: ${file} state_code ${t.state_code}`);
    national[file] = tls.length;
  }
  // çapa günlüğü: imza + seq + previous_hash (kontrol noktası zincirin parçasıdır)
  const anchorFps = keysOf((l) => l.anchor_signing_keys);
  let prev: string | null | undefined;
  let seq: number | undefined;
  for (const line of a.anchorsJsonl.split(/\r?\n/).filter((l) => l.trim())) {
    const p = (await verifyJws<{ seq: number; previous_hash: string | null }>(line, anchorFps)).payload;
    if (seq !== undefined && (p.seq !== seq + 1 || p.previous_hash !== prev))
      throw new Error(`replay: çapa günlüğü zinciri kırık (seq ${p.seq})`);
    seq = p.seq;
    prev = sha256Tag(utf8(line));
  }
  return { lotl: lotls.length, national };
}

/**
 * Arşivin SON sürümlerinden `TrustSource(list)` (eşdeğerlik testinin liste tarafı, ADR-0073 K6). `now` arşivin son yayınına
 * yakın verilir: arşiv eski olabilir; liste kuralı o anki görüntüye göre sorulur (çapa günlüğü tazeliği bu yüzden gevşetilir).
 */
export async function listSourceFromArchive(a: ArchiveSet, now: Date) {
  const nationalListJws: Record<string, string> = {};
  for (const [file, list] of Object.entries(a.national)) nationalListJws[file.slice(3).toUpperCase()] = list.at(-1)!;
  const { store, report } = await loadTrustSet({
    lotlJws: a.lotl.at(-1)!,
    nationalListJws,
    anchorsJsonl: a.anchorsJsonl,
    rootFingerprints: a.rootFingerprints,
    environment: a.environment,
    now,
    anchorMaxAgeMs: Number.MAX_SAFE_INTEGER,
    versionMemory: "none",
  });
  if (!report.healthy) throw new Error(`replay: liste seti sağlıksız — ${report.warnings.join("; ")}`);
  return { store, source: new ListTrustSource(store, () => now) };
}
