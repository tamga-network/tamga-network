/**
 * TrustStore — ARCH-0003 §2.4 SQL şemasının bellek-içi yansıması (tablolar aynı adla).
 * Kişisel veri yoktur (CMP3). Zincire geçişte aynı tablolar olaylardan doldurulur.
 */
import type {
  Anchor,
  ExternalEntityKind,
  ExternalListPointer,
  ExternalListScope,
  Issuer,
  Lotl,
  NationalList,
  RelyingParty,
  RootCa,
  SchemaEntry,
  ZkCircuit,
} from "./types.js";
import { derToPemPortable, sha256HexPortable as sha256Hex, type ParsedLote } from "./lote-reader.js";

/**
 * Şu an geçerli imza anahtarlarının parmak izleri: `status` ACTIVE (yoksa ACTIVE sayılır) ve `now`, `valid_from..valid_to`
 * penceresinde. Liste imzacıları, çapa imzacıları ve cüzdan sağlayıcı anahtarları aynı kuralla seçilir.
 */
export function activeFps(
  keys: Array<{ fingerprint_sha256: string; status?: string; valid_from?: string; valid_to?: string }> | undefined,
  now: Date,
): Set<string> {
  const out = new Set<string>();
  for (const k of keys ?? []) {
    if (k.status && k.status !== "ACTIVE") continue;
    if (k.valid_from && new Date(k.valid_from) > now) continue;
    if (k.valid_to && new Date(k.valid_to) < now) continue;
    out.add(k.fingerprint_sha256);
  }
  return out;
}

/** ADR-0036: dış listeden gelen kurum hizmeti (yalnız kapsamdaki roller). Kişisel veri yok. */
export interface ExternalEntity {
  list_id: string;
  territory: string;
  kind: ExternalEntityKind;
  name: string;
  scope: ExternalListScope;
  /** Belge/sertifika imzalama hizmetinin sertifikası (güven çapası: CA ya da doğrudan imzacı) */
  cert_fingerprint: string;
  cert_pem: string;
  cert_der: Uint8Array;
  /** Aynı kurumun iptal (durum listesi) hizmeti sertifikaları; yoksa çapanın kendisi */
  status_signer_fps: string[];
  /**
   * Dış listenin bu kurum için bildirdiği iptal sunucuları (0.5.2): kurumun iptal ve belge verme hizmetlerinin `https` erişim
   * noktalarının (ServiceSupplyPoints) alan adları, küçük harf. Boşsa doğrulayıcı belge imzacısı sertifikasına bakar.
   */
  status_hosts: string[];
}
export interface ExternalListState {
  pointer: ExternalListPointer;
  sequence: number;
  issuedAt: Date;
  nextUpdate: Date;
  entities: number;
}

export interface StatusAnchorRow {
  list_id: string;
  issuer_id: string;
  list_uri: string;
  content_hash: string;
  version: number;
  published_at: string;
  seq: number;
  /** listenin bit sayısı ve indeks kapasitesi (satır taşıyorsa; belirteçten okunur — zincir kaydı için) */
  bits?: number;
  size?: number;
}
/** ADR-0074 K4: kayıt sertifikası durum listesinin son çapası. */
export interface RegistrationStatusAnchorRow {
  list_uri: string;
  content_hash: string;
  list_version: number;
  published_at: string;
  seq: number;
}
/** ADR-0074 K4: liste görünümünün (ETSI XML / LoTE) son çapası. */
export interface ListViewAnchorRow {
  file: string;
  format: "etsi-tl-xml" | "etsi-lote-json";
  source_file: string;
  source_version: number;
  content_hash: string;
  seq: number;
}
export interface Freshness {
  source: "list" | "chain";
  healthy: boolean;
  lotlVersion: number;
  anchorsSeq: number;
  loadedAt: Date;
  /** Bu andan sonra kaynak bayattır: en erken `next_update` ve (yüklendiyse) son çapa satırı + azami yaş. Yüklemeden sonra
   *  geçen zaman da tazeliği bozar — uzun çalışan doğrulayıcı listeyi yenilemezse cevaplar UNKNOWN olur (BT5/CMP4). */
  staleAfter?: Date;
}

