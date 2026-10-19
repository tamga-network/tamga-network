/**
 * Zincir projeksiyonu — SAF hesap (ADR-0051 K2; SPEC-BC-0001 §15): imzalı liste dosyalarından ve çapa günlüğünden zincire
 * yazılacak ÖZETLERİ çıkarır. Liste içeriği, kayıt, belge ya da kişisel veri bu modülden geçmez; yalnız hash, sürüm, zaman
 * (CH2 / DP1 / TL11). Ağ erişimi yok; testlenebilir.
 *
 * Anahtarlar:
 *   listKey = keccak256(utf8("tamga:trust-list:<ortam>:<dosya>"))   ör. production:lotl, production:tl-tr
 *   logKey  = keccak256(utf8("tamga:anchors:<ortam>"))
 * Özetler: contentHash = sha256(<dosya>.jws) (= sonraki sürümün previous_version_hash'i, SPEC-TRUST-0001 §1.3);
 *          lineHash = sha256(satır JWS) (çapa günlüğü zinciri aynı değeri kullanır, §5).
 */
import { keccak256Hex, sha256Hex, utf8 } from "@tamga-network/trust";

export type Environment = "production" | "sandbox";

export interface ListVersionAnchor {
  /** dosya adı: "lotl" ya da "tl-tr" */
  file: string;
  listKey: string; // 0x… bytes32
  version: number;
  contentHash: string; // 0x… bytes32 — sha256(jws)
  previousHash: string; // 0x… bytes32 — payload.previous_version_hash (yoksa sıfır)
  issuedAt: number; // epoch saniye
}

export interface LogHeadAnchor {
  logKey: string;
  seq: number;
  lineHash: string;
  ts: number; // epoch saniye
}

export interface ProjectionPlan {
  environment: Environment;
  lists: ListVersionAnchor[];
  logHead: LogHeadAnchor | null;
}

export const ZERO32 = "0x" + "0".repeat(64);

export const listKeyOf = (environment: Environment, file: string) =>
  keccak256Hex(utf8(`tamga:trust-list:${environment}:${file}`));
export const logKeyOf = (environment: Environment) => keccak256Hex(utf8(`tamga:anchors:${environment}`));

/** "sha256:<hex>" → "0x<hex>"; null/boş → sıfır. Başka önek hata (sessizce yanlış özet çapalanmasın). */
export function tagToBytes32(tag: string | null | undefined): string {
  if (!tag) return ZERO32;
  const m = /^sha256:([0-9a-f]{64})$/i.exec(tag);
  if (!m) throw new Error(`chain: beklenmeyen özet biçimi: ${tag.slice(0, 24)}`);
  return "0x" + m[1].toLowerCase();
}

export const jwsHash = (jws: string) => "0x" + sha256Hex(utf8(jws));

/** JWS compact payload'ını okur — İMZA DOĞRULAMAZ (projeksiyon öncesi set `loadTrustSet` ile doğrulanır, bkz. anchor.ts). */
export function jwsPayload<T = Record<string, unknown>>(jws: string): T {
  const parts = jws.trim().split(".");
  if (parts.length !== 3) throw new Error("chain: JWS compact biçimi değil");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as T;
}

const epoch = (iso: unknown, what: string) => {
  const t = Date.parse(String(iso));
  if (!Number.isFinite(t)) throw new Error(`chain: ${what} geçersiz tarih`);
  return Math.floor(t / 1000);
};

/** Tek bir imzalı listeden (lotl.jws / tl-<cc>.jws) zincire yazılacak özet. */
export function listAnchorOf(environment: Environment, file: string, jws: string): ListVersionAnchor {
  const p = jwsPayload<{ version?: unknown; issued_at?: unknown; previous_version_hash?: string | null }>(jws);
  const version = Number(p.version);
  if (!Number.isInteger(version) || version < 1) throw new Error(`chain: ${file} sürümü geçersiz`);
  return {
    file,
    listKey: listKeyOf(environment, file),
    version,
    contentHash: jwsHash(jws.trim()),
    previousHash: tagToBytes32(p.previous_version_hash),
    issuedAt: epoch(p.issued_at, `${file} issued_at`),
  };
}

/** Çapa günlüğünün son satırı (boş günlük → null). */
export function logHeadOf(environment: Environment, anchorsJsonl: string): LogHeadAnchor | null {
  const lines = anchorsJsonl.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;
  const last = lines[lines.length - 1].trim();
  const p = jwsPayload<{ seq?: unknown; ts?: unknown }>(last);
  const seq = Number(p.seq);
  if (!Number.isInteger(seq) || seq < 0) throw new Error("chain: çapa günlüğü seq geçersiz");
  return { logKey: logKeyOf(environment), seq, lineHash: jwsHash(last), ts: epoch(p.ts, "anchors ts") };
}

export interface PlanInput {
  environment: Environment;
  lotlJws: string;
  /** dosya adı ("tl-tr") → jws */
  nationalListJws: Record<string, string>;
  anchorsJsonl: string;
}

/** Bütün set için plan: lotl + ulusal listeler + günlük başı. Deterministik; aynı girdi aynı plan. */
export function planProjection(input: PlanInput): ProjectionPlan {
  const lists = [listAnchorOf(input.environment, "lotl", input.lotlJws)];
  for (const file of Object.keys(input.nationalListJws).sort()) {
    if (!/^tl-[a-z]{2}$/.test(file)) throw new Error(`chain: ulusal liste dosya adı beklenmiyor: ${file}`);
    lists.push(listAnchorOf(input.environment, file, input.nationalListJws[file]));
  }
  return { environment: input.environment, lists, logHead: logHeadOf(input.environment, input.anchorsJsonl) };
}
