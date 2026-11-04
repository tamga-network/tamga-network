/**
 * `ChainTrustSource` — `TrustSource(chain)` (ADR-0015 K3; ADR-0074 K5; SPEC-BC-0001 §11.2). İndeksleyicinin dizininden (sabitlenmiş
 * blok) aynı arayüzü sunar; liste kaynağıyla aynı soruya aynı cevabı vermesi ADR-0009 K7 / ADR-0073 K6 eşdeğerlik testiyle
 * kanıtlanır. Kurallar kontratın okuma kurallarının aynısıdır:
 *   C1 `isCredentialAcceptable`  = IssuerRegistry.isCredentialAcceptable (iat anındaki durum, yarı açık, sert iptal, kök iat anında
 *                                  ACTIVE ve hiç REVOKED değil)
 *   C2 `isCredentialSchemaAcceptable` = şema iat anında ACTIVE ve hiç REVOKED değil ∧ yetki penceresi [since, until)
 *   C3 `isRecognizedBy`          = CrossRecognition.isRecognizedBy (kendi devleti, engel, FULL / kategori)
 *   D5 `statusAnchor`            = StatusListRegistry çapası (liste kimliği doğrulayıcının araması: adresin son parçası)
 * İndeks bayatsa (blok zamanı çok eski) ya da hiç senkronlanmadıysa cevap `UNKNOWN` / boş (CMP4). Zincirde metin yok (PJ2):
 * kayıtlar liste biçiminde döner ama ad, adres gibi alanlar boştur; doğrulayıcı kaydında `dns_name` yalnız çağıranın bildiği
 * adla doldurulur (zincirde yalnız özeti var).
 * `@tamga-network/trust/core`'a girmez (ADR-0015 K1: çekirdek zincir istemcisi taşımaz); servisler bunu doğrudan kullanır.
 */
import type {
  Issuer,
  RelyingParty,
  SchemaEntry,
  StatusAnchorRow,
  TerminalGroupAnswer,
  Tri,
  TrustSource,
  ZkCircuit,
} from "@tamga-network/trust";

import { ISSUER_CATEGORIES, ISSUER_CLASSES, PRESENTATION_FORMATS, RecordKind } from "./contracts.js";
import {
  ZERO32,
  bytes32ToFp,
  bytes32ToSri,
  bytes32ToTag,
  groupIdOf,
  isoOf,
  keccakText,
  listLookupIdOf,
  rpIdOf,
  schemaIdOf,
} from "./ids.js";
import { recordKey, type ChainIndex, type Hist, type IxRP, type IxRecord } from "./indexer.js";
import { ZK_SYSTEMS } from "./network-records.js";

export interface ChainTrustSourceOptions {
  /** şimdiki zaman (test); varsayılan saat */
  now?: () => Date;
  /** dizinin son bloğu bundan eskiyse bayat (saniye; varsayılan 2 saat, çapa günlüğü kadansıyla aynı) */
  maxAgeSec?: number;
  /** çağıranın bildiği alan adları (doğrulayıcı kaydında `dns_name` göstermek için; zincirde yalnız özet var) */
  dnsNames?: string[];
}

/** `t` anındaki durum: since ≤ t olan son değişiklik; yoksa 0 (NONE) — StatusHistory.statusAt ile aynı. */
export function statusAtChain(h: Hist, t: number): number {
  for (let i = h.length - 1; i >= 0; i--) if (h[i][0] <= t) return h[i][1];
  return 0;
}
const ever = (h: Hist, status: number) => h.some((c) => c[1] === status);

const ISSUER_STATUS = ["NONE", "ACTIVE", "SUSPENDED", "REVOKED"] as const;
const CA_STATUS = ["NONE", "ACTIVE", "SUSPENDED", "RETIRED", "REVOKED"] as const;
const SCHEMA_STATUS = ["NONE", "ACTIVE", "DEPRECATED", "REVOKED"] as const;
const RP_STATUS = ["NONE", "ACTIVE", "SUSPENDED", "REVOKED"] as const;

export class ChainTrustSource implements TrustSource {
  private readonly now: () => Date;
  private readonly dnsByRpId = new Map<string, string>();
  private readonly listsByLookup = new Map<string, string>();
  constructor(
    private readonly ix: ChainIndex,
    private readonly opts: ChainTrustSourceOptions = {},
  ) {
    this.now = opts.now ?? (() => new Date());
    for (const d of opts.dnsNames ?? []) this.dnsByRpId.set(rpIdOf(d), d.toLowerCase());
    for (const l of Object.values(ix.lists)) this.listsByLookup.set(listLookupIdOf(l.listUri), l.listId);
  }

