/**
 * `trust:chain-replay` — yeniden oynatma PLANI (ADR-0073 K1; ADR-0009 K7). SAF ve deterministik: aynı arşiv → aynı plan → aynı
 * `replayPlanHash` (= Governance'ın göç penceresi önerisinin taşıdığı özet; herkes herkese açık arşivden yeniden üretebilir).
 *
 * Girdi: imzalı liste arşivi (ilk arşivlenmiş sürümden bugüne `lotl.vNNNN.jws`, `tl-<cc>.vNNNN.jws`) ve çapa günlüğünün tam
 * zinciri. Sürümler yayın sırasıyla gezilir; her kaydın listede yeni görünen geçmişi kontrat çağrılarına çevrilir:
 *   - tarih taşıyan yazımlar listedeki anı açıkça alır (durum `since`, yetki penceresi, kayıt anı, iptal listesi yayın anı) —
 *     göç kipinde (CE1); sıra kayıt başına korunur, bütün işlemler zamana göre dizilir;
 *   - ulusal kayıtlar o devletin delegesiyle, ağ düzeyi kayıtlar (ağ şeması, cüzdan sağlayıcı, ZK devresi, dış liste, belge
 *     kategorisi, liste imzacısı, liste işletmecisi, slot, katalog — network-records.ts) tek göç yürütücüsüyle (K1);
 *     ağ şemasının iptali ve doğrulayıcı devri / iptal sonrası yeniden kaydı yalnız Governance oyuyla (ADR-0075, güvenlik turu);
 *   - durum eşlemesi ADR-0073 K5 / SPEC-BC-0001 §16.4: RETIRED kurum = yumuşak iptal (`retireIssuer`), REVOKED +
 *     `invalidates_from` = sert iptal, kök ROLLING_OVER = ACTIVE + halef olayı, doğrulayıcı RETIRED = REVOKED; kurum halefi
 *     (`successor_id`) iptal yazımıyla (aynı devletin o anda ACTIVE kurumu; değilse uyarıyla sıfır);
 *   - kişisel veri ve serbest metin zincire gitmez (PJ2): adlar, gerekçeler, kayıt verisi yalnız özet.
 * Plan zincire bakmaz; hangi işlemin zincirde olduğuna yürütücü (replay-exec.ts) karar verir (kaldığı yerden devam).
 */
import { createHash } from "node:crypto";
import {
  Lotl,
  NationalList,
  type Issuer,
  type RelyingParty,
  type RootCa,
  type SchemaEntry,
} from "@tamga-network/trust";

import { ISSUER_CATEGORIES, ISSUER_CLASSES, PRESENTATION_FORMATS } from "./contracts.js";
import { NET_STATUS, lotlNetworkRecords, nationalNetworkRecords } from "./network-records.js";
import {
  ZERO32,
  canonicalJson,
  detailsHash,
  fpToBytes32,
  groupIdOf,
  keccakText,
  listIdOf,
  rpIdOf,
  schemaIdOf,
  sec,
  sriToBytes32,
  tagToBytes32,
} from "./ids.js";

export const REPLAY_PLAN_FORMAT = "tamga-replay-plan/1";

/** Arşiv: sürüm sırasıyla imzalı listeler + çapa günlüğünün tam zinciri (kontrol noktaları izlenmiş, seq baştan). */
export interface ArchiveSet {
  environment: "production" | "sandbox";
  rootFingerprints: string[];
  lotl: string[];
  /** "tl-tr" → sürüm sırasıyla JWS'ler */
  national: Record<string, string[]>;
  anchorsJsonl: string;
}

/** Kim yazar: devletin delegesi, tek göç yürütücüsü ya da Governance oyu (2/3). */
export type Who = { role: "state"; state: string } | { role: "executor" } | { role: "governance" };

export interface ScopeArgs {
  scopeHash: string;
  serviceHash: string;
  schemaId: string;
  format: number;
  namespaceHash: string;
  attributes: string[];
  validFrom: number;
  validUntil: number;
  detailsHash: string;
}
export interface GroupArgs {
  groupId: string;
  institutionId: string;
  policyIds: string[];
  certFingerprints: string[];
  offlineAllowed: boolean;
  validFrom: number;
  validUntil: number;
  labelHash: string;
}
export interface RpProfileArgs {
  publicSector: boolean;
  entitlements: number;
  aliasPolicy: number;
  registrationHash: string;
  intermediaries: string[];
  servedParties: string[];
}
export interface IssuerProfileArgs {
  issuerClass: number;
  publicSector: boolean;
  entitlements: number;
  registrationHash: string;
  operationsHash: string;
}
export interface NetworkRecordArgs {
  kind: number;
  recordId: string;
  parentId: string;
  region: string;
  subtype: number;
  status: number;
  validFrom: number;
  validUntil: number;
  fingerprint: string;
  detailsHash: string;
  flags: string;
  digests: string[];
}