const liveRp = (r: RelyingParty) => r.status !== "REVOKED" && r.status !== "RETIRED";
const lastChange = (r: RelyingParty) =>
  Math.max(Date.parse(r.registered_at ?? "") || 0, ...(r.status_history ?? []).map((h) => Date.parse(h.since) || 0));
/** Kaydın en son `REVOKED` girdisinin yapılı devir kaydı (`reassigned_to`; ADR-0075 RO1/RO5); yoksa undefined. */
function lastReassignment(r: RelyingParty): string | undefined {
  const revoked = (r.status_history ?? [])
    .map((h, i) => ({ h, i, t: Date.parse(h.since) || 0 }))
    .filter((x) => x.h.status === "REVOKED")
    .sort((a, b) => a.t - b.t || a.i - b.i);
  const last = revoked[revoked.length - 1]?.h;
  return typeof last?.reassigned_to === "string" ? last.reassigned_to : undefined;
}
/**
 * ADR-0075: bir `dns_name`'in ülke listesi kayıtlarından geçerli olanı seçer (yükleme sırasından bağımsız; ülke koduna göre sıralı).
 * - İptal edilmemiş (`REVOKED` / `RETIRED` değil; `SUSPENDED` dahil) kayıt yoksa: durumu en son değişen kayıt, belirsiz değil.
 * - İptal edilmemiş TEK kayıt varsa: ancak öteki bütün kayıtların son `REVOKED` girdisi `reassigned_to` ile bu kaydın ülkesini
 *   gösteriyorsa (makinece okunur devir onayı) o kayıt alınır; aksi hâlde ad belirsizdir (kapalı güvenli). Başka ülkede iptal
 *   sonrası yeniden kayıt (RO2) ağ düzeyinde kayıt gelene kadar bu yüzden belirsiz kalır.
 * - İptal edilmemiş kayıt birden çoksa: belirsiz.
 * Belirsizlikte de bir kayıt döner (denetim ve eşdeğerlik için); karar `relyingPartyAmbiguous` ile verilir.
 */