  private unhealthy(): boolean {
    if (this.ix.meta.block < 0) return true;
    const age = Math.floor(this.now().getTime() / 1000) - this.ix.meta.blockTimestamp;
    return age > (this.opts.maxAgeSec ?? 7200);
  }

  freshness() {
    const age = Math.floor(this.now().getTime() / 1000) - this.ix.meta.blockTimestamp;
    return { source: "chain" as const, version: this.ix.meta.block, ageSec: age, healthy: !this.unhealthy() };
  }

  isCredentialAcceptable(issuerId: string, iat: number): Tri {
    if (this.unhealthy()) return "UNKNOWN";
    const i = this.ix.issuers[issuerId.toLowerCase()];
    if (!i) return "NO";
    if (iat < i.validFrom || iat > i.validUntil) return "NO";
    if (statusAtChain(i.history, iat) !== 1) return "NO";
    if (i.invalidatesFrom !== 0 && iat >= i.invalidatesFrom) return "NO";
    const ca = this.ix.rootCAs[i.parentCA];
    if (!ca || ever(ca.history, 4) || statusAtChain(ca.history, iat) !== 1) return "NO";
    return "YES";
  }

  isCredentialSchemaAcceptable(issuerId: string, schemaId: string, iat: number): Tri {
    if (this.unhealthy()) return "UNKNOWN";
    const s = this.ix.schemas[schemaId.toLowerCase()];
    if (!s || ever(s.history, 3) || statusAtChain(s.history, iat) !== 1) return "NO";
    const w = this.ix.issuers[issuerId.toLowerCase()]?.auth[schemaId.toLowerCase()] ?? [];
    return w.some(([since, until]) => since !== 0 && iat >= since && (until === 0 || iat < until)) ? "YES" : "NO";
  }

  isRecognizedBy(stateCode: string, issuerId: string): Tri {
    if (this.unhealthy()) return "UNKNOWN";
    const i = this.ix.issuers[issuerId.toLowerCase()];
    if (!i) return "NO";
    const blocked = (this.ix.blocklist[stateCode] ?? []).includes(issuerId.toLowerCase());
    if (i.state === stateCode) return blocked ? "NO" : "YES";
    if (blocked) return "NO";
    const p = this.ix.recognition[stateCode]?.[i.state];
    if (!p || p.mode === 0) return "NO";
    if (p.mode === 1) return "YES";
    return p.categories.includes(i.category) ? "YES" : "NO";
  }

  schemaContentHash(schemaId: string): string | null {
    if (this.unhealthy()) return null;
    const s = this.ix.schemas[schemaId.toLowerCase()];
    return s?.hashes.length ? bytes32ToSri(s.hashes[s.hashes.length - 1]) : null;
  }
  schemaContentHashes(schemaId: string): string[] {
    if (this.unhealthy()) return [];
    return (this.ix.schemas[schemaId.toLowerCase()]?.hashes ?? []).map(bytes32ToSri);
  }

  statusAnchor(listId: string): StatusAnchorRow | null {
    if (this.unhealthy()) return null;
    const id = this.listsByLookup.get(listId.toLowerCase()) ?? listId.toLowerCase();
    const l = this.ix.lists[id];
    if (!l || l.version === 0) return null;
    return {
      list_id: listLookupIdOf(l.listUri),
      issuer_id: l.issuerId,
      list_uri: l.listUri,
      content_hash: bytes32ToTag(l.contentHash),
      version: l.version,
      published_at: isoOf(l.publishedAt),
      seq: 0,
    };
  }

