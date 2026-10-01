/**
 * Liste formatı — tamga-beta/docs/04-TRUST-LIST-FORMAT.md (SPEC-TRUST-0001 taslağı).
 * Zod şemaları `passthrough` ile bilinmeyen alanları korur (ileri uyumluluk); bilinmeyen
 * `list_format_version` ise CMP2 gereği yükleyicide DURDURUR.
 */
import { z } from "zod";

export const LIST_FORMAT_VERSION = "1.0";
export const KNOWN_FORMAT_VERSIONS = new Set([LIST_FORMAT_VERSION]);

export const Status = z.enum([
  "ACTIVE",
  "SUSPENDED",
  "REVOKED",
  "RETIRED",
  "ROLLING_OVER",
  "RESERVED",
  "PROVISIONAL",
  "DEPRECATED",
]);
export type Status = z.infer<typeof Status>;

/**
 * Tarih alanı: okunabilir bir ISO 8601 tarihi olmalı. Okunamayan tarih `NaN` verir ve NaN ile her karşılaştırma `false`
 * olduğundan geçerlilik/tazelik denetimleri sessizce geçerdi (fail-open); bu yüzden liste yüklenirken reddedilir (CMP2 gibi DUR).
 */
export const IsoDate = z.string().refine((s) => Number.isFinite(Date.parse(s)), { message: "not a valid date" });

export const StatusHistoryEntry = z
  .object({
    status: Status,
    since: IsoDate, // ISO 8601
    reason: z.string().optional(),
    /** REVOKED için: bu andan itibaren verilmiş belgeler düşer (ele geçirilme). Yoksa REVOKED
     *  yumuşak iptaldir: `since` öncesi belgeler geçerli kalır (GV1 / D-BC-4). */
    invalidates_from: IsoDate.optional(),
  })
  .passthrough();
export type StatusHistoryEntry = z.infer<typeof StatusHistoryEntry>;

export const SigningKey = z
  .object({
    fingerprint_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    valid_from: IsoDate.optional(),
    valid_to: IsoDate.optional(),
    status: Status.default("ACTIVE"),
  })
  .passthrough();

export const Operator = z
  .object({
    name: z.string(),
    status: z.enum(["provisional", "designated"]),
    on_behalf_of: z.string().optional(),
    note: z.string().optional(),
  })
  .passthrough();

export const SchemaEntry = z
  .object({
    schema_id: z.string().regex(/^0x[0-9a-f]{64}$/),
    vct: z.string(),
    metadata_url: z.string().url(),
    content_hash: z.string().regex(/^sha256-[A-Za-z0-9+/]+=*$/), // SRI == vct#integrity (güncel sürüm)
    /** ADR-0010 K4: aynı vct'nin geçerli tüm yayımlanmış sürümleri (eski belgeler kendi sürümüyle doğrulanır) */
    content_hashes: z.array(z.string().regex(/^sha256-[A-Za-z0-9+/]+=*$/)).optional(),
    layer: z.enum(["NETWORK", "NATIONAL"]),
    governance: z.string().optional(),
    status: Status,
    registered_at: IsoDate,
    status_history: z.array(StatusHistoryEntry),
  })
  .passthrough();
export type SchemaEntry = z.infer<typeof SchemaEntry>;

export const WalletProvider = z
  .object({
    provider_id: z.string(),
    legal_name: z.string(),
    wua_signing_keys: z.array(SigningKey),
    status: Status,
  })
  .passthrough();

/**
 * ADR-0032 (ZK2) — kabul edilen sıfır bilgi ispatı devreleri. Doğrulayıcı yalnız burada yayımlanan devreyle üretilmiş ispatı
 * kabul eder; `circuit_id` Longfellow `combined_hash` (onaltılık), `sha256` sıkıştırılmış devre dosyasının özeti (doğrulayıcı
 * dosyayı bununla sabitler). `attributes` = devrenin açıkladığı öznitelik sayısı.
 */
