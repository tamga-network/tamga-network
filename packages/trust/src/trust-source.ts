/**
 * TrustSource — SPEC-BC-0001 §11.2 okuma seti; beta = liste, Faz 0 = zincir (aynı arayüz).
 * Üç değerli cevaplar: YES / NO / UNKNOWN (UNKNOWN → verifier INDETERMINATE; CMP4/BT5).
 *
 * Zaman kuralı (D-BC-3, R1/R3): C1/C2 belgenin `iat`'ına göre bakar — "o zaman verebilir miydi?"
 *  - Issuer: iat anındaki statü ACTIVE olmalı; iat, valid_from..valid_until içinde olmalı.
 *    Sonraki SUSPENDED/RETIRED/withdraw eski belgeleri düşürmez (GV1).
 *    REVOKED + `invalidates_from` ≤ iat ise düşer (ele geçirilme, CA2 mantığı).
 *  - Şema yetkisi: allowed && valid_from ≤ iat < valid_until (I3).
 *  - Şema: REVOKED → NO; DEPRECATED → yalnızca deprecation anından önce verilmişse YES (SC3).
 *
 * Tazelik (BT5/CMP4): kaynak bayatken kayıt okuyucuları da (issuer, schema, relyingParty, statusAnchor, şema özetleri, kurum
 * dizini) cevap VERMEZ — null / boş döner. Bayat listeden okunan kayıt kararda kullanılmasın; doğrulayıcı tazeliği T0'da
 * `freshness()` ile ayrıca denetler ve bayat kaynakta INDETERMINATE döner.
 */
import { activeFps, type TrustStore, type StatusAnchorRow, type ExternalEntity } from "./store.js";
import type { Issuer, RelyingParty, SchemaEntry, StatusHistoryEntry, TerminalGroup, ZkCircuit } from "./types.js";

export type Tri = "YES" | "NO" | "UNKNOWN";

export interface TrustSource {
  isCredentialAcceptable(issuerId: string, iat: number): Tri;
  isCredentialSchemaAcceptable(issuerId: string, schemaId: string, iat: number): Tri;
  isRecognizedBy(stateCode: string, issuerId: string): Tri;
  schemaContentHash(schemaId: string): string | null;
  /** ADR-0010 K4: geçerli tüm sürüm özetleri (güncel dahil); kayıt yoksa boş */
  schemaContentHashes(schemaId: string): string[];
  statusAnchor(listId: string): StatusAnchorRow | null;
  relyingParty(clientId: string): RelyingParty | null;
  /** ADR-0034: kalıcı kayıt kimliğiyle (alan adı) — sertifika yenilemesinden etkilenmez. */
  relyingPartyByDnsName(dnsName: string): RelyingParty | null;
  issuer(issuerId: string): Issuer | null;
  schema(schemaId: string): SchemaEntry | null;
  isWalletProviderKey(fingerprintHex: string): Tri;
  /** ADR-0032 ZK2: imzalı listede kabul edilen ZK devresi (yalnız ACTIVE); yoksa null → ispat RED. */
  zkCircuit?(circuitId: string): ZkCircuit | null;
  /** ADR-0032: imzalı listedeki tüm ETKİN ZK devreleri (DCQL `zk_system_type` için). */
  zkCircuits?(): ZkCircuit[];
  freshness(): { source: "list" | "chain"; version: number; ageSec: number; healthy: boolean };
  /**
   * ADR-0036 federasyon: belge zinciri bir dış liste çapasına bağlandıysa o kurumun Tamga gösterimi. Çapa dış listede değilse
   * null (Tamga kaydı aranır). Liste bayatsa ya da eksikse tri=UNKNOWN; tür kapsam dışıysa NO (FD2).
   */
  externalIssuerByAnchor?(anchorFingerprint: string, vct: string, iat: number): ExternalIssuerAnswer | null;
  /** ADR-0036: tazelik içindeki dış listelerin çapa sertifikaları (DER) — doğrulayıcının kök kümesine eklenir. */
  externalAnchorCertsDer?(): Uint8Array[];
  /** ADR-0036: dış cüzdan sağlayıcısının kapsamındaki en az anahtar deposu (yoksa null). */
  walletProviderMinKeyStorage?(fingerprintHex: string): string | null;
  /** ADR-0049 (0.6.0): "Tamga Network'te listeli" göstergesi için imzalı listedeki cüzdan sağlayıcısı kaydı. */
  walletProviderListing?(providerId: string, opts?: WalletProviderListingOptions): WalletProviderListing;
  /**
   * ADR-0012 K5 / ADR-0069: imzalı listedeki kapı grubu (doğrulayıcı kaydının `terminal_groups[]`'i). Listede yoksa ya da liste
   * bayatsa null. `active` = doğrulayıcı ACTIVE ve grup şu an geçerlilik aralığında (geri çekilmiş grup `active: false`).
   * "Liste bayat" ile "grup listede yok"u ayırmak için önce `freshness().healthy`'ye bakın: sağlıksız kaynakta null "bilinmiyor"
   * demektir ve kapı kapalı kalmalıdır (bir kez listelenmiş grup ya da kuruma bağlı anahtar için; ADR-0069 TG3).
   */
  terminalGroup?(groupId: string): TerminalGroupAnswer | null;
  /** ADR-0069 (hazırlık): sertifikalı kapı — sertifika parmak izinin (SHA-256, onaltılık) bağlı olduğu ETKİN kapı grubu. */
  terminalGroupByCertFingerprint?(fingerprintHex: string): TerminalGroupAnswer | null;
}