function resolveRelyingParty(records: Map<string, RelyingParty>): { rp: RelyingParty; ambiguous: boolean } {
  const entries = [...records.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const live = entries.filter(([, r]) => liveRp(r));
  if (!live.length) {
    const rp = entries.map(([, r]) => r).reduce((a, b) => (lastChange(b) > lastChange(a) ? b : a));
    return { rp, ambiguous: false };
  }
  if (live.length > 1) return { rp: live[0][1], ambiguous: true };
  const [cc, rp] = live[0];
  const handedOver = entries.every(([c, r]) => c === cc || lastReassignment(r) === cc);
  return { rp, ambiguous: !handedOver };
}

export class TrustStore {
  lotl!: Lotl;
  lotlRaw = "";
  national = new Map<string, { list: NationalList; raw: string }>();
  root_cas = new Map<string, RootCa>();
  issuers = new Map<string, Issuer>();
  issuer_schema_auth = new Map<string, Issuer["schema_authorizations"]>(); // issuer_id → auths
  schemas = new Map<string, SchemaEntry>(); // schema_id → entry (NETWORK + NATIONAL)
  status_anchors = new Map<string, StatusAnchorRow>(); // list_id → latest
  schema_anchors = new Map<string, { content_hash: string; seq: number }>(); // schema_id → latest
  /** ADR-0074 K4: list_uri → son kayıt sertifikası durum listesi satırı (doğrulama kararına girmez; denetim ve zincir için) */
  registration_status_anchors = new Map<string, RegistrationStatusAnchorRow>();
  /** ADR-0074 K4: dosya → son liste görünümü satırı (görünüm kaynakla çelişirse kaynak geçerlidir, PJ5) */
  list_view_anchors = new Map<string, ListViewAnchorRow>();
  /** (dosya, kaynak) → son görünüm sürümü — `list_view` monotonluk anahtarı */
  private list_view_versions = new Map<string, number>();
  relying_parties = new Map<string, RelyingParty>(); // client_id → rp
  /**
   * dns_name → rp (ADR-0034: kalıcı kimlik). Aynı ad birden çok ülke listesinde görünürse (ADR-0075 devri: eski listede `REVOKED`
   * ve son girdide `reassigned_to: <yeni ülke>`, yenide `ACTIVE`) iptal edilmemiş TEK kayıt seçilir; devir kaydı yoksa ya da iptal
   * edilmemiş kayıt birden çoksa ad belirsizdir (`relyingPartyAmbiguous`). Hepsi iptal edilmişse durumu en son değişen kayıt.
   */
  relying_parties_by_dns = new Map<string, RelyingParty>();
  /** dns_name → kaydın göründüğü ülke listeleri (hepsi; iptal edilmiş eski kayıt dahil) */
  relying_party_states = new Map<string, Set<string>>();
  /** dns_name → ülke kodu → o ülke listesindeki kayıt (ADR-0075 devri) */
  relying_party_records = new Map<string, Map<string, RelyingParty>>();
  /**
   * AYNI ülke listesinde birden çok kayıtta görünen `dns_name`'ler (0.8.3; ADR-0075 RO5). Yayıncı böyle bir listeyi imzalamaz;
   * yine de yüklenirse hangi kaydın geçerli olduğu bilinemez — ad belirsizdir (ülkeler arası kuralla aynı cevap: null, kapalı
   * güvenli). Önceki davranış ikinci kaydın birincisini sessizce ezmesiydi.
   */
  relying_party_duplicates = new Set<string>();
  /** issuer_id → kaydın ülke listesi (kapı grubu kurumunun `slug`'ı ülkeyle nitelenir; 2026-11-04) */
  issuer_states = new Map<string, string>();
  wallet_provider_keys = new Set<string>();
  zk_circuits = new Map<string, ZkCircuit>(); // circuit_id → devre (ADR-0032 ZK2; yalnız ACTIVE)
  /** ADR-0036 federasyon: yüklenen dış listeler (list_id → durum) ve kapsamdaki kurum hizmetleri */
  external_lists = new Map<string, ExternalListState>();
  external_anchors = new Map<string, ExternalEntity>(); // sertifika parmak izi → pid/eaa/access_ca hizmeti
  external_wallet_keys = new Map<string, ExternalEntity>(); // sertifika parmak izi → dış cüzdan sağlayıcısı
  recognition = new Map<string, Set<string>>(); // state → recognized states
  private freshness: Freshness | null = null;

  /**
   * ADR-0075: aynı `dns_name` birden çok ülke listesinde görünüyorsa kimlik ancak makinece okunur bir devirle belirlidir: iptal
   * edilmemiş (`REVOKED` / `RETIRED` değil) TEK kayıt var ve öteki kayıtların son `REVOKED` girdisi `reassigned_to` ile onun ülkesini
   * gösteriyor. Aksi hâlde (iki iptal edilmemiş kayıt, devir kaydı olmayan ya da başka ülkeyi gösteren iptal) belirsizdir — kapalı
   * güvenli. Hepsi iptal edilmişse belirsiz değildir.
   */
  relyingPartyAmbiguous(dnsName: string): boolean {
    if (this.relying_party_duplicates.has(dnsName)) return true;
    const records = this.relying_party_records.get(dnsName);
    // kayıtlar ülke ülke tutulmamışsa (elle kurulan depo) yalnız görüldüğü liste sayısına bakılır
    if (!records) return (this.relying_party_states.get(dnsName)?.size ?? 0) > 1;
    return resolveRelyingParty(records).ambiguous;
  }
  /** Seçilen kaydın ülke listesi (`relying_parties_by_dns`); ad belirsizse ya da bilinmiyorsa undefined. */
  relyingPartyStateOf(dnsName: string): string | undefined {
    const rp = this.relying_parties_by_dns.get(dnsName);
    if (!rp || this.relyingPartyAmbiguous(dnsName)) return undefined;
    const records = this.relying_party_records.get(dnsName);
    if (!records) {
      const states = this.relying_party_states.get(dnsName);
      return states?.size === 1 ? [...states][0] : undefined;
    }
    for (const [cc, r] of records) if (r === rp) return cc;
    return undefined;
  }

  /** `now`: cüzdan sağlayıcı anahtarlarının geçerlilik penceresi (valid_from/valid_to) bu ana göre (yükleme anı). */
  applyLotl(lotl: Lotl, raw: string, now: Date = new Date()) {
    this.lotl = lotl;
    this.lotlRaw = raw;
    for (const s of lotl.schemas) this.schemas.set(s.schema_id, s);
    for (const wp of lotl.wallet_providers)
      if (wp.status === "ACTIVE")
        for (const fp of activeFps(wp.wua_signing_keys, now)) this.wallet_provider_keys.add(fp);
    this.zk_circuits.clear();
    for (const c of lotl.zk_circuits ?? []) if (c.status === "ACTIVE") this.zk_circuits.set(c.circuit_id, c);
    for (const n of lotl.national_lists)
      if (n.recognition) this.recognition.set(n.state_code, new Set(n.recognition.recognizes));
  }
  applyNationalList(tl: NationalList, raw: string) {
    this.national.set(tl.state_code, { list: tl, raw });
    for (const ca of tl.root_cas) this.root_cas.set(ca.ca_id, ca);
    for (const i of tl.issuers) {
      this.issuers.set(i.issuer_id, i);
      this.issuer_states.set(i.issuer_id, tl.state_code);
      this.issuer_schema_auth.set(i.issuer_id, i.schema_authorizations);
    }
    const seenDns = new Set<string>();
    for (const rp of tl.relying_parties) {
      // ADR-0075 RO5: aynı listede aynı ad ikinci kez → belirsiz (sessizce ezme yok)
      if (seenDns.has(rp.dns_name)) this.relying_party_duplicates.add(rp.dns_name);
      seenDns.add(rp.dns_name);
      this.relying_parties.set(rp.client_id, rp);
      const records = this.relying_party_records.get(rp.dns_name) ?? new Map<string, RelyingParty>();
      records.set(tl.state_code, rp);
      this.relying_party_records.set(rp.dns_name, records);
      this.relying_parties_by_dns.set(rp.dns_name, resolveRelyingParty(records).rp);
      const states = this.relying_party_states.get(rp.dns_name) ?? new Set<string>();
      states.add(tl.state_code);
      this.relying_party_states.set(rp.dns_name, states);
    }
    for (const s of tl.national_schemas) this.schemas.set(s.schema_id, s);
    if (!this.recognition.has(tl.state_code)) this.recognition.set(tl.state_code, new Set([tl.state_code]));
    else this.recognition.get(tl.state_code)!.add(tl.state_code);
  }
  /**
   * ADR-0036: imzası doğrulanmış dış LoTE listesini kapsamına göre uygular (FD2). Kapsam dışı roller ve türü olmayan
   * pid/eaa kayıtları alınmaz; dönen uyarılar yükleme raporuna eklenir.
   */
  applyExternalList(ptr: ExternalListPointer, lote: ParsedLote): string[] {
    const warnings: string[] = [];
    let n = 0;
    for (const e of lote.entities) {
      // FD2 (0.8.3): iptal hizmeti yalnız AYNI roldeki (kind) belge verme hizmetine bağlanır — kapsam dışı bir rolün iptal
      // sertifikası kapsamdaki kaydın iptal listesi imzacısı olamaz. Aşağıda yalnız kapsamdaki roller işlendiğinden bağlanan
      // iptal hizmeti de kapsamdadır. Erişim noktaları (iptal sunucuları) da aynı kuralla süzülür.
      const revocationFpsOf = (kind: ExternalEntityKind) =>
        e.services
          .filter((s) => s.role === "revocation" && s.kind === kind)
          .flatMap((s) => s.certsDer.map((d) => sha256Hex(d)));
      const statusHostsOf = (kind: ExternalEntityKind) =>
        supplyPointHosts(
          e.services.filter((s) => (s.role === "revocation" || s.role === "issuance") && s.kind === kind),
        );
      for (const svc of e.services) {
        if (svc.role !== "issuance" || !svc.kind) continue;
        if (!ptr.scope.entity_kinds.includes(svc.kind)) {
          warnings.push(`${ptr.list_id}: ${svc.kind} outside scope — ignored (FD2)`);
          continue;
        }
        if ((svc.kind === "pid_provider" || svc.kind === "eaa_provider") && !ptr.scope.vct?.length) {
          warnings.push(`${ptr.list_id}: ${svc.kind} without credential types in scope — ignored`);
          continue;
        }
        const revocationFps = revocationFpsOf(svc.kind);
        const statusHosts = statusHostsOf(svc.kind);
        for (const der of svc.certsDer) {
          const fp = sha256Hex(der);
          const ent: ExternalEntity = {
            list_id: ptr.list_id,
            territory: ptr.territory,
            kind: svc.kind,
            name: e.name,
            scope: ptr.scope,
            cert_fingerprint: fp,
            cert_pem: derToPemPortable(der),
            cert_der: der,
            status_signer_fps: revocationFps.length ? revocationFps : [fp],
            status_hosts: statusHosts,
          };
          if (svc.kind === "wallet_provider") {
            this.external_wallet_keys.set(fp, ent);
            this.wallet_provider_keys.add(fp);
          } else this.external_anchors.set(fp, ent);
          n++;
        }
      }
    }
    this.external_lists.set(ptr.list_id, {
      pointer: ptr,
      sequence: lote.sequence,
      issuedAt: lote.issuedAt,
      nextUpdate: lote.nextUpdate,
      entities: n,
    });
    return warnings;
  }
  applyAnchor(a: Anchor) {
    if (a.kind === "status_list") {
      const prev = this.status_anchors.get(a.list_id);
      if (prev && a.list_version <= prev.version)
        throw new Error(`L1/S3: list_version not monotonic (${a.list_id}: ${prev.version} → ${a.list_version})`);
      this.status_anchors.set(a.list_id, {
        list_id: a.list_id,
        issuer_id: a.issuer_id,
        list_uri: a.list_uri,
        content_hash: a.content_hash,
        version: a.list_version,
        published_at: a.published_at,
        seq: a.seq,
        ...(a.bits !== undefined && a.size !== undefined ? { bits: a.bits, size: a.size } : {}),
      });
    } else if (a.kind === "schema") {
      this.schema_anchors.set(a.schema_id, { content_hash: a.content_hash, seq: a.seq });
    } else if (a.kind === "registration_status") {
      // ADR-0074 K4: liste başına monoton sayaç (zincirdeki çapa sürümü de yalnız artar, CH4)
      const prev = this.registration_status_anchors.get(a.list_uri);
      if (prev && a.list_version <= prev.list_version)
        throw new Error(
          `ADR-0074: registration_status list_version not monotonic (${a.list_uri}: ${prev.list_version} → ${a.list_version})`,
        );
      const { seq, list_uri, content_hash, list_version, published_at } = a;
      this.registration_status_anchors.set(list_uri, { list_uri, content_hash, list_version, published_at, seq });
    } else if (a.kind === "list_view") {
      // Görünümün sürümü kaynak listenin sürümüdür (ADR-0066 K1); monotonluk anahtarı (dosya, kaynak): aynı dosya aynı kaynak
      // için yalnız artar. Dosya başka bir kaynağa bağlanırsa sayaç o kaynağın kendi sürümünden sürer (kaynaklar ayrı sayaçtır).
      const key = listViewKey(a.file, a.source_file);
      const prev = this.list_view_versions.get(key);
      if (prev !== undefined && a.source_version <= prev)
        throw new Error(
          `ADR-0074: list_view source_version not monotonic (${a.file} ← ${a.source_file}: ${prev} → ${a.source_version})`,
        );
      const { seq, file, format, source_file, source_version, content_hash } = a;
      this.list_view_versions.set(key, source_version);
      this.list_view_anchors.set(file, { file, format, source_file, source_version, content_hash, seq });
    }
  }
  /** TL12: baştaki kontrol noktasının anlık durumunu uygular (arşiv okunmadan). */
  restoreSnapshot(state: {
    status_lists: Array<{
      list_id: string;
      issuer_id: string;
      list_uri: string;
      content_hash: string;
      list_version: number;
      published_at: string;
      seq: number;
      bits?: number;
      size?: number;
    }>;
    schemas: Array<{ schema_id: string; content_hash: string; seq: number }>;
    registration_status?: RegistrationStatusAnchorRow[];
    list_views?: ListViewAnchorRow[];
  }) {
    for (const r of state.status_lists)
      this.status_anchors.set(r.list_id, {
        list_id: r.list_id,
        issuer_id: r.issuer_id,
        list_uri: r.list_uri,
        content_hash: r.content_hash,
        version: r.list_version,
        published_at: r.published_at,
        seq: r.seq,
        ...(r.bits !== undefined && r.size !== undefined ? { bits: r.bits, size: r.size } : {}),
      });
    for (const r of state.schemas) this.schema_anchors.set(r.schema_id, { content_hash: r.content_hash, seq: r.seq });
    for (const r of state.registration_status ?? []) this.registration_status_anchors.set(r.list_uri, { ...r });
    for (const r of state.list_views ?? []) {
      this.list_view_anchors.set(r.file, { ...r });
      this.list_view_versions.set(listViewKey(r.file, r.source_file), r.source_version);
    }
  }
  setFreshness(f: Freshness) {
    this.freshness = f;
  }
  getFreshness(): Freshness | null {
    return this.freshness;
  }

  summary() {
    return {
      lotl_version: this.lotl?.version,
      national: [...this.national.keys()].map((cc) => `${cc}@v${this.national.get(cc)!.list.version}`),
      root_cas: this.root_cas.size,
      issuers: this.issuers.size,
      schemas: this.schemas.size,
      relying_parties: this.relying_parties.size,
      status_anchors: this.status_anchors.size,
      schema_anchors: this.schema_anchors.size,
      registration_status_anchors: this.registration_status_anchors.size,
      list_view_anchors: this.list_view_anchors.size,
      wallet_provider_keys: this.wallet_provider_keys.size,
      external_lists: [...this.external_lists.values()].map((x) => `${x.pointer.list_id}#${x.sequence}`),
      freshness: this.freshness,
    };
  }
}

const listViewKey = (file: string, sourceFile: string) => `${file}|${sourceFile}`;

/** Hizmet erişim noktalarından `https` alan adları (küçük harf, tekil); bozuk ya da `https` olmayan adres atlanır. */
function supplyPointHosts(services: Array<{ supplyPoints?: string[] }>): string[] {
  const out = new Set<string>();
  for (const s of services)
    for (const u of s.supplyPoints ?? []) {
      try {
        const url = new URL(u);
        if (url.protocol === "https:" && url.hostname) out.add(url.hostname.toLowerCase().replace(/^\[|\]$/g, ""));
      } catch {
        /* bozuk adres: atlanır */
      }
    }
  return [...out];
}