export type ReplayOpBody =
  | {
      op: "registerRootCA";
      caId: string;
      state: string;
      fp: string;
      subjectHash: string;
      validFrom: number;
      validUntil: number;
    }
  | { op: "rootCAStatus"; caId: string; status: "SUSPENDED" | "ACTIVE" | "RETIRED" | "REVOKED"; reasonHash: string }
  | { op: "rootCARollover"; caId: string; successor: string }
  | {
      op: "registerSchema";
      schemaId: string;
      vct: string;
      contentHash: string;
      tier: 0 | 1;
      state: string;
    }
  | { op: "addSchemaHash"; schemaId: string; contentHash: string }
  | { op: "schemaStatus"; schemaId: string; status: "DEPRECATED" | "REVOKED"; reasonHash: string }
  | {
      op: "registerIssuer";
      issuerId: string;
      state: string;
      nameHash: string;
      category: number;
      assurance: number;
      fp: string;
      parentCA: string;
      validFrom: number;
      validUntil: number;
    }
  | {
      op: "issuerStatus";
      issuerId: string;
      status: "SUSPENDED" | "ACTIVE" | "REVOKED" | "RETIRED";
      /** iptalde halef (`successor_id`; yalnız REVOKED / RETIRED) */
      successor?: string;
    }
  | { op: "issuerInvalidatesFrom"; issuerId: string; invalidatesFrom: number }
  | { op: "renewIssuer"; issuerId: string; validUntil: number }
  | { op: "issuerProfile"; issuerId: string; profile: IssuerProfileArgs }
  | { op: "schemaAuth"; issuerId: string; schemaId: string; allowed: boolean }
  /** iptal listesi yazımı için kurumun delegesi: yürütücü devletin delegesini atar (adres planda değil, sembolik) */
  | { op: "issuerDelegates"; issuerId: string }
  | {
      op: "registerList";
      issuerId: string;
      listUri: string;
      listId: string;
      bits: number;
      size: number;
      /**
       * bit sayısı ve boyutun kaynağı: `anchor` çapa satırı (belirteçten yazılmış), `token` belirtecin kendisi (planı kuran okudu),
       * `default` hiçbiri — varsayılan (2 bit, 100000); gerçek ağ yazımında reddedilir
       */
      params: "anchor" | "token" | "default";
    }
  | { op: "publishList"; listId: string; contentHash: string; version: number }
  | { op: "recognition"; recognizing: string; recognized: string; mode: 0 | 1 }
  | { op: "registerRP"; rpId: string; state: string; nameHash: string; fp: string }
  | { op: "rpStatus"; rpId: string; status: "SUSPENDED" | "ACTIVE" | "REVOKED"; historyLen: number }
  | { op: "rpCert"; rpId: string; fp: string }
  | { op: "rpScope"; rpId: string; period: number; scope: ScopeArgs }
  | { op: "rpGroup"; rpId: string; period: number; group: GroupArgs }
  | { op: "rpProfile"; rpId: string; period: number; profile: RpProfileArgs }
  | {
      op: "rpPeriod";
      action: "REASSIGNMENT" | "RE_REGISTRATION";
      rpId: string;
      fromState: string;
      toState: string;
      nameHash: string;
      fp: string;
      reasonHash: string;
      period: number;
    }
  | { op: "networkRecord"; record: NetworkRecordArgs };

/**
 * `at`: işlemin anı (epoch saniye) — tarih taşıyan yazımda kontrata giden tarih, ötekilerde sıralama anahtarı.
 * `n`: aynı kayda yapılan son-hâl yazımının sırası (1'den) — kaydın üstüne yazılan işlemlerde (kayıt verisi, kapsam, kapı grubu,
 * sertifika, tanıma, ağ düzeyi kayıt) "zincirde var mı" sorusu içerikle değil yazım sayısıyla cevaplanır; eski bir işlem yeniden
 * çalıştırılıp sonraki yazımı geri almaz.
 */
export type ReplayOp = ReplayOpBody & { seq: number; at: number; who: Who; src: string; n?: number };

/** Sıra numarası tutulan son-hâl yazımlarının anahtarı (yoksa null). */
export function ordinalKey(b: ReplayOpBody): string | null {
  switch (b.op) {
    case "issuerProfile":
      return `issuerProfile|${b.issuerId}`;
    case "rpProfile":
      return `rpProfile|${b.rpId}`;
    case "rpScope":
      return `rpScope|${b.rpId}|${b.scope.scopeHash}`;
    case "rpGroup":
      return `rpGroup|${b.rpId}|${b.group.groupId}`;
    case "rpCert":
      return `rpCert|${b.rpId}`;
    case "recognition":
      return `recognition|${b.recognizing}|${b.recognized}`;
    case "networkRecord":
      return `networkRecord|${b.record.kind}|${b.record.recordId}`;
    default:
      return null;
  }
}

export interface ReplayPlan {
  format: typeof REPLAY_PLAN_FORMAT;
  environment: "production" | "sandbox";
  /** arşivdeki en son liste yayını (plan bu andan ileri tarih yazmaz) */
  planTime: number;
  ops: ReplayOp[];
  /** SHA-256(kanonik JSON {format, environment, planTime, ops}) — Governance göç önerisinin `replayPlanHash`'i */
  hash: string;
  warnings: string[];
  summary: Record<string, number>;
}

export interface PlanOptions {
  /**
   * Çapa satırında bit sayısı ve boyut yoksa (eski satırlar) iptal listesinin kendisinden (belirteç, `statusListRegistrationOf`) —
   * yeniden oynatma aracı adresten okur (`statusListUrisMissingParams`).
   */
  statusListParams?: (listUri: string) => { bits: number; size: number } | null;
}

/** JWS yükü (imza burada DOĞRULANMAZ; `verifyArchive` önce çalışır). */
function payload<T>(jws: string): T {
  const p = jws.trim().split(".");
  if (p.length !== 3) throw new Error("replay: JWS compact biçimi değil");
  return JSON.parse(Buffer.from(p[1], "base64url").toString("utf8")) as T;
}

const reasonHash = (r: string | undefined) => (r ? keccakText(r) : ZERO32);
const ENTITLEMENTS = ["service_provider", "qeaa_provider", "non_q_eaa_provider", "pub_eaa_provider", "pid_provider"];
const entitlementMask = (xs: string[] | undefined) =>
  (xs ?? []).reduce((m, e) => (ENTITLEMENTS.indexOf(e) >= 0 ? m | (1 << ENTITLEMENTS.indexOf(e)) : m), 0);