/** ADR-0069: kapı grubu cevabı — grup kaydı, bağlı olduğu doğrulayıcının kalıcı kimliği ve şu an etkin mi. */
export interface TerminalGroupAnswer {
  group: TerminalGroup;
  rp_dns_name: string;
  active: boolean;
}

export interface WalletProviderListingOptions {
  /** cüzdan çözümünün kimliği (`solutions[].solution_id`); verilirse çözüm kaydı da `ACTIVE` olmalı */
  solutionId?: string;
  /** cüzdan biriminin iptal edildiğini cüzdan biliyor (sağlayıcının iptali, kişinin isteği ya da WIA iptal listesi) */
  unitRevoked?: boolean;
}
/** Göstergenin neden gizlendiği (ADR-0049 K3) — gösterilmiyorsa biri. */
export type WalletProviderListingHidden =
  | "list_unavailable"
  | "sandbox"
  | "not_listed"
  | "provider_not_active"
  | "solution_not_listed"
  | "solution_not_active"
  | "unit_revoked";
export interface WalletProviderListing {
  /** göstergeyi göster: kayıt (ve varsa çözüm) `ACTIVE`, liste doğrulanmış ve taze, gerçek ağ, birim iptal edilmemiş */
  listed: boolean;
  /** gizlenme nedeni (`listed` false iken) */
  hidden?: WalletProviderListingHidden;
  provider_id: string;
  /** kaydın durumu (`ACTIVE`, `SUSPENDED`, `REVOKED`, `RESERVED` …); kayıt yoksa null */
  status: string | null;
  /** sağlayıcının resmî adı (imzalı listeden); kayıt yoksa null */
  legal_name: string | null;
  /** sağlayıcının etkin WIA/KA imza anahtarının SHA-256 parmak izi (ilk etkin anahtar); yoksa null */
  fingerprint: string | null;
  /** çözüm kaydı (verildiyse ve listede varsa) */
  solution?: { solution_id: string; status: string; security_level?: string; min_version?: string };
  /** listenin yayın zamanı ve sürümü (kayıt sayfası için) */
  list_issued_at: string | null;
  list_version: number | null;
}

