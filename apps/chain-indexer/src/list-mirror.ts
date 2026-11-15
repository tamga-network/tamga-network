/**
 * İmzalı liste aynası — gölge zincir (GUIDE-0018 "Gölge zincir"; ADR-0084 K6 test ağı aşaması) için canlı ağın kamuya açık imzalı
 * listelerini ve arşivini YALNIZ OKUYARAK indirir ve yeniden oynatmanın okuduğu yayın klasörü düzenine yazar
 * (`readArchiveDir`): `lotl.jws`, `tl-<cc>.jws`, `anchors.jsonl`, `keys/root-fingerprints.json`, `archive/lotl.vNNNN.jws`,
 * `archive/tl-<cc>.vNNNN.jws` ve çapa günlüğünün kontrol noktası arşivleri (SPEC-TRUST-0001 TL10/TL12).
 *
 * Kurallar: yalnız HTTP GET (yazma yok, kimlik bilgisi yok); arşivlenmiş sürümler değişmez — yerelde olan yeniden indirilmez
 * (artımlı koşu); arşiv geriye doğru ilk eksik sürümde biter (budanmış arşiv, TL12). Sonuç `verifyArchive` ile doğrulanır
 * (imza, sürüm zinciri, çapa zinciri); doğrulanmayan set yazılmış olsa da hata verilir ve yeniden oynatılmaz. Kök parmak izleri
 * sunucudan gelir — bant dışı sabitlenen değerle karşılaştırmak için `expectRoots`.
 * Kişisel veri yoktur: listeler kamuya açıktır.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { readArchiveDir, verifyArchive } from "./replay-archive.js";

export type FetchText = (url: string) => Promise<{ status: number; body: string }>;

export const httpFetchText: FetchText = async (url) => {
  const r = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  return { status: r.status, body: r.status === 200 ? await r.text() : "" };
};

function payload<T>(jws: string): T {
  const p = jws.trim().split(".");
  if (p.length !== 3) throw new Error("mirror: JWS compact biçimi değil");
  return JSON.parse(Buffer.from(p[1], "base64url").toString("utf8")) as T;
}
const pad = (n: number) => String(n).padStart(4, "0");

export interface MirrorReport {
  base: string;
  out: string;
  lists: Record<string, { current: number; archived: number; downloaded: number }>;
  anchorLines: number;
  anchorArchives: number;
  downloaded: number;
  verified: { lotl: number; national: Record<string, number> };
}

export async function mirrorSignedLists(o: {
  base: string;
  out: string;
  environment?: "production" | "sandbox";
  fetchText?: FetchText;
  /** bant dışı sabitlenmiş LOTL kök parmak izleri (sha256 onaltılık); verilirse sunucudakiyle aynı küme olmalı */
  expectRoots?: string[];
}): Promise<MirrorReport> {
  const base = o.base.replace(/\/+$/, "");
  if (!/^https:\/\//.test(base) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base))
    throw new Error("mirror: kaynak https olmalı (yerel sınama için yalnız http://127.0.0.1)");
  const get = o.fetchText ?? httpFetchText;
  let downloaded = 0;
  const fetchRequired = async (path: string) => {
    const r = await get(`${base}/${path}`);
    if (r.status !== 200) throw new Error(`mirror: ${path} indirilemedi (HTTP ${r.status})`);
    downloaded++;
    return r.body;
  };
  const write = (path: string, body: string) => {
    const p = resolve(o.out, path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
  };
  mkdirSync(resolve(o.out, "archive"), { recursive: true });

  const roots = await fetchRequired("keys/root-fingerprints.json");
  if (o.expectRoots?.length) {
    const got = (JSON.parse(roots).lotl_signing_keys as Array<{ fingerprint_sha256: string }>).map((k) =>
      k.fingerprint_sha256.toLowerCase(),
    );
    const want = o.expectRoots.map((x) => x.toLowerCase());
    if (got.length !== want.length || !want.every((w) => got.includes(w)))
      throw new Error("mirror: sunucudaki kök parmak izleri sabitlenen değerle aynı değil — indirme durduruldu");
  }
  write("keys/root-fingerprints.json", roots);

  const lists: MirrorReport["lists"] = {};
  /** Şimdiki sürümü yazar ve arşivi geriye doğru (yerelde olmayan) ilk eksiğe kadar indirir. */
  const mirrorList = async (file: string, current: string) => {
    const v = Number(payload<{ version: unknown }>(current).version);
    if (!Number.isInteger(v) || v < 1) throw new Error(`mirror: ${file} sürümü okunamadı`);
    write(`${file}.jws`, current);
    let got = 0;
    let archived = 0;
    for (let k = v; k >= 1; k--) {
      const name = `archive/${file}.v${pad(k)}.jws`;
      if (existsSync(resolve(o.out, name))) {
        archived++;
        // arşiv değişmez: yerelde olan sürümden öncesi önceki koşuda indirildi
        if (k < v) break;
        continue;
      }
      const r = await get(`${base}/${name}`);
      if (r.status === 404) {
        if (k === v) {
          write(name, current); // yayıncı şimdiki sürümü arşive de yazar; yoksa şimdiki dosyadan
          got++;
          archived++;
          continue;
        }
        break; // budanmış arşiv (TL12)
      }
      if (r.status !== 200) throw new Error(`mirror: ${name} indirilemedi (HTTP ${r.status})`);
      downloaded++;
      if (Number(payload<{ version: unknown }>(r.body).version) !== k)
        throw new Error(`mirror: ${name} sürümü tutmuyor`);
      write(name, r.body.trim());
      got++;
      archived++;
    }
    lists[file] = { current: v, archived, downloaded: got };
  };

  const lotl = (await fetchRequired("lotl.jws")).trim();
  await mirrorList("lotl", lotl);
  const states = (payload<{ national_lists?: Array<{ state_code?: string }> }>(lotl).national_lists ?? [])
    .map((n) => String(n.state_code ?? "").toLowerCase())
    .filter((c) => /^[a-z]{2}$/.test(c));
  for (const cc of states) {
    const r = await get(`${base}/tl-${cc}.jws`);
    if (r.status === 404) continue; // LOTL'da slot var, liste henüz yayımlanmamış
    if (r.status !== 200) throw new Error(`mirror: tl-${cc}.jws indirilemedi (HTTP ${r.status})`);
    downloaded++;
    await mirrorList(`tl-${cc}`, r.body.trim());
  }

  // çapa günlüğü + kontrol noktası arşivleri (geriye doğru)
  const anchors = await fetchRequired("anchors.jsonl");
  write("anchors.jsonl", anchors);
  let anchorArchives = 0;
  let head = anchors.split(/\r?\n/).find((l) => l.trim());
  for (let guard = 0; head && guard < 10_000; guard++) {
    const h = payload<{ kind?: string; archive?: { file?: string } }>(head);
    if (h.kind !== "checkpoint" || !h.archive?.file) break;
    const file = h.archive.file;
    if (!/^archive\/anchors-[0-9A-Za-z-]+\.jsonl$/.test(file))
      throw new Error(`mirror: beklenmeyen çapa arşivi adı: ${file}`);
    let body: string;
    if (existsSync(resolve(o.out, file))) body = readFileSync(resolve(o.out, file), "utf8");
    else {
      const r = await get(`${base}/${file}`);
      if (r.status === 404) break; // budanmış
      if (r.status !== 200) throw new Error(`mirror: ${file} indirilemedi (HTTP ${r.status})`);
      downloaded++;
      body = r.body;
      write(file, body);
    }
    anchorArchives++;
    head = body.split(/\r?\n/).find((l) => l.trim());
  }

  const archive = readArchiveDir(o.out, o.environment ?? "production");
  const verified = await verifyArchive(archive);
  return {
    base,
    out: o.out,
    lists,
    anchorLines: archive.anchorsJsonl.split(/\r?\n/).filter((l) => l.trim()).length,
    anchorArchives,
    downloaded,
    verified,
  };
}