const registrationBlock = (r: Issuer | RelyingParty) => ({
  trade_name: r.trade_name,
  identifiers: r.identifiers,
  postal_address: r.postal_address,
  info_uri: r.info_uri,
  contact: r.contact,
  service_description: r.service_description,
  supervisory_authority: r.supervisory_authority,
});
const STATUS_RANK: Record<string, number> = {
  registerRootCA: 0,
  registerSchema: 1,
  addSchemaHash: 2,
  registerIssuer: 3,
  issuerDelegates: 4,
  issuerProfile: 4,
  renewIssuer: 4,
  schemaAuthOpen: 5,
  registerRP: 6,
  rpCert: 7,
  rpScope: 7,
  rpGroup: 7,
  rpProfile: 7,
  recognition: 8,
  networkRecord: 9,
  registerList: 10,
  publishList: 11,
  rootCARollover: 12,
  rootCAStatus: 12,
  issuerStatus: 12,
  rpStatus: 12,
  issuerInvalidatesFrom: 13,
  schemaAuthClose: 14,
  // dönem değişikliği yeni sahibin aynı andaki yazımlarından (kapsam, kayıt verisi) önce gelir
  rpPeriod: 6.5,
  schemaStatus: 16,
};
const rankOf = (o: ReplayOpBody) =>
  STATUS_RANK[o.op === "schemaAuth" ? (o.allowed ? "schemaAuthOpen" : "schemaAuthClose") : o.op] ?? 99;

export function scopeArgs(s: RelyingParty["scopes"][number]): ScopeArgs | string {
  if (!s.claims.length) return `kapsam ${s.scope_id}: öğe yok`;
  if (s.claims.length > 64) return `kapsam ${s.scope_id}: 64'ten çok öğe`;
  const attributes = [...new Set(s.claims.map((c) => keccakText(c)))].sort();
  return {
    scopeHash: keccakText(s.scope_id),
    serviceHash: keccakText(s.service_id ?? s.scope_id),
    schemaId: schemaIdOf(s.vct),
    format: PRESENTATION_FORMATS.indexOf((s.format ?? "dc+sd-jwt") as (typeof PRESENTATION_FORMATS)[number]),
    namespaceHash: s.mdoc_namespace ? keccakText(s.mdoc_namespace) : ZERO32,
    attributes,
    validFrom: sec(s.valid_from),
    validUntil: s.valid_until ? sec(s.valid_until) : 0,
    detailsHash: detailsHash({
      purpose: s.purpose,
      purpose_localized: s.purpose_localized,
      privacy_policy_uri: s.privacy_policy_uri,
    }),
  };
}

/**
 * Planı kurar. `planTime` = arşivdeki son liste yayını: listede bu andan ileri bir tarih (ileri tarihli yetki bitişi gibi)
 * zincire yazılamaz (DateInFuture) — uyarıyla atlanır.
 */