export interface ExternalIssuerAnswer {
  tri: Tri;
  /** Doğrulama politikası için Tamga biçiminde kayıt (kapsamdan: kategori, güven seviyesi, sınıf). */
  issuer: Issuer | null;
  list_id: string;
  territory: string;
  recognized_by: string[];
  /** Dış listenin bu kurum için bildirdiği iptal sunucularının alan adları (hizmet erişim noktaları; yoksa boş) */
  status_hosts: string[];
}

const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/** iat anındaki statü (status_history `since` sıralı varsayılır; sıralanır). */
export function statusAt(history: StatusHistoryEntry[], iat: number): StatusHistoryEntry | null {
  const sorted = [...history].sort((a, b) => sec(a.since) - sec(b.since));
  let cur: StatusHistoryEntry | null = null;
  for (const h of sorted) {
    if (sec(h.since) <= iat) cur = h;
    else break;
  }
  return cur;
}
function laterCompromise(history: StatusHistoryEntry[], iat: number): boolean {
  return history.some((h) => h.status === "REVOKED" && h.invalidates_from && sec(h.invalidates_from) <= iat);
}

export class ListTrustSource implements TrustSource {
  constructor(
    private store: TrustStore,
    private now: () => Date = () => new Date(),
  ) {}

  private unhealthy(): boolean {
    const f = this.store.getFreshness();
    return !f || !f.healthy || (f.staleAfter !== undefined && this.now().getTime() > f.staleAfter.getTime());
  }

  isCredentialAcceptable(issuerId: string, iat: number): Tri {
    if (this.unhealthy()) return "UNKNOWN";
    const i = this.store.issuers.get(issuerId);
    if (!i) return "NO";
    if (iat < sec(i.valid_from) || iat > sec(i.valid_until)) return "NO";
    const st = statusAt(i.status_history, iat);
    if (!st || st.status !== "ACTIVE") return "NO";
    if (laterCompromise(i.status_history, iat)) return "NO";
    // Kök CA: iat anında ACTIVE/ROLLING_OVER olmalı; REVOKED kök tüm altını düşürür (CA2)
    const ca = this.store.root_cas.get(i.parent_ca_id);
    if (!ca) return "NO";
    const cst = statusAt(ca.status_history, iat);
    if (!cst || !["ACTIVE", "ROLLING_OVER"].includes(cst.status)) return "NO";
    if (ca.status_history.some((h) => h.status === "REVOKED")) return "NO";
    return "YES";
  }

  isCredentialSchemaAcceptable(issuerId: string, schemaId: string, iat: number): Tri {
    if (this.unhealthy()) return "UNKNOWN";
    const s = this.store.schemas.get(schemaId);
    if (!s) return "NO";
    const sst = statusAt(s.status_history, iat);
    if (!sst || sst.status !== "ACTIVE") return "NO"; // DEPRECATED sonrası ihraç → NO; öncesi → geçmiş ACTIVE
    if (s.status_history.some((h) => h.status === "REVOKED")) return "NO";
    const auths = this.store.issuer_schema_auth.get(issuerId) ?? [];
    const ok = auths.some(
      (a) =>
        a.schema_id === schemaId &&
        a.allowed &&
        sec(a.valid_from) <= iat &&
        (a.valid_until === null || iat < sec(a.valid_until)),
    );
    return ok ? "YES" : "NO"; // D9/I1: varsayılan false (allowlist)
  }

  isRecognizedBy(stateCode: string, issuerId: string): Tri {
    if (this.unhealthy()) return "UNKNOWN";
    const i = this.store.issuers.get(issuerId);
    if (!i) return "NO";
    const issuerState = [...this.store.national.entries()].find(([, v]) =>
      v.list.issuers.some((x) => x.issuer_id === issuerId),
    )?.[0];
    if (!issuerState) return "NO";
    if (issuerState === stateCode) return "YES";
    return this.store.recognition.get(stateCode)?.has(issuerState) ? "YES" : "NO";
  }