export const ZkCircuit = z
  .object({
    circuit_id: z.string().regex(/^[0-9a-f]{64}$/),
    system: z.literal("longfellow-libzk-v1"),
    version: z.number().int().positive(),
    attributes: z.number().int().positive(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    status: Status,
    note: z.string().optional(),
  })
  .passthrough();
export type ZkCircuit = z.infer<typeof ZkCircuit>;

/**
 * ADR-0036 — federasyon: başka bir işletmecinin yayınladığı güven listesi (ör. bir devletin ya da AB'nin ETSI TS 119 602 LoTE
 * listesi). Tamga LOTL'u yalnız ADRESİNİ, İMZACISINI (sabitlenmiş parmak izi) ve KAPSAMINI gösterir; içeriğin sahibi listeyi
 * yayınlayandır. Kapsam dışındaki kayıtlar (başka rol, başka belge türü) yok sayılır — dış liste kapsamı aşan hiçbir şeye kefil
 * olamaz (FD2). Bir dış listenin LOTL'a girmesi proje yönetimi onayıyla (FD4).
 */
export const ExternalEntityKind = z.enum(["wallet_provider", "pid_provider", "eaa_provider", "access_ca"]);
export type ExternalEntityKind = z.infer<typeof ExternalEntityKind>;
export const ExternalListScope = z
  .object({
    /** Bu listenin kefil olabileceği roller */
    entity_kinds: z.array(ExternalEntityKind).min(1),
    /** pid/eaa: kefil olabileceği belge türleri (SD-JWT vct ya da mdoc docType); yoksa hiçbir tür */
    vct: z.array(z.string()).optional(),
    /** Tamga doğrulama politikasında görünecek sınıflandırma (dış kuruma atanır) */
    category: z
      .enum(["GOVERNMENT", "IDENTITY", "EDUCATION", "HEALTH", "FINANCE", "LOGISTICS", "OTHER", "EVENTS"])
      .optional(),
    assurance: z.enum(["I1", "I2", "I3"]).default("I1"),
    class: z.enum(["PUB", "QUALIFIED", "EAA"]).default("EAA"),
    /** Bu kurumları tanıyan devletler (C3); yoksa yalnız listenin ülkesi */
    recognized_by: z.array(z.string().regex(/^[A-Z]{2}$/)).optional(),
    /** wallet_provider: bu sağlayıcının cüzdanlarına belge verirken en az anahtar deposu (kiracı politikasından sıkıysa o) */
    min_key_storage: z.enum(["software", "tee", "secure_enclave", "strongbox", "wscd"]).optional(),
  })
  .passthrough();
export type ExternalListScope = z.infer<typeof ExternalListScope>;
export const ExternalListPointer = z
  .object({
    list_id: z.string().regex(/^[a-z0-9-]{3,64}$/),
    /** ISO 3166-1 alfa-2 ya da "EU" */
    territory: z.string().regex(/^([A-Z]{2}|EU)$/),
    /** Uygulanan: etsi-lote-json (ETSI TS 119 602 JSON, JAdES compact). etsi-tl-xml: okuyucu yok → yüklenmez (uyarı). */
    format: z.enum(["etsi-lote-json", "etsi-tl-xml"]),
    /** Özgün yayın adresi; yayıncı kopyası trust.tamga.network/external/<list_id>.jws */
    list_url: z.string().url(),
    signing_keys: z.array(SigningKey).min(1),
    operator: z.object({ name: z.string(), note: z.string().optional() }).passthrough(),
    status: Status,
    scope: ExternalListScope,
    /** FD4: onay kaydı (tarih + belge/karar kimliği) */
    approval: z.object({ approved_at: IsoDate, ref: z.string() }).passthrough(),
  })
  .passthrough();
export type ExternalListPointer = z.infer<typeof ExternalListPointer>;

export const NationalListPointer = z
  .object({
    state_code: z.string().regex(/^[A-Z]{2}$/),
    status: Status,
    membership: z.string().optional(),
    list_url: z.string().optional(),
    operator: Operator.optional(),
    signing_keys: z.array(SigningKey).optional(),
    recognition: z.object({ mode: z.string(), recognizes: z.array(z.string()) }).optional(),
    roles: z.record(z.string(), z.any()).optional(),
  })
  .passthrough();

export const Lotl = z
  .object({
    list_format_version: z.string(),
    list_type: z.literal("lotl"),
    version: z.number().int().nonnegative(),
    issued_at: IsoDate,
    next_update: IsoDate,
    previous_version_hash: z.string().nullable(),
    operator: Operator,
    catalogue: z.object({ url: z.string().url(), note: z.string().optional() }).optional(),
    anchor_signing_keys: z.array(SigningKey),
    national_lists: z.array(NationalListPointer),
    schemas: z.array(SchemaEntry),
    eaa_categories: z.record(z.string(), z.string()).optional(),
    wallet_providers: z.array(WalletProvider),
    pid_providers: z.array(z.any()),
    /** ADR-0032 ZK2: kabul edilen ZK devreleri (yoksa hiçbir ZK ispatı kabul edilmez). */
    zk_circuits: z.array(ZkCircuit).optional(),
    /** ADR-0036: dış işletmecilerin listeleri (federasyon) */
    external_lists: z.array(ExternalListPointer).optional(),
  })
  .passthrough();
export type Lotl = z.infer<typeof Lotl>;

export const RootCa = z
  .object({
    ca_id: z.string().regex(/^0x[0-9a-f]{64}$/),
    legal_name: z.string(),
    cert_fingerprint_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    cert_pem: z.string().optional(),
    service_type: z.string(),
    operator: Operator,
    status: Status,
    valid_from: IsoDate,
    valid_until: IsoDate,
    successor_ca_id: z.string().nullable(),
    status_history: z.array(StatusHistoryEntry),
  })
  .passthrough();
export type RootCa = z.infer<typeof RootCa>;

/**
 * ADR-0024 — katılımcı kayıt verisi (AB ortak veri seti: CIR 2025/848 Ek I; TS5/TS6). Alanlar liste biçiminde isteğe bağlıdır
 * (eski kayıtlar bozulmaz); yayıncı yeni kayıtlarda zorunlu alanları denetler. Yalnız kurumlar (RPR2).
 */
export const PostalAddress = z
  .object({
    street_address: z.string(),
    locality: z.string().optional(),
    postal_code: z.string().optional(),
    country: z.string().regex(/^[A-Z]{2}$/),
  })
  .passthrough();
export const RegIdentifier = z.object({ scheme: z.string(), value: z.string() }).passthrough();
export const Contact = z
  .object({
    support_uri: z.string().url().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
  })
  .passthrough();
export const SupervisoryAuthority = z
  .object({
    name: z.string(),
    country: z.string().regex(/^[A-Z]{2}$/),
    email: z.string().optional(),
    phone: z.string().optional(),
    form_uri: z.string().url().optional(),
    info_uri: z.string().url().optional(),
  })
  .passthrough();
/** TS6 madde 12 yetki türleri (ETSI TS 119 475 URI eşlemesi dışa aktarımda) */
export const Entitlement = z.enum([
  "service_provider",
  "qeaa_provider",
  "non_q_eaa_provider",
  "pub_eaa_provider",
  "pid_provider",
]);
const RegistrationData = {
  trade_name: z.string().optional(),
  identifiers: z.array(RegIdentifier).optional(),
  postal_address: PostalAddress.optional(),
  info_uri: z.string().url().optional(),
  contact: Contact.optional(),
  service_description: z.record(z.string(), z.string()).optional(), // BCP 47 → metin
  is_public_sector_body: z.boolean().optional(),
  entitlements: z.array(Entitlement).optional(),
  supervisory_authority: SupervisoryAuthority.optional(),
};

export const SchemaAuthorization = z
  .object({
    schema_id: z.string(),
    allowed: z.boolean(),
    valid_from: IsoDate,
    valid_until: IsoDate.nullable(),
  })
  .passthrough();

export const Issuer = z
  .object({
    issuer_id: z.string().regex(/^0x[0-9a-f]{64}$/),
    slug: z.string().regex(/^[a-z0-9-]{3,32}$/),
    legal_name: z.string(),
    // IssuerCategory kapalı kümedir (SPEC-BC-0001); yeni değer yalnızca ADR ile ve sona eklenir (ADR-0014 IC1) — EVENTS: D-CAT-1
    category: z.enum(["GOVERNMENT", "IDENTITY", "EDUCATION", "HEALTH", "FINANCE", "LOGISTICS", "OTHER", "EVENTS"]),
    assurance: z.enum(["I1", "I2", "I3"]),
    class: z.enum(["PUB", "QUALIFIED", "EAA"]),
    assurance_basis: z.string().optional(),
    parent_ca_id: z.string(),
    cert_fingerprint_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    issuer_url: z.string().url(),
    status_list_base: z.string().url(),
    status: Status,
    valid_from: IsoDate,
    valid_until: IsoDate,
    successor_id: z.string().nullable(),
    status_history: z.array(StatusHistoryEntry),
    schema_authorizations: z.array(SchemaAuthorization),
    delegate_keys: z.array(SigningKey.extend({ purpose: z.string() })).optional(),
    authentic_source: z.any().optional(),
    ...RegistrationData,
  })
  .passthrough();
export type Issuer = z.infer<typeof Issuer>;

export const RpScope = z
  .object({
    scope_id: z.string(),
    purpose: z.string(), // İngilizce (kanonik)
    /** Kullanıcıya gösterim için çeviriler (BCP 47 → metin), ör. { "tr-TR": "…" }; yoksa `purpose` gösterilir. */
    purpose_localized: z.record(z.string(), z.string()).optional(),
    vct: z.string(),
    claims: z.array(z.string()),
    valid_from: IsoDate,
    valid_until: IsoDate.nullable(),
    /** ADR-0024: bu kullanımın gizlilik politikası (cüzdan onay ekranında gösterilir — ARF RPA_10) */
    privacy_policy_uri: z.string().url().optional(),
  })
  .passthrough();

export const RelyingParty = z
  .object({
    rp_id: z.string(),
    /**
     * ADR-0034: OpenID4VP istemci kimliği — `x509_hash:` + base64url(SHA-256(erişim sertifikası DER)) (HAIP 1.0 §5). Yayıncı
     * sertifikadan hesaplar; sertifika yenilenince değişir.
     */
    client_id: z.string().regex(/^x509_hash:[A-Za-z0-9_-]{43}$/),
    /**
     * ADR-0034: kalıcı kayıt kimliği — erişim sertifikasının SAN'ındaki alan adı. Sertifika yenilenince değişmez; takma ad (ADR-0031),
     * kopya ayrımı (WL5), aracı ilişkileri ve kayıt araçları bunu kullanır.
     */
    dns_name: z.string().regex(/^[a-z0-9.-]+$/),
    legal_name: z.string(),
    access_cert_fingerprint_sha256: z.string().regex(/^[0-9a-f]{64}$/),
    status: Status,
    registered_at: IsoDate,
    scopes: z.array(RpScope),
    status_history: z.array(StatusHistoryEntry),
    ...RegistrationData,
    /** TS6 14–16: aracı ilişkisi (ADR-0017) — RP: kullandığı aracılar; aracı: hizmet verdiği RP'ler (`dns_name`, ADR-0034) */
    uses_intermediaries: z.array(z.string()).optional(),
    served_relying_parties: z.array(z.string()).optional(),
    /** ADR-0031 K4: site başına takma ad — `single` (varsayılan; kişi başına bir hesap) ya da `multiple` */
    pseudonyms: z.enum(["single", "multiple"]).optional(),
  })
  .passthrough();
export type RelyingParty = z.infer<typeof RelyingParty>;

export const NationalList = z
  .object({
    list_format_version: z.string(),
    list_type: z.literal("trusted_list"),
    state_code: z.string().regex(/^[A-Z]{2}$/),
    version: z.number().int().nonnegative(),
    issued_at: IsoDate,
    next_update: IsoDate,
    previous_version_hash: z.string().nullable(),
    operator: Operator,
    root_cas: z.array(RootCa),
    issuers: z.array(Issuer),
    relying_parties: z.array(RelyingParty),
    national_schemas: z.array(SchemaEntry),
  })
  .passthrough();
export type NationalList = z.infer<typeof NationalList>;

/** anchors.jsonl — her satır bir JWS; payload: */
export const AnchorBase = z.object({
  seq: z.number().int().nonnegative(),
  previous_hash: z.string().nullable(), // sha256:<hex> of previous raw JWS line
  ts: IsoDate,
});
export const AnchorStatusList = AnchorBase.extend({
  kind: z.literal("status_list"),
  list_id: z.string(),
  issuer_id: z.string(),
  list_uri: z.string().url(),
  content_hash: z.string(), // sha256:<hex> of the Status List Token bytes
  list_version: z.number().int().nonnegative(),
  published_at: z.string().datetime({ offset: true }), // RFC 3339 (iç inceleme K3: bozuk tarih D5'i atlatmasın)
  request_sig: z.string().optional(),
});
export const AnchorSchema = AnchorBase.extend({
  kind: z.literal("schema"),
  schema_id: z.string(),
  vct: z.string(),
  content_hash: z.string(), // SRI
});
export const AnchorHeartbeat = AnchorBase.extend({ kind: z.literal("heartbeat") });
/**
 * Kontrol noktası (TL12): günlük büyüdüğünde önceki satırlar `archive/anchors-<from>-<to>.jsonl` dosyasına taşınır (silinmez);
 * yeni günlüğün ilk satırı bu kayıttır. `previous_hash` = arşivdeki son satırın hash'i; zincir kesintisiz sürer.
 * Yükleyici ilk satır kontrol noktasıysa imzasına güvenir ve `seq`/`previous_hash`'ten devam eder; tam geçmiş
 * (replay, TL10) arşivleri kontrol noktalarının `archive.sha256` değeriyle doğrulayarak baştan yüklenir.
 */
export const AnchorCheckpoint = AnchorBase.extend({
  kind: z.literal("checkpoint"),
  archive: z.object({
    file: z.string(), // dist'e göre yol, ör. archive/anchors-0000000-0007125.jsonl
    sha256: z.string(), // sha256:<hex> — arşiv dosyasının bayt hash'i
    seq_from: z.number().int().nonnegative(),
    seq_to: z.number().int().nonnegative(),
    lines: z.number().int().positive(),
  }),
  /**
   * TL12 anlık durum: arşive giden satırların ürettiği SON durum — liste başına en son status çapası + şema çapaları.
   * Yükleyici arşivi okumadan durumu buradan kurar (yoksa arşiv öncesi çapalanmış listeler unutulur → D2 INDETERMINATE).
   * İmzalı satırın parçası olduğu için doğrulanmıştır. Zincir ortasındaki eski (durumsuz) kontrol noktası için opsiyonel.
   */
  state: z
    .object({
      status_lists: z.array(
        z.object({
          list_id: z.string(),
          issuer_id: z.string(),
          list_uri: z.string().url(),
          content_hash: z.string(),
          list_version: z.number().int().nonnegative(),
          published_at: z.string().datetime({ offset: true }),
          seq: z.number().int().nonnegative(),
        }),
      ),
      schemas: z.array(
        z.object({ schema_id: z.string(), content_hash: z.string(), seq: z.number().int().nonnegative() }),
      ),
    })
    .optional(),
});
export const Anchor = z.discriminatedUnion("kind", [AnchorStatusList, AnchorSchema, AnchorHeartbeat, AnchorCheckpoint]);
export type Anchor = z.infer<typeof Anchor>;