export function buildReplayPlan(archive: ArchiveSet, opts: PlanOptions = {}): ReplayPlan {
  const warnings: string[] = [];
  const ops: ReplayOp[] = [];
  let n = 0;
  const ordinals = new Map<string, number>();
  const push = (at: number, who: Who, src: string, body: ReplayOpBody) => {
    const k = ordinalKey(body);
    const ord = k ? (ordinals.get(k) ?? 0) + 1 : undefined;
    if (k) ordinals.set(k, ord!);
    ops.push({ ...body, seq: n++, at, who, src, ...(ord ? { n: ord } : {}) });
  };

  // Sürümleri yayın sırasıyla birleştir (eşit anda LOTL önce: ağ şemaları ülke listesinin yetkilerinden önce)
  type V = { file: string; jws: string; issuedAt: number; version: number; order: number };
  const versions: V[] = [];
  for (const jws of archive.lotl) {
    const p = payload<{ issued_at: string; version: number }>(jws);
    versions.push({ file: "lotl", jws, issuedAt: sec(p.issued_at), version: p.version, order: 0 });
  }
  for (const [file, list] of Object.entries(archive.national))
    for (const jws of list) {
      const p = payload<{ issued_at: string; version: number }>(jws);
      versions.push({ file, jws, issuedAt: sec(p.issued_at), version: p.version, order: 1 });
    }
  versions.sort((a, b) => a.issuedAt - b.issuedAt || a.order - b.order || a.file.localeCompare(b.file));
  const planTime = Math.max(0, ...versions.map((v) => v.issuedAt));

  // --- izlenen durum (zincire yazılmış saydığımız) ---
  const roots = new Map<string, { applied: number }>();
  const schemas = new Map<string, { applied: number; hashes: Set<string>; tier: 0 | 1; state: string }>();
  const issuers = new Map<
    string,
    {
      applied: number;
      validUntil: number;
      state: string;
      auth: Map<string, boolean>;
      profile: string;
      delegates: boolean;
    }
  >();
  /** ülke listesinin o sürümündeki kurum kayıtları (halef denetimi için; sürüm başında doldurulur) */
  let issuersNow = new Map<string, { cc: string; issuer: Issuer }>();
  type RpTrack = {
    owner: string;
    /** kaydın göründüğü ülke listeleri (devir yalnız YENİ bir ülke listesinde ilk görünüşte) */
    seenIn: Set<string>;
    applied: number;
    historyLen: number;
    fp: string;
    period: number;
    scopes: Map<string, string>;
    groups: Map<string, string>;
    profile: string;
    revoked: boolean;
  };
  const rps = new Map<string, RpTrack>();
  const recognition = new Map<string, Set<string>>();
  const records = new Map<string, string>();
  const issuerIdBySlug = new Map<string, string>(); // `<cc>:<slug>` → issuer_id (kapı grubu kurumu)

  const futureGuard = (at: number, what: string) => {
    if (at > planTime) {
      warnings.push(`${what}: ileri tarih (${new Date(at * 1000).toISOString()}) — zincire yazılmaz (DateInFuture)`);
      return false;
    }
    return true;
  };

  // ---- kök CA'lar
  const replayRoot = (cc: string, ca: RootCa, src: string) => {
    const who: Who = { role: "state", state: cc };
    let t = roots.get(ca.ca_id);
    const h = [...ca.status_history].sort((a, b) => sec(a.since) - sec(b.since));
    if (!t) {
      if (!h.length || !["ACTIVE", "ROLLING_OVER"].includes(h[0].status))
        return warnings.push(`${src} kök ${ca.ca_id}: ilk durum ACTIVE değil — yazılmadı`);
      push(sec(h[0].since), who, src, {
        op: "registerRootCA",
        caId: ca.ca_id,
        state: cc,
        fp: fpToBytes32(ca.cert_fingerprint_sha256),
        subjectHash: keccakText(ca.legal_name),
        validFrom: sec(ca.valid_from),
        validUntil: sec(ca.valid_until),
      });
      t = { applied: 1 };
      roots.set(ca.ca_id, t);
    }
    for (const e of h.slice(t.applied)) {
      const at = sec(e.since);
      if (!futureGuard(at, `${src} kök ${ca.ca_id} ${e.status}`)) break;
      if (e.status === "ROLLING_OVER") {
        if (ca.successor_ca_id)
          push(at, who, src, { op: "rootCARollover", caId: ca.ca_id, successor: ca.successor_ca_id });
      } else if (["SUSPENDED", "ACTIVE", "RETIRED", "REVOKED"].includes(e.status))
        push(at, who, src, {
          op: "rootCAStatus",
          caId: ca.ca_id,
          status: e.status as "SUSPENDED" | "ACTIVE" | "RETIRED" | "REVOKED",
          reasonHash: reasonHash(e.reason),
        });
      else warnings.push(`${src} kök ${ca.ca_id}: kök CA'da kullanılmayan durum ${e.status} (K5 "—") — durdu`);
      t.applied++;
    }
  };

  // ---- şemalar (ağ: LOTL, yürütücü; ulusal: ülke listesi, devlet)
  const replaySchema = (s: SchemaEntry, tier: 0 | 1, cc: string, issuedAt: number, src: string) => {
    const who: Who = tier === 0 ? { role: "executor" } : { role: "state", state: cc };
    const hashes = s.content_hashes?.length ? s.content_hashes : [s.content_hash];
    const h = [...s.status_history].sort((a, b) => sec(a.since) - sec(b.since));
    let t = schemas.get(s.schema_id);
    if (!t) {
      if (!h.length || h[0].status !== "ACTIVE")
        return warnings.push(`${src} şema ${s.vct}: ilk durum ACTIVE değil — yazılmadı`);
      if (schemaIdOf(s.vct) !== s.schema_id) warnings.push(`${src} şema ${s.vct}: schema_id formülü tutmuyor`);
      push(sec(h[0].since), who, src, {
        op: "registerSchema",
        schemaId: s.schema_id,
        vct: s.vct,
        contentHash: sriToBytes32(hashes[0]),
        tier,
        state: tier === 1 ? cc : "",
      });
      t = { applied: 1, hashes: new Set([hashes[0]]), tier, state: cc };
      schemas.set(s.schema_id, t);
    }
    for (const x of hashes)
      if (!t.hashes.has(x)) {
        push(issuedAt, who, src, { op: "addSchemaHash", schemaId: s.schema_id, contentHash: sriToBytes32(x) });
        t.hashes.add(x);
      }
    if (!hashes.includes(s.content_hash) && !t.hashes.has(s.content_hash)) {
      push(issuedAt, who, src, {
        op: "addSchemaHash",
        schemaId: s.schema_id,
        contentHash: sriToBytes32(s.content_hash),
      });
      t.hashes.add(s.content_hash);
    }
    for (const e of h.slice(t.applied)) {
      const at = sec(e.since);
      if (!futureGuard(at, `${src} şema ${s.vct} ${e.status}`)) break;
      if (e.status === "DEPRECATED" || e.status === "REVOKED") {
        // ağ şemasının iptali yalnız Governance oyuyla (göç yürütücüsü iptal edemez; güvenlik turu 2026-11-04)
        const w: Who = e.status === "REVOKED" && tier === 0 ? { role: "governance" } : who;
        push(at, w, src, {
          op: "schemaStatus",
          schemaId: s.schema_id,
          status: e.status,
          reasonHash: reasonHash(e.reason),
        });
      } else warnings.push(`${src} şema ${s.vct}: şemada kullanılmayan durum geçişi ${e.status} — atlandı`);
      t.applied++;
    }
  };

  // ---- kurumlar
  const replayIssuer = (cc: string, i: Issuer, issuedAt: number, src: string) => {
    const who: Who = { role: "state", state: cc };
    issuerIdBySlug.set(`${cc}:${i.slug}`, i.issuer_id);
    const h = [...i.status_history].sort((a, b) => sec(a.since) - sec(b.since));
    let t = issuers.get(i.issuer_id);
    if (!t) {
      if (!h.length || h[0].status !== "ACTIVE")
        return warnings.push(`${src} kurum ${i.slug}: ilk durum ACTIVE değil — yazılmadı`);
      push(sec(h[0].since), who, src, {
        op: "registerIssuer",
        issuerId: i.issuer_id,
        state: cc,
        nameHash: keccakText(i.legal_name),
        category: ISSUER_CATEGORIES.indexOf(i.category),
        assurance: ["I1", "I2", "I3"].indexOf(i.assurance),
        fp: fpToBytes32(i.cert_fingerprint_sha256),
        parentCA: i.parent_ca_id,
        validFrom: sec(i.valid_from),
        validUntil: sec(i.valid_until),
      });
      t = { applied: 1, validUntil: sec(i.valid_until), state: cc, auth: new Map(), profile: "", delegates: false };
      issuers.set(i.issuer_id, t);
    }
    if (sec(i.valid_until) > t.validUntil) {
      push(issuedAt, who, src, { op: "renewIssuer", issuerId: i.issuer_id, validUntil: sec(i.valid_until) });
      t.validUntil = sec(i.valid_until);
    } else if (sec(i.valid_until) < t.validUntil)
      warnings.push(`${src} kurum ${i.slug}: geçerlilik sonu kısaldı — zincirde yalnız uzatılır (renewIssuer)`);
    const profile: IssuerProfileArgs = {
      issuerClass: ISSUER_CLASSES.indexOf(i.class),
      publicSector: !!i.is_public_sector_body,
      entitlements: entitlementMask(i.entitlements),
      registrationHash: detailsHash(registrationBlock(i)),
      operationsHash: detailsHash({
        issuer_url: i.issuer_url,
        status_list_base: i.status_list_base,
        revocation_policy_uri: i.revocation_policy_uri,
        assurance_basis: i.assurance_basis,
        authentic_source: i.authentic_source,
        delegate_keys: i.delegate_keys,
      }),
    };
    const pj = canonicalJson(profile);
    if (pj !== t.profile) {
      push(issuedAt, who, src, { op: "issuerProfile", issuerId: i.issuer_id, profile });
      t.profile = pj;
    }
    // şema yetki pencereleri: açılış valid_from, kapanış valid_until (yarı açık; ADR-0073 K5)
    for (const a of i.schema_authorizations) {
      if (!a.allowed) continue;
      const key = `${a.schema_id}|${a.valid_from}`;
      const state = t.auth.get(key); // undefined: yazılmadı · true: açık · false: kapandı
      if (state === undefined) {
        if (!futureGuard(sec(a.valid_from), `${src} kurum ${i.slug} yetki ${a.schema_id}`)) continue;
        push(sec(a.valid_from), who, src, {
          op: "schemaAuth",
          issuerId: i.issuer_id,
          schemaId: a.schema_id,
          allowed: true,
        });
        t.auth.set(key, true);
      }
      if (
        a.valid_until &&
        t.auth.get(key) === true &&
        futureGuard(sec(a.valid_until), `${src} kurum ${i.slug} yetki sonu`)
      ) {
        push(sec(a.valid_until), who, src, {
          op: "schemaAuth",
          issuerId: i.issuer_id,
          schemaId: a.schema_id,
          allowed: false,
        });
        t.auth.set(key, false);
      }
    }
    for (const e of h.slice(t.applied)) {
      const at = sec(e.since);
      if (!futureGuard(at, `${src} kurum ${i.slug} ${e.status}`)) break;
      if (["SUSPENDED", "ACTIVE", "REVOKED", "RETIRED"].includes(e.status)) {
        let successor: string | undefined;
        if ((e.status === "REVOKED" || e.status === "RETIRED") && i.successor_id) {
          // halef aynı devletin, iptal anında ACTIVE ve zincirde kayıtlı kurumu olmalı (kontrat: SuccessorNotActive,
          // CrossStateReference) — değilse halefsiz yazılır
          const sx = issuersNow.get(i.successor_id);
          const sh = sx && [...sx.issuer.status_history].sort((a, b) => sec(a.since) - sec(b.since));
          const live = sh?.filter((x) => sec(x.since) <= at).at(-1)?.status === "ACTIVE";
          if (sx && sx.cc === cc && live && issuers.has(i.successor_id) && i.successor_id !== i.issuer_id)
            successor = i.successor_id;
          else
            warnings.push(
              `${src} kurum ${i.slug}: halef ${i.successor_id} yazılamaz (aynı devletin ACTIVE kurumu değil)`,
            );
        }
        push(at, who, src, {
          op: "issuerStatus",
          issuerId: i.issuer_id,
          status: e.status as "SUSPENDED" | "ACTIVE" | "REVOKED" | "RETIRED",
          ...(successor ? { successor } : {}),
        });
        if (e.status === "REVOKED" && e.invalidates_from)
          push(at, who, src, {
            op: "issuerInvalidatesFrom",
            issuerId: i.issuer_id,
            invalidatesFrom: sec(e.invalidates_from),
          });
      } else warnings.push(`${src} kurum ${i.slug}: kurumda kullanılmayan durum ${e.status} (K5 "—") — durdu`);
      t.applied++;
    }
  };

  // ---- doğrulayıcılar (kimlik keccak256(dns_name); devir ve iptal sonrası yeniden kayıt Governance oyuyla — ADR-0075)
  const replayRp = (cc: string, rp: RelyingParty, issuedAt: number, src: string) => {
    const dns = rp.dns_name.toLowerCase();
    const rpId = rpIdOf(dns);
    const h = [...rp.status_history].sort((a, b) => sec(a.since) - sec(b.since));
    let t = rps.get(dns);
    const fp = fpToBytes32(rp.access_cert_fingerprint_sha256);
    if (!t) {
      if (!h.length || h[0].status !== "ACTIVE")
        return warnings.push(`${src} doğrulayıcı ${dns}: ilk durum ACTIVE değil — yazılmadı`);
      push(sec(rp.registered_at), { role: "state", state: cc }, src, {
        op: "registerRP",
        rpId,
        state: cc,
        nameHash: keccakText(rp.legal_name),
        fp,
      });
      t = {
        owner: cc,
        seenIn: new Set([cc]),
        applied: 1,
        historyLen: 1,
        fp,
        period: 0,
        scopes: new Map(),
        groups: new Map(),
        profile: "",
        revoked: false,
      };
      rps.set(dns, t);
    } else if (!t.seenIn.has(cc)) {
      // Kimlik başka bir ülke listesinde: devir (ADR-0075 RO1) — yalnız bu listede ilk görüldüğünde; eski listedeki kayıt
      // artık yazılmaz (sahibi değil). Liste tarafında aynı dns_name iki ülke listesinde kalırsa bilinen fark (rapor).
      if (t.revoked) {
        push(issuedAt, { role: "governance" }, src, {
          op: "rpPeriod",
          action: "RE_REGISTRATION",
          rpId,
          fromState: t.owner,
          toState: cc,
          nameHash: keccakText(rp.legal_name),
          fp,
          reasonHash: keccakText(`re-registration:${dns}:${cc}`),
          period: t.period + 1,
        });
        t.revoked = false;
      } else
        push(issuedAt, { role: "governance" }, src, {
          op: "rpPeriod",
          action: "REASSIGNMENT",
          rpId,
          fromState: t.owner,
          toState: cc,
          nameHash: keccakText(rp.legal_name),
          fp,
          reasonHash: keccakText(`reassignment:${dns}:${t.owner}->${cc}`),
          period: t.period + 1,
        });
      t.owner = cc;
      t.seenIn.add(cc);
      t.period++;
      t.historyLen++;
      t.fp = fp;
      t.applied = h.length; // yeni dönemin geçmişi bu yürütmeyle başlar
      t.scopes.clear();
      t.groups.clear();
      t.profile = "";
    }
    if (t.owner !== cc) return; // eski sahibin listesindeki kayıt (devirden sonra) yazılmaz
    const who: Who = { role: "state", state: cc };
    for (const e of h.slice(t.applied)) {
      const at = sec(e.since);
      if (!futureGuard(at, `${src} doğrulayıcı ${dns} ${e.status}`)) break;
      const st = e.status === "RETIRED" ? "REVOKED" : e.status;
      if (st === "ACTIVE" && t.revoked) {
        // iptal sonrası yeniden kayıt (RO2/RO5): yalnız Governance oyuyla, yeni dönem
        push(at, { role: "governance" }, src, {
          op: "rpPeriod",
          action: "RE_REGISTRATION",
          rpId,
          fromState: t.owner,
          toState: cc,
          nameHash: keccakText(rp.legal_name),
          fp,
          reasonHash: keccakText(e.reason ?? `re-registration:${dns}`),
          period: t.period + 1,
        });
        t.revoked = false;
        t.period++;
        t.historyLen++;
        t.fp = fp;
        t.scopes.clear();
        t.groups.clear();
        t.profile = "";
      } else if (st === "SUSPENDED" || st === "ACTIVE" || st === "REVOKED") {
        if (st === "REVOKED" && t.revoked) {
          t.applied++;
          continue;
        }
        t.historyLen++;
        push(at, who, src, { op: "rpStatus", rpId, status: st, historyLen: t.historyLen });
        if (st === "REVOKED") t.revoked = true;
      } else warnings.push(`${src} doğrulayıcı ${dns}: kullanılmayan durum ${e.status} — atlandı`);
      t.applied++;
    }
    if (t.revoked) return; // iptal edilmiş kayda kapsam / kapı grubu yazılmaz
    if (fp !== t.fp) {
      push(issuedAt, who, src, { op: "rpCert", rpId, fp });
      t.fp = fp;
    }
    const profile: RpProfileArgs = {
      publicSector: !!rp.is_public_sector_body,
      entitlements: entitlementMask(rp.entitlements),
      aliasPolicy: rp.pseudonyms === "single" ? 1 : rp.pseudonyms === "multiple" ? 2 : 0,
      registrationHash: detailsHash(registrationBlock(rp)),
      intermediaries: (rp.uses_intermediaries ?? []).map(rpIdOf),
      servedParties: (rp.served_relying_parties ?? []).map(rpIdOf),
    };
    const pj = canonicalJson(profile);
    if (pj !== t.profile) {
      push(issuedAt, who, src, { op: "rpProfile", rpId, period: t.period, profile });
      t.profile = pj;
    }
    for (const s of rp.scopes) {
      const a = scopeArgs(s);
      if (typeof a === "string") {
        warnings.push(`${src} doğrulayıcı ${dns}: ${a} — yazılmadı`);
        continue;
      }
      const j = canonicalJson(a);
      if (t.scopes.get(s.scope_id) === j) continue;
      push(issuedAt, who, src, { op: "rpScope", rpId, period: t.period, scope: a });
      t.scopes.set(s.scope_id, j);
    }
    for (const g of rp.terminal_groups ?? []) {
      const inst = g.institution_id
        ? (issuerIdBySlug.get(`${cc}:${g.institution_id}`) ?? rpIdOf(g.institution_id))
        : undefined;
      if (!inst || !g.allowed_policies?.length) {
        warnings.push(
          `${src} doğrulayıcı ${dns}: kapı grubu ${g.group_id} kurumsuz ya da politikasız — yazılmadı (TG1)`,
        );
        continue;
      }
      const a: GroupArgs = {
        groupId: groupIdOf(g.group_id),
        institutionId: inst,
        policyIds: g.allowed_policies.map(keccakText),
        certFingerprints: (g.cert_fingerprints ?? []).map(fpToBytes32),
        offlineAllowed: !!g.offline_allowed,
        validFrom: sec(g.valid_from),
        validUntil: g.valid_until ? sec(g.valid_until) : 0,
        labelHash: g.label ? keccakText(g.label) : ZERO32,
      };
      const j = canonicalJson(a);
      if (t.groups.get(g.group_id) === j) continue;
      push(issuedAt, who, src, { op: "rpGroup", rpId, period: t.period, group: a });
      t.groups.set(g.group_id, j);
    }
  };

  // ---- LOTL: tanıma, cüzdan sağlayıcılar
  const replayLotl = (l: Lotl, issuedAt: number, src: string) => {
    for (const s of l.schemas) replaySchema(s, 0, "", issuedAt, src);
    for (const nl of l.national_lists) {
      if (nl.status !== "ACTIVE") continue;
      const want = new Set((nl.recognition?.recognizes ?? []).filter((x) => x !== nl.state_code));
      const cur = recognition.get(nl.state_code) ?? new Set<string>();
      for (const r of [...want].sort())
        if (!cur.has(r))
          push(issuedAt, { role: "state", state: nl.state_code }, src, {
            op: "recognition",
            recognizing: nl.state_code,
            recognized: r,
            mode: 1,
          });
      for (const r of [...cur].sort())
        if (!want.has(r))
          push(issuedAt, { role: "state", state: nl.state_code }, src, {
            op: "recognition",
            recognizing: nl.state_code,
            recognized: r,
            mode: 0,
          });
      recognition.set(nl.state_code, want);
    }
    const STATUS = {
      ACTIVE: 1,
      SUSPENDED: 2,
      REVOKED: 3,
      RETIRED: 4,
      RESERVED: 5,
      PROVISIONAL: 6,
      DEPRECATED: 7,
    } as const;
    for (const wp of l.wallet_providers) {
      const providerId = keccakText(wp.provider_id);
      const rec: NetworkRecordArgs = {
        kind: 1,
        recordId: providerId,
        parentId: ZERO32,
        region: "0x0000",
        subtype: 0,
        status: STATUS[wp.status as keyof typeof STATUS] ?? 0,
        validFrom: 0,
        validUntil: 0,
        fingerprint: ZERO32,
        detailsHash: detailsHash({ legal_name: wp.legal_name }),
        flags: "0",
        digests: [],
      };
      writeRec(rec, issuedAt, src);
      for (const k of wp.wua_signing_keys)
        writeRec(
          {
            kind: 2,
            recordId: fpToBytes32(k.fingerprint_sha256),
            parentId: providerId,
            region: "0x0000",
            subtype: 0,
            status: STATUS[(k.status ?? "ACTIVE") as keyof typeof STATUS] ?? 0,
            validFrom: k.valid_from ? sec(k.valid_from) : 0,
            // liste `valid_to` dahil (activeFps: valid_to < now → dışarı); zincir yarı açık → bir saniye sonrası
            validUntil: k.valid_to ? sec(k.valid_to) + 1 : 0,
            fingerprint: fpToBytes32(k.fingerprint_sha256),
            detailsHash: ZERO32,
            flags: "0",
            digests: [],
          },
          issuedAt,
          src,
        );
    }
    // ADR-0074 K3: öteki ağ düzeyi kayıtlar (listeden kalkan kayıt RETIRED; silinmez)
    syncNet(
      "lotl",
      lotlNetworkRecords(l, archive.environment, warnings).map((x) => x.record),
      issuedAt,
      src,
    );
  };

  /** Ağ düzeyi kaydı yazar (içerik değiştiyse; kayıt başına son hâl). */
  const writeRec = (r: NetworkRecordArgs, at: number, src: string) => {
    const j = canonicalJson(r);
    const k = `${r.kind}:${r.recordId}`;
    if (records.get(k) === j) return;
    push(at, { role: "executor" }, src, { op: "networkRecord", record: r });
    records.set(k, j);
  };
  /** Kaynağın (LOTL ya da bir ülke listesi) bu sürümdeki ağ düzeyi kayıtları; önceki sürümde olup şimdi olmayan → RETIRED. */
  const netBySource = new Map<string, Map<string, NetworkRecordArgs>>();
  const syncNet = (source: string, cur: NetworkRecordArgs[], at: number, src: string) => {
    const prev = netBySource.get(source) ?? new Map<string, NetworkRecordArgs>();
    const now = new Map(cur.map((r) => [`${r.kind}:${r.recordId}`, r]));
    for (const r of cur) writeRec(r, at, src);
    for (const [k, r] of prev)
      if (!now.has(k)) {
        const retired = { ...r, status: NET_STATUS.RETIRED };
        writeRec(retired, at, src);
        now.set(k, retired);
      }
    netBySource.set(source, now);
  };

  for (const v of versions) {
    const src = `${v.file}@v${v.version}`;
    if (v.file === "lotl") replayLotl(Lotl.parse(payload(v.jws)), v.issuedAt, src);
    else {
      const tl = NationalList.parse(payload(v.jws));
      const cc = tl.state_code;
      issuersNow = new Map(tl.issuers.map((i) => [i.issuer_id, { cc, issuer: i }]));
      for (const ca of tl.root_cas) replayRoot(cc, ca, src);
      for (const s of tl.national_schemas) replaySchema(s, 1, cc, v.issuedAt, src);
      for (const i of tl.issuers) replayIssuer(cc, i, v.issuedAt, src);
      for (const rp of tl.relying_parties) replayRp(cc, rp, v.issuedAt, src);
      syncNet(
        v.file,
        nationalNetworkRecords(tl, archive.environment).map((x) => x.record),
        v.issuedAt,
        src,
      );
    }
  }

  // ---- iptal listesi çapaları (çapa günlüğü): kayıt + her yayın (L1; yayın anı açık tarih)
  const lists = new Map<string, number>();
  const issuerWithDelegate = new Set<string>();
  const applyStatusRow = (r: {
    issuer_id: string;
    list_uri: string;
    content_hash: string;
    list_version: number;
    published_at: string;
    bits?: number;
    size?: number;
  }) => {
    const iss = issuers.get(r.issuer_id);
    if (!iss) return warnings.push(`çapa ${r.list_uri}: kurum ${r.issuer_id} listede yok — atlandı`);
    const at = sec(r.published_at);
    const who: Who = { role: "state", state: iss.state }; // kurum delegesi = devlet delegesi (yürütücü atar)
    const listId = listIdOf(r.issuer_id, r.list_uri);
    if (!issuerWithDelegate.has(r.issuer_id)) {
      push(at, who, "anchors", { op: "issuerDelegates", issuerId: r.issuer_id });
      issuerWithDelegate.add(r.issuer_id);
    }
    if (!lists.has(listId)) {
      // bit sayısı ve boyut: çapa satırı (belirteçten) → belirtecin kendisi → varsayılan (gerçek ağda ret)
      const fromRow = r.bits !== undefined && r.size !== undefined ? { bits: r.bits, size: r.size } : null;
      const p = fromRow ?? opts.statusListParams?.(r.list_uri) ?? null;
      push(at, who, "anchors", {
        op: "registerList",
        issuerId: r.issuer_id,
        listUri: r.list_uri,
        listId,
        bits: p?.bits ?? 2,
        size: p?.size ?? 100_000,
        params: fromRow ? "anchor" : p ? "token" : "default",
      });
      lists.set(listId, 0);
    }
    if (r.list_version <= (lists.get(listId) ?? 0)) return;
    push(at, who, "anchors", {
      op: "publishList",
      listId,
      contentHash: tagToBytes32(r.content_hash),
      version: r.list_version,
    });
    lists.set(listId, r.list_version);
  };
  const lines = archive.anchorsJsonl.split(/\r?\n/).filter((l) => l.trim());
  for (const [k, line] of lines.entries()) {
    const a = payload<Record<string, unknown> & { kind: string }>(line);
    if (a.kind === "status_list") applyStatusRow(a as unknown as Parameters<typeof applyStatusRow>[0]);
    else if (a.kind === "checkpoint" && k === 0) {
      // arşivi budanmış günlük: baştaki kontrol noktasının durumu (TL12) ilk durum olarak
      const st = (a.state as { status_lists?: Array<Parameters<typeof applyStatusRow>[0]> } | undefined)?.status_lists;
      for (const r of st ?? []) applyStatusRow(r);
    }
  }
  const defaults = ops.filter((o) => o.op === "registerList" && o.params === "default").length;
  if (defaults)
    warnings.push(
      `${defaults} iptal listesinin bit sayısı ve boyutu ne çapa satırında ne belirteçte bulundu — varsayılan (2 bit, 100000) planlandı; gerçek ağ yazımı bunu reddeder`,
    );

  // ---- sırala: zaman, sonra bağımlılık sırası (kayıt → yetki → durum), sonra ekleniş (kayıt içi sıra korunur)
  ops.sort((a, b) => a.at - b.at || rankOf(a) - rankOf(b) || a.seq - b.seq);
  ops.forEach((o, k) => (o.seq = k));

  const summary: Record<string, number> = {};
  for (const o of ops) summary[o.op] = (summary[o.op] ?? 0) + 1;
  const hash =
    "0x" +
    createHash("sha256")
      .update(canonicalJson({ format: REPLAY_PLAN_FORMAT, environment: archive.environment, planTime, ops }), "utf8")
      .digest("hex");
  return { format: REPLAY_PLAN_FORMAT, environment: archive.environment, planTime, ops, hash, warnings, summary };
}

/**
 * Çapa günlüğünde bit sayısı ve boyutu OLMAYAN iptal listelerinin adresleri (ilk kayıt satırına göre) — yeniden oynatma aracı bunları
 * belirteçten okur (`PlanOptions.statusListParams`). Satır (ya da baştaki kontrol noktası) bu alanları taşıyorsa liste burada yoktur.
 */
export function statusListUrisMissingParams(archive: ArchiveSet): string[] {
  const seen = new Map<string, boolean>();
  const note = (r: { list_uri: string; bits?: number; size?: number }) => {
    if (!seen.has(r.list_uri)) seen.set(r.list_uri, r.bits !== undefined && r.size !== undefined);
  };
  const lines = archive.anchorsJsonl.split(/\r?\n/).filter((l) => l.trim());
  for (const [k, line] of lines.entries()) {
    const a = payload<Record<string, unknown> & { kind: string }>(line);
    if (a.kind === "status_list") note(a as unknown as { list_uri: string });
    else if (a.kind === "checkpoint" && k === 0)
      for (const r of (a.state as { status_lists?: Array<{ list_uri: string }> } | undefined)?.status_lists ?? [])
        note(r);
  }
  return [...seen].filter(([, has]) => !has).map(([u]) => u);
}