  schemaContentHash(schemaId: string): string | null {
    if (this.unhealthy()) return null;
    return this.store.schemas.get(schemaId)?.content_hash ?? null;
  }
  schemaContentHashes(schemaId: string): string[] {
    if (this.unhealthy()) return [];
    const s = this.store.schemas.get(schemaId);
    if (!s) return [];
    return s.content_hashes?.length ? s.content_hashes : [s.content_hash];
  }
  statusAnchor(listId: string): StatusAnchorRow | null {
    if (this.unhealthy()) return null;
    return this.store.status_anchors.get(listId) ?? null;
  }
  relyingParty(clientId: string): RelyingParty | null {
    if (this.unhealthy()) return null;
    return this.store.relying_parties.get(clientId) ?? null;
  }
  relyingPartyByDnsName(dnsName: string): RelyingParty | null {
    if (this.unhealthy()) return null;
    return this.store.relying_parties_by_dns.get(dnsName.toLowerCase()) ?? null;
  }
  /** Kayıtlı tüm belge verenler (kurum dizini; ADR-0015 K2). Kişisel veri yok. Bayat kaynakta boş. */
  issuers(): Issuer[] {
    if (this.unhealthy()) return [];
    return [...this.store.issuers.values()];
  }
  issuer(issuerId: string): Issuer | null {
    if (this.unhealthy()) return null;
    return this.store.issuers.get(issuerId) ?? null;
  }
  schema(schemaId: string): SchemaEntry | null {
    if (this.unhealthy()) return null;
    return this.store.schemas.get(schemaId) ?? null;
  }
  /** ADR-0032 ZK2: yalnız ETKİN (ACTIVE) devreler; bayat kaynakta boş. */
  zkCircuits(): ZkCircuit[] {
    if (this.unhealthy()) return [];
    return [...this.store.zk_circuits.values()].filter((c) => c.status === "ACTIVE");
  }

  /** ADR-0032 ZK2: devre yalnız ACTIVE ise döner (askıdaki/geri çekilmiş/bilinmeyen → null → ispat RED). */
  zkCircuit(circuitId: string): ZkCircuit | null {
    if (this.unhealthy()) return null;
    const c = this.store.zk_circuits.get(circuitId);
    return c && c.status === "ACTIVE" ? c : null;
  }

  isWalletProviderKey(fp: string): Tri {
    if (this.unhealthy()) return "UNKNOWN";
    const ext = this.store.external_wallet_keys.get(fp);
    if (ext) return this.externalFresh(ext.list_id) ? "YES" : "UNKNOWN";
    return this.store.wallet_provider_keys.has(fp) ? "YES" : "NO";
  }

  /** ADR-0036: dış liste yüklü ve NextUpdate geçmemiş mi (Tamga listesi de sağlıklı olmalı). */
  private externalFresh(listId: string): boolean {
    const st = this.store.external_lists.get(listId);
    return !!st && !this.unhealthy() && this.now().getTime() <= st.nextUpdate.getTime();
  }

  externalIssuerByAnchor(anchorFingerprint: string, vct: string, iat: number): ExternalIssuerAnswer | null {
    const ent = this.store.external_anchors.get(anchorFingerprint);
    if (!ent || ent.kind === "access_ca" || ent.kind === "wallet_provider") return null;
    const base = {
      list_id: ent.list_id,
      territory: ent.territory,
      recognized_by: ent.scope.recognized_by ?? (ent.territory === "EU" ? [] : [ent.territory]),
      status_hosts: ent.status_hosts ?? [],
    };
    if (!this.externalFresh(ent.list_id)) return { tri: "UNKNOWN", issuer: null, ...base };
    if (!(ent.scope.vct ?? []).includes(vct)) return { tri: "NO", issuer: null, ...base };
    return { tri: "YES", issuer: externalIssuerRecord(ent, iat), ...base };
  }