  private rpRecord(rp: IxRP, dns?: string): RelyingParty {
    const fp = bytes32ToFp(rp.fp);
    return {
      rp_id: rp.rpId,
      client_id: `x509_hash:${Buffer.from(fp, "hex").toString("base64url")}`,
      dns_name: dns ?? this.dnsByRpId.get(rp.rpId) ?? "",
      legal_name: "",
      access_cert_fingerprint_sha256: fp,
      status: RP_STATUS[rp.status] ?? "NONE",
      registered_at: isoOf(rp.registeredAt),
      // zincirde kapsamlar özet biçimindedir (öğe yolu metni yok); aşırı istek denetimi `mayRequest` ile
      scopes: [],
      status_history: rp.history.map(([since, st]) => ({ status: RP_STATUS[st], since: isoOf(since) })),
    } as unknown as RelyingParty;
  }
  relyingParty(clientId: string): RelyingParty | null {
    if (this.unhealthy()) return null;
    const m = /^x509_hash:([A-Za-z0-9_-]{43})$/.exec(clientId);
    if (!m) return null;
    const fp = "0x" + Buffer.from(m[1], "base64url").toString("hex");
    const rp = this.ix.rps[this.ix.certOwner[fp] ?? ""];
    return rp ? this.rpRecord(rp) : null;
  }
  relyingPartyByDnsName(dnsName: string): RelyingParty | null {
    if (this.unhealthy()) return null;
    const rp = this.ix.rps[rpIdOf(dnsName)];
    return rp ? this.rpRecord(rp, dnsName.toLowerCase()) : null;
  }
  /**
   * `t` anında doğrulayıcı ACTIVE mi (RelyingPartyRegistry.isRelyingPartyAcceptableAt; durum geçmişi yarı açık). Liste kaynağında
   * aynı soru kaydın `status_history`'sidir; devir ve iptal sonrası yeniden kaydın zincir tarihi yürütme anıdır (ADR-0075).
   */
  isRelyingPartyAcceptableAt(dnsName: string, t: number): Tri {
    if (this.unhealthy()) return "UNKNOWN";
    const rp = this.ix.rps[rpIdOf(dnsName)];
    return rp && statusAtChain(rp.history, t) === 1 ? "YES" : "NO";
  }
  /** Zincirdeki istek kapsamları (özet biçiminde; ADR-0073 K4). */
  requestScopes(dnsName: string) {
    if (this.unhealthy()) return [];
    return this.ix.rps[rpIdOf(dnsName)]?.scopes ?? [];
  }
  /**
   * Aşırı istek denetimi (RelyingPartyRegistry.mayRequest): doğrulayıcı ACTIVE ve şu an geçerli bir kapsamda bu hizmet, tür, biçim,
   * ad alanı ve öğe var mı.
   */
  mayRequest(
    dnsName: string,
    serviceId: string,
    vct: string,
    format: (typeof PRESENTATION_FORMATS)[number],
    mdocNamespace: string | undefined,
    attributePath: string,
  ): Tri {
    if (this.unhealthy()) return "UNKNOWN";
    const rp = this.ix.rps[rpIdOf(dnsName)];
    if (!rp || rp.status !== 1) return "NO";
    const now = Math.floor(this.now().getTime() / 1000);
    const ns = mdocNamespace ? keccakText(mdocNamespace) : ZERO32;
    const attr = keccakText(attributePath);
    return rp.scopes.some(
      (s) =>
        s.serviceHash === keccakText(serviceId) &&
        s.schemaId === schemaIdOf(vct) &&
        s.format === PRESENTATION_FORMATS.indexOf(format) &&
        s.namespaceHash === ns &&
        now >= s.validFrom &&
        (s.validUntil === 0 || now < s.validUntil) &&
        s.attributes.includes(attr),
    )
      ? "YES"
      : "NO";
  }

  issuer(issuerId: string): Issuer | null {
    if (this.unhealthy()) return null;
    const i = this.ix.issuers[issuerId.toLowerCase()];
    if (!i) return null;
    return {
      issuer_id: i.issuerId,
      slug: "",
      legal_name: "",
      category: ISSUER_CATEGORIES[i.category],
      assurance: (["I1", "I2", "I3"] as const)[i.assurance],
      class: ISSUER_CLASSES[i.profile.issuerClass] === "NONE" ? "EAA" : ISSUER_CLASSES[i.profile.issuerClass],
      parent_ca_id: i.parentCA,
      cert_fingerprint_sha256: bytes32ToFp(i.fp),
      issuer_url: "",
      status_list_base: "",
      status: ISSUER_STATUS[i.status],
      valid_from: isoOf(i.validFrom),
      valid_until: isoOf(i.validUntil),
      successor_id: i.successor && i.successor !== ZERO32 ? i.successor : null,
      status_history: i.history.map(([since, st]) => ({
        status: ISSUER_STATUS[st],
        since: isoOf(since),
        ...(st === 3 && i.invalidatesFrom ? { invalidates_from: isoOf(i.invalidatesFrom) } : {}),
      })),
      schema_authorizations: Object.entries(i.auth).flatMap(([schemaId, ws]) =>
        ws.map(([since, until]) => ({
          schema_id: schemaId,
          allowed: true,
          valid_from: isoOf(since),
          valid_until: until ? isoOf(until) : null,
        })),
      ),
    } as unknown as Issuer;
  }
  issuers(): Issuer[] {
    if (this.unhealthy()) return [];
    return Object.keys(this.ix.issuers).map((id) => this.issuer(id)!);
  }
  schema(schemaId: string): SchemaEntry | null {
    if (this.unhealthy()) return null;
    const s = this.ix.schemas[schemaId.toLowerCase()];
    if (!s) return null;
    return {
      schema_id: s.schemaId,
      vct: s.vct,
      metadata_url: "",
      content_hash: bytes32ToSri(s.hashes[s.hashes.length - 1]),
      content_hashes: s.hashes.map(bytes32ToSri),
      layer: s.tier === 0 ? "NETWORK" : "NATIONAL",
      status: SCHEMA_STATUS[s.status],
      registered_at: isoOf(s.history[0]?.[0] ?? 0),
      status_history: s.history.map(([since, st]) => ({ status: SCHEMA_STATUS[st], since: isoOf(since) })),
    } as unknown as SchemaEntry;
  }
  /** Kök sertifikanın zincirdeki durumu (liste biçiminde ad; ROLLING_OVER halef olayından). */
  rootCAStatus(caId: string): string | null {
    const r = this.ix.rootCAs[caId.toLowerCase()];
    if (!r) return null;
    return r.status === 1 && r.successor ? "ROLLING_OVER" : CA_STATUS[r.status];
  }

