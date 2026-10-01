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
  relying_parties = new Map<string, RelyingParty>(); // client_id → rp
  relying_parties_by_dns = new Map<string, RelyingParty>(); // dns_name → rp (ADR-0034: kalıcı kimlik)
  wallet_provider_keys = new Set<string>();
  zk_circuits = new Map<string, ZkCircuit>(); // circuit_id → devre (ADR-0032 ZK2; yalnız ACTIVE)
  /** ADR-0036 federasyon: yüklenen dış listeler (list_id → durum) ve kapsamdaki kurum hizmetleri */
  external_lists = new Map<string, ExternalListState>();
  external_anchors = new Map<string, ExternalEntity>(); // sertifika parmak izi → pid/eaa/access_ca hizmeti
  external_wallet_keys = new Map<string, ExternalEntity>(); // sertifika parmak izi → dış cüzdan sağlayıcısı
  recognition = new Map<string, Set<string>>(); // state → recognized states
  private freshness: Freshness | null = null;

  applyLotl(lotl: Lotl, raw: string) {
    this.lotl = lotl;
    this.lotlRaw = raw;
    for (const s of lotl.schemas) this.schemas.set(s.schema_id, s);
    for (const wp of lotl.wallet_providers)
      if (wp.status === "ACTIVE")
        for (const k of wp.wua_signing_keys)
          if (k.status === "ACTIVE") this.wallet_provider_keys.add(k.fingerprint_sha256);
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
      this.issuer_schema_auth.set(i.issuer_id, i.schema_authorizations);
    }
    for (const rp of tl.relying_parties) {
      this.relying_parties.set(rp.client_id, rp);
      this.relying_parties_by_dns.set(rp.dns_name, rp);
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
      const revocationFps = e.services
        .filter((s) => s.role === "revocation")
        .flatMap((s) => s.certsDer.map((d) => sha256Hex(d)));
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
      });
    } else if (a.kind === "schema") {
      this.schema_anchors.set(a.schema_id, { content_hash: a.content_hash, seq: a.seq });
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
    }>;
    schemas: Array<{ schema_id: string; content_hash: string; seq: number }>;
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
      });
    for (const r of state.schemas) this.schema_anchors.set(r.schema_id, { content_hash: r.content_hash, seq: r.seq });
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
      wallet_provider_keys: this.wallet_provider_keys.size,
      external_lists: [...this.external_lists.values()].map((x) => `${x.pointer.list_id}#${x.sequence}`),
      freshness: this.freshness,
    };
  }
}