  externalAnchorCertsDer(): Uint8Array[] {
    return [...this.store.external_anchors.values()]
      .filter((e) => (e.kind === "pid_provider" || e.kind === "eaa_provider") && this.externalFresh(e.list_id))
      .map((e) => e.cert_der);
  }

  /**
   * Yüklü ve taze dış listeler (0.5.2; DCQL `trusted_authorities` türü `etsi_tl` — cüzdan `matchDcql` `trustedLists`): listenin
   * özgün yayın adresi (`list_url`) ve belge verme hizmeti sertifikaları (PID / EAA sağlayıcıları).
   */
  externalTrustedLists(): Array<{ uri: string; certsDer: Uint8Array[] }> {
    const out = new Map<string, Uint8Array[]>();
    for (const e of this.store.external_anchors.values()) {
      if ((e.kind !== "pid_provider" && e.kind !== "eaa_provider") || !this.externalFresh(e.list_id)) continue;
      const uri = this.store.external_lists.get(e.list_id)?.pointer.list_url;
      if (!uri) continue;
      if (!out.has(uri)) out.set(uri, []);
      out.get(uri)!.push(e.cert_der);
    }
    return [...out].map(([uri, certsDer]) => ({ uri, certsDer }));
  }

  /**
   * ADR-0049 K2/K3: göstergeye dokununca gösterilecek imzalı kayıt ve göstergenin görünüp görünmeyeceği. Bilgi yüklü (imzası
   * doğrulanmış) listeden okunur; ağ isteği yok. Gizlenir: liste bayat ya da yok, sandbox listesi, kayıt yok ya da `ACTIVE` değil,
   * çözüm kaydı yok ya da `ACTIVE` değil, birim iptal edilmiş.
   */
  walletProviderListing(providerId: string, opts: WalletProviderListingOptions = {}): WalletProviderListing {
    const lotl = this.store.lotl as unknown as
      | {
          version?: number;
          environment?: string;
          issued_at?: string;
          wallet_providers: Array<{
            provider_id: string;
            legal_name: string;
            status: string;
            wua_signing_keys: Array<{
              fingerprint_sha256: string;
              status?: string;
              valid_from?: string;
              valid_to?: string;
            }>;
            solutions?: Array<{ solution_id: string; status: string; security_level?: string; min_version?: string }>;
          }>;
        }
      | undefined;
    const base = { provider_id: providerId, status: null, legal_name: null, fingerprint: null };
    const listMeta = {
      list_issued_at: lotl?.issued_at ?? null,
      list_version: typeof lotl?.version === "number" ? lotl.version : null,
    };
    const hide = (
      hidden: WalletProviderListingHidden,
      extra: Partial<WalletProviderListing> = {},
    ): WalletProviderListing => ({
      listed: false,
      hidden,
      ...base,
      ...listMeta,
      ...extra,
    });
    if (!lotl || this.unhealthy()) return { ...hide("list_unavailable"), list_issued_at: null, list_version: null };
    const wp = lotl.wallet_providers.find((w) => w.provider_id === providerId);
    if (!wp) return hide("not_listed");
    const fp = [...activeFps(wp.wua_signing_keys, this.now())][0] ?? null;
    const rec = { status: wp.status, legal_name: wp.legal_name, fingerprint: fp };
    const sol = opts.solutionId ? wp.solutions?.find((x) => x.solution_id === opts.solutionId) : undefined;
    const solution = sol
      ? {
          solution: {
            solution_id: sol.solution_id,
            status: sol.status,
            ...(sol.security_level ? { security_level: sol.security_level } : {}),
            ...(sol.min_version ? { min_version: sol.min_version } : {}),
          },
        }
      : {};
    if ((lotl.environment ?? "production") !== "production") return hide("sandbox", { ...rec, ...solution });
    if (wp.status !== "ACTIVE") return hide("provider_not_active", { ...rec, ...solution });
    if (opts.solutionId && !sol) return hide("solution_not_listed", rec);
    if (sol && sol.status !== "ACTIVE") return hide("solution_not_active", { ...rec, ...solution });
    if (opts.unitRevoked) return hide("unit_revoked", { ...rec, ...solution });
    return { listed: true, provider_id: providerId, ...rec, ...solution, ...listMeta };
  }