  isWalletProviderKey(fingerprintHex: string): Tri {
    if (this.unhealthy()) return "UNKNOWN";
    const now = Math.floor(this.now().getTime() / 1000);
    const live = (r: { status: number; validFrom: number; validUntil: number } | undefined) =>
      !!r && r.status === 1 && now >= r.validFrom && (r.validUntil === 0 || now < r.validUntil);
    const k = this.ix.records[recordKey(RecordKind.WALLET_PROVIDER_KEY, "0x" + fingerprintHex.toLowerCase())];
    if (!live(k)) return "NO";
    return live(this.ix.records[recordKey(RecordKind.WALLET_PROVIDER, k!.parentId)]) ? "YES" : "NO";
  }

  /** Doğrulayıcının kayıt dönemleri (ADR-0075; dönem 0 ilk kayıt). */
  registrationPeriods(dnsName: string): Array<{ state: string; since: number }> {
    return this.ix.rps[rpIdOf(dnsName)]?.periods ?? [];
  }
  /** Dizindeki bütün ağ düzeyi kayıtlar (eşdeğerlik: listeden kalkmış kayıt zincirde etkin kalmamalı). */
  networkRecords(): IxRecord[] {
    return Object.values(this.ix.records);
  }
  /** Ağ düzeyi kayıt (ADR-0074 K3; `NetworkRegistry.getRecord`) — dizindeki hâli; yoksa null. */
  networkRecord(kind: number, recordId: string): IxRecord | null {
    if (this.unhealthy()) return null;
    return this.ix.records[recordKey(kind, recordId)] ?? null;
  }

  /**
   * ADR-0032 ZK2: zincirdeki ETKİN (ACTIVE) ZK devresi; yoksa null. `circuit_id` zincirde yalnız özet olarak durduğundan çağıranın
   * verdiği kimlikle eşlenir; dosya özeti, sistem, sürüm ve öznitelik sayısı kayıttan.
   */
  zkCircuit(circuitId: string): ZkCircuit | null {
    const r = this.networkRecord(RecordKind.ZK_CIRCUIT, keccakText(circuitId));
    if (!r || r.status !== 1) return null;
    const flags = BigInt(r.flags);
    return {
      circuit_id: circuitId,
      system: ZK_SYSTEMS[r.subtype - 1],
      version: Number(flags >> 32n),
      attributes: Number(flags & 0xffffffffn),
      sha256: bytes32ToFp(r.fingerprint),
      status: "ACTIVE",
    } as ZkCircuit;
  }

  terminalGroup(groupId: string): TerminalGroupAnswer | null {
    if (this.unhealthy()) return null;
    const gid = groupIdOf(groupId);
    for (const rp of Object.values(this.ix.rps)) {
      const g = rp.groups.find((x) => x.groupId === gid);
      if (!g) continue;
      const now = Math.floor(this.now().getTime() / 1000);
      const inst = this.ix.issuers[g.institutionId] ?? this.ix.rps[g.institutionId];
      const active =
        rp.status === 1 &&
        now >= g.validFrom &&
        (g.validUntil === 0 || now < g.validUntil) &&
        (inst === undefined || inst.status === 1);
      return {
        group: {
          group_id: groupId,
          valid_from: isoOf(g.validFrom),
          valid_until: g.validUntil ? isoOf(g.validUntil) : null,
          offline_allowed: g.offlineAllowed,
          cert_fingerprints: g.certFingerprints.map(bytes32ToFp),
        },
        rp_dns_name: this.dnsByRpId.get(rp.rpId) ?? "",
        active,
      } as TerminalGroupAnswer;
    }
    return null;
  }
}