  terminalGroup(groupId: string): TerminalGroupAnswer | null {
    if (this.unhealthy()) return null;
    for (const a of this.terminalGroupsAll()) if (a.group.group_id === groupId) return a;
    return null;
  }
  terminalGroupByCertFingerprint(fp: string): TerminalGroupAnswer | null {
    if (this.unhealthy()) return null;
    const f = fp.toLowerCase();
    for (const a of this.terminalGroupsAll()) if (a.active && (a.group.cert_fingerprints ?? []).includes(f)) return a;
    return null;
  }
  /** Bütün kapı grupları (doğrulayıcı kayıtları üzerinden; aynı grup kimliği iki kez yayımlanmaz — yayıncı denetler). */
  private terminalGroupsAll(): TerminalGroupAnswer[] {
    const now = this.now().getTime();
    const out: TerminalGroupAnswer[] = [];
    for (const rp of this.store.relying_parties_by_dns.values())
      for (const g of rp.terminal_groups ?? []) {
        const from = Date.parse(g.valid_from);
        const until = g.valid_until ? Date.parse(g.valid_until) : Number.POSITIVE_INFINITY;
        out.push({ group: g, rp_dns_name: rp.dns_name, active: rp.status === "ACTIVE" && from <= now && now < until });
      }
    return out;
  }

  walletProviderMinKeyStorage(fp: string): string | null {
    if (this.unhealthy()) return null;
    return this.store.external_wallet_keys.get(fp)?.scope.min_key_storage ?? null;
  }

  freshness() {
    const f = this.store.getFreshness();
    if (!f) return { source: "list" as const, version: 0, ageSec: Number.POSITIVE_INFINITY, healthy: false };
    return {
      source: f.source,
      version: f.lotlVersion,
      ageSec: Math.floor((this.now().getTime() - f.loadedAt.getTime()) / 1000),
      healthy: !this.unhealthy(),
    };
  }
}

/**
 * Dış kurum için politika kaydı: Tamga `Issuer` biçiminde ama işaretli (`external`). issuer_url yok (iss tutarlılığı Tamga
 * kaydına özgü), iptal listesi imzacısı = kurumun dış listedeki iptal hizmeti (yoksa çapanın kendisi).
 */
function externalIssuerRecord(ent: ExternalEntity, iat: number): Issuer {
  const since = new Date(Math.max(0, iat - 1) * 1000).toISOString();
  return {
    issuer_id: `0x${ent.cert_fingerprint}`,
    slug: `ext-${ent.list_id}`.slice(0, 32),
    legal_name: ent.name,
    category: ent.scope.category ?? (ent.kind === "pid_provider" ? "IDENTITY" : "OTHER"),
    assurance: ent.scope.assurance ?? "I1",
    class: ent.scope.class ?? "EAA",
    parent_ca_id: `external:${ent.cert_fingerprint}`,
    cert_fingerprint_sha256: ent.cert_fingerprint,
    issuer_url: "",
    status_list_base: "",
    status: "ACTIVE",
    valid_from: since,
    valid_until: "9999-12-31T00:00:00Z",
    successor_id: null,
    status_history: [{ status: "ACTIVE", since }],
    schema_authorizations: [],
    delegate_keys: ent.status_signer_fps.map((fp) => ({
      fingerprint_sha256: fp,
      purpose: "status_list",
      status: "ACTIVE" as const,
    })),
    external: { list_id: ent.list_id, territory: ent.territory },
  } as Issuer;
}
