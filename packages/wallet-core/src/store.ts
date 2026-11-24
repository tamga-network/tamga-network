/**
 * Cüzdan deposu — SPEC-WALLET-0001 §3 (yerel depo), §4 (batch kopyaları, WL5 yapışkan kopya), §7 (manifest; anahtar yok — WL2).
 * Depo soyut: uygulama JSON'u nereye yazacağını seçer (expo-file-system); anahtarlar KeyProvider'da (ayrı).
 */
import { certFingerprintHex, computeSchemaId, verifyIssuedSdJwt, type LocalVerifyOk } from "./sdjwt.js";
import { assertReceiveTrust } from "./receive-trust.js";
import type { KeyStorage, PublicJwk } from "./keys.js";
import type { RedeemOutput } from "./oid4vci.js";
import type { WuaRecord } from "./wua.js";
import { verifyReceivedMdoc } from "./mdoc.js";
import { stableJson } from "./stable-json.js";
import { anchoredChainCerts, type TrustSource } from "@tamga-network/trust/core";
import { b64Decode } from "./b64.js";
import { disclosurePolicyFromMetadata, type StoredDisclosurePolicy } from "./disclosure-policy.js";
import { reuseMethodOf, type ReuseMethod } from "./reuse-policy.js";

export interface StoredCopy {
  keyRef: string;
  cnf: PublicJwk;
  combined: string;
  idx?: number;
  usedBy: string[];
  /** D-CRED-5: aynı anahtara bağlı mdoc (base64url IssuerSigned). */
  mdoc?: string;
} // usedBy: doğrulayıcının kalıcı kimliği — kayıtlı RP'de `dns_name` (ADR-0034 CI4, `stableRpKey`); kayıtsızda client_id (WL5)
/** ADR-0044: ZK kopyası — kimlik belgesinin kısa ömürlü mdoc kopyası; yalnız ZK sunumunda (ZC1). Kendi cihaz anahtarına bağlı. */
export interface ZkCopy {
  keyRef: string;
  cnf: PublicJwk;
  /** base64url IssuerSigned (docType = `ZkCopyBinding.docType`, durum listesi yok) */
  mdoc: string;
  validFrom: number;
  validUntil: number;
}
/**
 * ADR-0044 K2/K3: ZK kopyası yenileme bağı — kimlik servisinin yenileme belirteci (opak; kişi alanları yalnız servisin açabileceği
 * biçimde içinde), ona bağlı DPoP anahtarı ve elde kalan kopyalar. Belirteç tek kullanımlıktır, her yenilemede değişir.
 */
export interface ZkCopyBinding {
  /** ZK kopyasının türü (docType) ve OpenID4VCI yapılandırma kimliği */
  docType: string;
  configurationId: string;
  token: string;
  tokenEndpoint: string;
  dpopRef: string;
  dpopJwk: PublicJwk;
  /** ADR-0060: yenileme belirtecinin bağlı olduğu istemci örneği anahtarı (ilk ihraçtaki WIA anahtarı) */
  instanceKeyRef?: string;
  copies: ZkCopy[];
  /** sessiz yenileme zamanı (rastgele gecikmeyle; ADR-0023 K1 koşulları) */
  dueAt?: number;
}
export interface StoredCredential {
  id: string;
  vct: string;
  typeName: string;
  issuer: string;
  issuerId: string;
  leafFingerprint: string;
  iat: number;
  exp?: number;
  /** geçerlilik başlangıcı (`nbf`); ileride ise belge "henüz geçerli değil" — `credentialValidity` (ARF "Issued") */
  nbf?: number;
  statusUri?: string;
  category?: string;
  claims: Record<string, unknown>; // görüntüleme için (cihazda; yedeğe şifreli girer)
  disclosureNames: string[]; // hangi alanlar seçici (gizlenebilir)
  copies: StoredCopy[];
  receivedAt: number;
  revokedLocally?: boolean;
  /** ADR-0023: sessiz yenileme bağı (yalnız kurum belgeleri); `dueAt` eşik aşılınca rastgele gecikmeyle belirlenir. */
  refresh?: import("./oid4vci.js").RefreshBinding & { dueAt?: number };
  /** ARF VCR_19: ihraççının iptal listesindeki son bilinen durum (cüzdan düzenli yeniler). */
  status?: { value: "valid" | "suspended" | "revoked" | "unknown"; checkedAt: number };
  /** ADR-0038: belgenin alındığı ağ (yoksa "production"); cüzdan yalnız seçili ağın belgelerini gösterir ve kullanır (SB2). */
  network?: "production" | "sandbox";
  /** ADR-0044: kimlik belgesinin ZK kopyaları ve yenileme bağı (yalnız kimlik servisi ZK kopyası ilan ediyorsa) */
  zk?: ZkCopyBinding;
  /**
   * ADR-0089 K4: kimlik belgesi yenileme zamanı (rastgele gecikmeyle; `scheduleIdentityRenewals`). Yenileme belirteci ZK bağında
   * (`zk.token`) ya da yoksa `refresh` bağındadır — tek yerde.
   */
  renewDueAt?: number;
  /**
   * ADR-0089 eki (ARF ISSU_37): belge verenin kopya politikasından seçilen yöntem (`reuseMethodOf`); yoksa doğrulayıcı başına kopya.
   * `selectCopy` / `planCopy` / `remainingCopies` buna göre davranır.
   */
  reuse?: ReuseMethod;
  /**
   * ADR-0046 K2 (EDP_10): kurumun gömülü açıklama politikası — belge alınırken imzalı metadata'dan; sunumda ağsız değerlendirilir
   * (`checkDisclosurePolicy`). Yoksa belge kısıt taşımaz.
   */
  disclosurePolicy?: StoredDisclosurePolicy;
}
export interface PresentationLogEntry {
  ts: number;
  clientId: string;
  vct: string;
  disclosed: string[];
  /** TS10: doğrulayıcının istediği alan adları (gönderilenden fazla olabilir); değer yok */
  requested?: string[];
  outcome: "sent" | "declined" | "error";
  /**
   * Aracı üzerinden gelen istekte (`tamga_on_behalf_of`, ADR-0034 K7) isteği imzalayan aracının kimliği (`client_id`); `clientId`
   * asıl doğrulayıcıdır. AB TS10 `isIntermediary` / `intermediary*`, TS8 RPT_DPA_08/09 (bildirimde aracı da yazılır). Değer yok.
   */
  intermediary?: string;
  /**
   * 0.8.4 (§4.1): yakın alanda kopya bittiği için son kopya, kişinin onayıyla YENİDEN kullanıldı (bu gösterim öncekiyle
   * eşleştirilebilir). Yalnız yeniden kullanımda yazılır.
   */
  reused?: true;
} // WL4: cihazda kalır
/** ARF DASH_05a: sunum dışındaki günlük olayları (ör. kullanıcının belge silmesi). Değer içermez. */
export interface WalletEvent {
  ts: number;
  /**
   * deleted: belge silindi · deletion_request: doğrulayıcıdan silme talebi (TS7) · dpa_report: veri koruma kurumuna bildirim (TS8)
   * · 0.6.0 (`log.ts`): issuance_failed: belge alma başarısız (DASH_02) · reissued: belge yeniden alındı (DASH_02) ·
   * w2w_verified: doğrulayan kipinde bir kişinin belgesi denetlendi (STS9_35 / DASH_03b; değer yok)
   */
  kind:
    | "deleted"
    | "deletion_request"
    | "dpa_report"
    | "pseudonym_created"
    | "pseudonym_deleted"
    | "issuance_failed"
    | "reissued"
    | "w2w_verified";
  vct: string;
  typeName: string;
  /** deletion_request / dpa_report: ilgili doğrulayıcı ve kullanılan kanal (web/email/phone); değer yok */
  clientId?: string;
  channel?: "web" | "email" | "phone";
  /** dpa_report: kurum adı */
  authority?: string;
  /**
   * deletion_request: silinmesi istenen alanların ADLARI (değer yok; AB TS7 DATA_DLT_06). Yoksa ya da boşsa o paylaşımda
   * verilen bütün veriler için talep edilmiştir (DATA_DLT_09).
   */
  claims?: string[];
  /** issuance_failed / reissued: kurumun adresi (credential_issuer) */
  issuer?: string;
  /** issuance_failed: neden kodu (`IssuanceFailureReason`; sunucu iletisi yok) */
  reason?: string;
  /** w2w_verified: sonuç (geçerli / geçersiz / doğrulanamadı) — alan ve değer yok */
  outcome?: "valid" | "invalid" | "indeterminate";
}
export interface WalletState {
  version: 1;
  createdAt: number;
  instanceId: string;
  credentials: StoredCredential[];
  presentationLog: PresentationLogEntry[];
  events?: WalletEvent[];
  passes?: import("./pass.js").PassGrant[];
  /** ADR-0031: site başına takma adlar (değer + site; anahtar ve tohum YOK — tohum SeedVault'ta). */
  pseudonyms?: import("./pseudonym.js").PseudonymEntry[];
  settings: {
    biometrics: boolean;
    /** ADR-0023 K5: sessiz kopya yenileme (varsayılan açık; false = kapalı) */
    autoRefresh?: boolean;
    theme?: "system" | "dark" | "light";
    pinned?: string[];
    trustBase?: string;
    providerBase?: string;
    idBase?: string;
    issuerBase?: string;
    /** ADR-0038: geliştirici ayarı — bağlı ağ (yoksa "production"); güven çapası ve varsayılan adresler buna göre seçilir. */
    network?: "production" | "sandbox";
    /** Tamga Wallet WA-ADR-0003 K2: telefonun yerel bildirimleri (yok = henüz sorulmadı; false = kapalı; true = açık) */
    localNotifications?: boolean;
    /** DASH_02a (0.6.0): günlük saklama süresi (gün; `LOG_RETENTION_OPTIONS_DAYS`); yoksa süresiz */
    logRetentionDays?: number;
  };
  wua?: WuaRecord;
  /** ADR-0025: cüzdan sağlayıcıda kayıtlı birim (birim anahtarı KeyProvider'da "wallet.unit") */
  walletUnit?: {
    unitId: string;
    provider: string;
    registeredAt: number;
    /**
     * sağlayıcının yazdığı depo seviyesi ve cihaz kanıtı sonucu (ADR-0025 K3; "Cüzdan bilgisi" ekranı): `attestation` =
     * kanıt yok / sunuldu ama kullanılamadı / donanım doğrulandı; `reason` = neden kullanılamadı (kişisel veri yok)
     */
    keyStorage?: KeyStorage;
    attestation?: "none" | "software" | "hardware";
    reason?: "not_configured" | "invalid" | "unsupported";
    /**
     * Birim, sağlayıcı onu tanımadığı için (kayıt silinmiş / veritabanı yeniden kurulmuş) yeniden kaydedildi — eski kapatma kodu
     * eski birime bağlıydı, artık geçmez; ana ekran "kapatma kodunu yeniden oluştur" der (WA-ADR-0002 K1).
     */
    renewedAt?: number;
  };
  /** WA-ADR-0002 K1: kapatma kodu oluşturuldu (kodun kendisi cihazda SAKLANMAZ; yalnız tarih + kaydedildiği sağlayıcı) */
  lockCode?: { createdAt: number; provider: string };
} // idBase: Tamga kimlik servisi (ADR-0011; geliştirme)
export interface Manifest {
  version: 1;
  instanceId: string;
  exportedAt: number;
  credentials: Array<{ id: string; vct: string; issuer: string; iat: number }>;
} // WL2: anahtar yok

export interface WalletStore {
  load(): Promise<WalletState | null>;
  save(state: WalletState): Promise<void>;
}
export class MemoryWalletStore implements WalletStore {
  private s: WalletState | null = null;
  async load() {
    return this.s;
  }
  async save(s: WalletState) {
    this.s = JSON.parse(JSON.stringify(s));
  }
}
/** Metin tabanlı depo (uygulama: expo-file-system readAsString/writeAsString). */
export class TextWalletStore implements WalletStore {
  constructor(
    private read: () => Promise<string | null>,
    private write: (s: string) => Promise<void>,
  ) {}
  async load() {
    const t = await this.read();
    return t ? (JSON.parse(t) as WalletState) : null;
  }
  async save(s: WalletState) {
    await this.write(JSON.stringify(s));
  }
}

export function newState(instanceId: string, now = Date.now()): WalletState {
  return {
    version: 1,
    createdAt: now,
    instanceId,
    credentials: [],
    presentationLog: [],
    settings: { biometrics: false },
  };
}

export interface ReceiveOptions {
  typeName?: string;
  stateCode?: string;
  catalogueHash?: (vct: string) => string | string[] | undefined;
  now?: number;
  /**
   * ZORUNLU güven denetimi (ADR-0056 MR1; güvenlik incelemesi 2026-11-18): imzası doğrulanmış güven kaynağı (`fetchTrustSource`).
   * Belgenin `iss`'i teklifin `credential_issuer`'ıyla aynı olmalı, sertifikadan türetilen kurum (issuer_id) güven listesinde
   * belgenin `iat`'ında belge verebilir olmalı (C1) ve bu türü vermeye yetkili olmalı (C2). Aksi hâlde belge alınmaz — başka
   * kurumun sertifikasıyla imzalanmış, listede olmayan ya da türe yetkisi olmayan kurumun belgesi cüzdana "kurum belgesi" olarak
   * girmez. `"none"`: güven denetimini bilerek atlar (yalnız test ve geliştirme); verilmemesi hatadır.
   */
  trust: TrustSource | "none";
}
/** Kopyadan kopyaya değişmesi olağan olan SD-JWT alanları (ARF ISSU_11a karşılaştırmasına girmez): cihaz anahtarı, iptal girişi, verme anı. */
const PER_COPY_CLAIMS = new Set(["cnf", "status", "iat", "_sd", "_sd_alg"]);
const comparableClaims = (claims: Record<string, unknown>) =>
  stableJson(Object.fromEntries(Object.entries(claims).filter(([k]) => !PER_COPY_CLAIMS.has(k))));

/**
 * Alınan kopyaları doğrular (her kopya kendi anahtarına bağlı mı — PR6) ve tek belge kaydı olarak ekler. Hatalı kopya seti reddedilir.
 * Toplu kopya tutarlılığı (AB ARF ISSU_11a/11b; 0.8.9): bütün kopyalar aynı tür ve kurum, aynı kurum imza sertifikası, aynı teknik
 * geçerlilik (`nbf`/`exp`) ve aynı alan değerlerini taşımalı; mdoc kopyalarında aynı çözülmüş öğe değerleri ve aynı `validFrom` /
 * `validUntil`. Kopyaya özgü olanlar (cihaz anahtarı, iptal sırası, verme anı, tuzlar, imzalar) karşılaştırılmaz. Tutarsızlıkta
 * hata fırlatılır ve hiçbir şey eklenmez; çağıran o paketin bütün anahtarlarını siler ve kişiye bildirir (ISSU_11b).
 */
/**
 * Dış sağlayıcı (ADR-0036): türü Tamga'nın şema kaydında olmayan belgenin x5c zinciri, güven kaynağının dış listelerdeki çapa
 * sertifikalarından birine bağlanıyorsa o kurumun cevabı; Tamga türü ya da dış yolu olmayan güven kaynağı için `null` (olağan
 * C1/C2 denetimi). Tür Tamga'da yok ve zincir bağlanmıyorsa: ilgili dış liste kullanılamıyorsa "sonra dene", değilse ret.
 */
function externalIssuerOf(
  trust: TrustSource,
  v: LocalVerifyOk,
): { tri: "YES" | "NO" | "UNKNOWN"; issuerId: string } | null {
  if (v.vct.startsWith("urn:tamga:") || !trust.externalIssuerByAnchor || !trust.externalAnchorCertsDer) return null;
  if (trust.schema(computeSchemaId(v.vct))) return null;
  const x5c = (v.header.x5c as string[] | undefined) ?? [];
  let chain: Uint8Array[];
  try {
    chain = x5c.map((c) => b64Decode(c));
  } catch {
    throw new Error("credential certificate chain unreadable");
  }
  const anchored = anchoredChainCerts(chain, { anchorCertificates: trust.externalAnchorCertsDer() });
  const anchor = anchored[anchored.length - 1];
  if (!anchor) {
    if (trust.unavailableExternalListFor?.(v.vct))
      throw new Error("the trusted list could not be checked; try again later");
    throw new Error("the issuer is not in the trusted list (C1)");
  }
  const fp = certFingerprintHex(anchor);
  const a = trust.externalIssuerByAnchor(fp, v.vct, v.iat);
  if (!a) throw new Error("the issuer is not in the trusted list (C1)");
  return { tri: a.tri, issuerId: `0x${fp}` };
}

export function receiveCredentials(
  state: WalletState,
  out: RedeemOutput,
  opt: ReceiveOptions,
): { state: WalletState; credential: StoredCredential; verified: LocalVerifyOk } {
  assertReceiveTrust(opt);
  const trust = opt.trust === "none" ? null : opt.trust;
  let first: LocalVerifyOk | null = null;
  let firstMdoc: ReturnType<typeof verifyReceivedMdoc> | null = null;
  const copies: StoredCopy[] = [];
  for (const c of out.copies) {
    const v = verifyIssuedSdJwt(c.combined, {
      expectedCnf: c.cnf,
      stateCode: opt.stateCode,
      catalogueHash: opt.catalogueHash,
      now: opt.now,
    });
    if (!v.ok) throw new Error(`copy rejected (${v.failedStep}): ${v.reason}`);
    // ADR-0094 K8 / ADR-0036 K5 alma yönü: Tamga kataloğunda olmayan tür (AB PID) yalnız, belge zinciri imzalı LOTL'da sabitlenmiş
    // bir dış sağlayıcı listesindeki kuruma bağlıysa ve tür o listenin kapsamındaysa alınır (doğrulayıcının B2/C yolunun aynısı);
    // kurum kimliği çapa sertifikasının parmak izi (doğrulayıcıdaki dış kurum kaydıyla aynı biçim). Ülke listesi
    // çözümünden ÖNCE: başka bir ülke listesinin kullanılamaması dış sağlayıcının belgesini durdurmaz
    const ext = trust ? externalIssuerOf(trust, v) : null;
    // ADR-0093 UL1: kurum kimliği imza sertifikasından ve kurumun kayıtlı olduğu ülke listesinden (yüklü listelerde tek eşleşme)
    if (ext) v.issuerId = ext.issuerId;
    else if (trust?.resolveIssuerId) {
      const r = trust.resolveIssuerId(v.leafFingerprint);
      if (r.kind === "found") v.issuerId = r.issuerId;
      else if (r.kind === "ambiguous")
        throw new Error("the issuer's certificate is listed in several national lists (ADR-0093)");
      else if (r.unavailableStates.length) throw new Error("the trusted list could not be checked; try again later");
    }
    if (first && (first.vct !== v.vct || first.issuerId !== v.issuerId))
      throw new Error("copies are not of the same type/issuer");
    // ARF ISSU_11a: kopyalar birbiriyle tutarlı (iletide alan değeri yok)
    if (first) {
      if (first.leafFingerprint !== v.leafFingerprint)
        throw new Error("copies are not consistent: issuer signing certificate differs (ISSU_11a)");
      if (first.nbf !== v.nbf || first.exp !== v.exp)
        throw new Error("copies are not consistent: validity differs (ISSU_11a)");
      if (comparableClaims(first.claims) !== comparableClaims(v.claims))
        throw new Error("copies are not consistent: field values differ (ISSU_11a)");
    }
    if (ext) {
      if (v.iss !== out.credentialIssuer)
        throw new Error("credential iss does not match the offer's credential_issuer");
      if (ext.tri === "UNKNOWN") throw new Error("the trusted list could not be checked; try again later");
      if (ext.tri === "NO")
        throw new Error("the provider is not authorised for this credential type in its provider list (FD2)");
    } else if (trust) {
      if (v.iss !== out.credentialIssuer)
        throw new Error("credential iss does not match the offer's credential_issuer");
      const c1 = trust.isCredentialAcceptable(v.issuerId, v.iat);
      if (c1 !== "YES")
        throw new Error(
          c1 === "UNKNOWN"
            ? "the trusted list could not be checked; try again later"
            : trust.isIssuerSuspended?.(v.issuerId) === "YES"
              ? "the issuer is suspended in the trusted list (C1, ADR-0088)"
              : "the issuer is not in the trusted list (C1)",
        );
      // C2 (AP8): kurum bu türü belgenin `iat`'ında vermeye yetkili olmalı (doğrulayıcının C2'siyle aynı soru)
      const c2 = trust.isCredentialSchemaAcceptable(v.issuerId, computeSchemaId(v.vct), v.iat);
      if (c2 !== "YES")
        throw new Error(
          c2 === "UNKNOWN"
            ? "the trusted list could not be checked; try again later"
            : "the issuer is not authorised for this credential type in the trusted list (C2)",
        );
    }
    first ??= v;
    // D-CRED-5: mdoc ikinci temsil — SD-JWT kopyasıyla çapraz doğrulanır (MD1–MD3); tutarsızsa kopya reddedilir
    // İleri tarihli belge (ARF "Issued"): mdoc kopyası geçerlilik başlangıcı anına göre denetlenir — `validFrom`'u SD-JWT
    // kopyasının `nbf`'inden sonra olan (tutarsız) mdoc yine reddedilir
    const mdocAt =
      v.notYetValid && v.nbf !== undefined ? Math.max(opt.now ?? Math.floor(Date.now() / 1000), v.nbf) : opt.now;
    if (c.mdoc) {
      const m = verifyReceivedMdoc(c.mdoc, { sdjwt: v, cnf: c.cnf, now: mdocAt });
      // ARF ISSU_11a: mdoc kopyaları da birbiriyle aynı (MD1 yalnız SD-JWT'de karşılığı olan öğeleri denetler)
      if (firstMdoc) {
        if (
          firstMdoc.validity.validFrom !== m.validity.validFrom ||
          firstMdoc.validity.validUntil !== m.validity.validUntil
        )
          throw new Error("copies are not consistent: mdoc validity differs (ISSU_11a)");
        if (firstMdoc.values !== m.values) throw new Error("copies are not consistent: mdoc values differ (ISSU_11a)");
      } else firstMdoc = m;
    }
    copies.push({
      keyRef: c.keyRef,
      cnf: c.cnf,
      combined: c.combined,
      idx: v.status?.status_list.idx,
      usedBy: [],
      ...(c.mdoc ? { mdoc: c.mdoc } : {}),
    });
  }
  if (!first) throw new Error("no copies");
  const cfg = out.metadata.credential_configurations_supported[out.vct];
  const displays = cfg?.credential_metadata?.display ?? cfg?.display; // OpenID4VCI 1.0: credential_metadata.display
  const display = displays?.find((d) => d.locale?.startsWith("tr")) ?? displays?.[0];
  // ADR-0046 K2 (EDP_10): politika belgeyle birlikte saklanır; sunumda kuruma ya da başka sunucuya sorulmaz
  const disclosurePolicy = disclosurePolicyFromMetadata(out.metadata, out.vct);
  const reuse = reuseMethodOf(out.metadata, out.vct);
  const credential: StoredCredential = {
    id: `${first.issuerId.slice(2, 10)}-${first.iat.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    vct: out.vct,
    typeName: opt.typeName ?? display?.name ?? out.vct,
    issuer: out.credentialIssuer,
    issuerId: first.issuerId,
    leafFingerprint: first.leafFingerprint,
    iat: first.iat,
    exp: first.exp,
    ...(first.nbf !== undefined ? { nbf: first.nbf } : {}),
    statusUri: first.status?.status_list.uri,
    category: first.category,
    claims: first.claims,
    disclosureNames: first.disclosures.map((d) => d.name),
    copies,
    receivedAt: opt.now ?? Math.floor(Date.now() / 1000),
    ...(out.refresh ? { refresh: out.refresh } : {}),
    ...(out.zk ? { zk: { ...out.zk, copies: [] } } : {}),
    ...(disclosurePolicy ? { disclosurePolicy } : {}),
    ...(reuse ? { reuse } : {}),
  };
  return { state: { ...state, credentials: [...state.credentials, credential] }, credential, verified: first };
}

/**
 * WL5: aynı verifier'a her zaman aynı kopya; yeni verifier'a kullanılmamış kopya; tükenirse null (yeniden ihraç gerekir).
 * `clientId` doğrulayıcının kalıcı kimliğidir (`VpRequest.rpKey` — `stableRpKey`: kaydın `dns_name`'i; ADR-0034 CI4).
 * SÖZLEŞME (0.8.3): seçilen kopya, sunum cihazdan ÇIKMADAN ÖNCE `markCopyUsed` ile işaretlenip depoya yazılır (`respond`'un
 * `beforeSend` kancası) — yalnız başarılı teslimden sonra işaretlemek, sunumu alıp hata dönen doğrulayıcının gördüğü kopyayı
 * başka doğrulayıcıya "kullanılmamış" diye verir.
 */
export function selectCopy(cred: StoredCredential, clientId: string): StoredCopy | null {
  // ADR-0089 eki (ISSU_37): yöntem B — tek kopya her doğrulayıcıya; yöntem A — her kopya bir kez (aynı doğrulayıcıya da yeni kopya)
  if (cred.reuse === "limited_time") return cred.copies[0] ?? null;
  if (cred.reuse === "once_only") return cred.copies.find((c) => c.usedBy.length === 0) ?? null;
  return cred.copies.find((c) => c.usedBy.includes(clientId)) ?? cred.copies.find((c) => c.usedBy.length === 0) ?? null;
}
export function markCopyUsed(state: WalletState, credId: string, keyRef: string, clientId: string): WalletState {
  return {
    ...state,
    credentials: state.credentials.map((c) =>
      c.id !== credId
        ? c
        : {
            ...c,
            copies: c.copies.map((k) =>
              k.keyRef !== keyRef || k.usedBy.includes(clientId) ? k : { ...k, usedBy: [...k.usedBy, clientId] },
            ),
          },
    ),
  };
}
// ---------- D7: kopya tükenmesi ve kullanıcı-başlatmalı yenileme (SPEC-WALLET-0001 §4.3). Sessiz yenileme: `autorefresh.ts` (WL7 / ADR-0023)
/** §4.3: kalan kopya bu sayıya inince kullanıcıya bildirilir ("2 kullanım kaldı"). */
export const LOW_COPIES = 2;

/**
 * Henüz hiçbir doğrulayıcıya gösterilmemiş kopya sayısı (yeni doğrulayıcılar için kalan hak). Yöntem B'de (`limited_time`) kopya
 * yeniden kullanılır, tükenmez: kopya sayısı döner (yenileme süreye bağlıdır, "az kopya" uyarısı çıkmaz).
 */
export const remainingCopies = (cred: StoredCredential) =>
  cred.reuse === "limited_time" ? cred.copies.length : cred.copies.filter((c) => c.usedBy.length === 0).length;

/**
 * Kullanılmamış kopya eşiğe indi mi (yeni paket / "az kopya" uyarısı; ARF ISSU_45)? Yöntem B'de (`limited_time`) hiçbir zaman:
 * orada yenileme yalnız süreye bağlıdır (ISSU_50).
 */
export const copiesLow = (cred: StoredCredential, limit: number = LOW_COPIES) =>
  cred.reuse !== "limited_time" && remainingCopies(cred) <= limit;

/**
 * Bu doğrulayıcıya hangi kopya gider? sticky: daha önce gösterilen (WL5) · fresh: kullanılmamış · exhausted: yeni doğrulayıcı ve
 * kopya kalmadı → kullanıcı seçer: (a) yenile, (b) mevcut bir kopyayı yeniden kullan (korelasyon uyarısıyla). Yeniden kullanım
 * adayı, EN AZ doğrulayıcıya gösterilmiş kopyadır (korelasyon yüzeyi en küçük).
 */
export type CopyPlan =
  | { kind: "sticky" | "fresh"; keyRef: string; remaining: number }
  | { kind: "exhausted"; remaining: 0; reuse: { keyRef: string; seenBy: string[] } | null };
export function planCopy(cred: StoredCredential, clientId: string): CopyPlan {
  // ADR-0089 eki (ISSU_37): yöntem B — tek kopya; yöntem A — yapışkan kopya yok, her gösterim yeni kopya (tükenince ISSU_47 yedeği:
  // kişinin onayıyla en az gösterilmiş kopya)
  if (cred.reuse === "limited_time") {
    const only = cred.copies[0];
    if (only)
      return {
        kind: only.usedBy.includes(clientId) ? "sticky" : "fresh",
        keyRef: only.keyRef,
        remaining: remainingCopies(cred),
      };
  }
  const sticky = cred.reuse === "once_only" ? undefined : cred.copies.find((c) => c.usedBy.includes(clientId));
  if (sticky) return { kind: "sticky", keyRef: sticky.keyRef, remaining: remainingCopies(cred) };
  const fresh = cred.copies.find((c) => c.usedBy.length === 0);
  if (fresh) return { kind: "fresh", keyRef: fresh.keyRef, remaining: remainingCopies(cred) };
  const reuse = [...cred.copies].sort((a, b) => a.usedBy.length - b.usedBy.length)[0];
  return { kind: "exhausted", remaining: 0, reuse: reuse ? { keyRef: reuse.keyRef, seenBy: [...reuse.usedBy] } : null };
}

// ---------- Yakın alan ve cüzdandan cüzdana: kopya tüketimi (SPEC-WALLET-0001 §4.1; 0.8.4)
/** Yakın alan oturumlarının `usedBy` anahtar öneki (`proximity:<oturumun hizmet UUID'si>`; okuyucunun kalıcı kimliği yoktur). */
export const PROXIMITY_COPY_PREFIX = "proximity:";

/**
 * Bir belgenin yakın alanda gösterilebilen (mdoc'u olan) kopyalarının durumu. Değer içermez; yalnız sayılar.
 * `low`: kalan kopya eşiğe indi (varsayılan `LOW_COPIES`) · `exhausted`: kullanılmamış kopya yok · `refreshable`: belgenin
 * yenileme belirteci var (yoksa yenileme kişinin eylemidir — WL7).
 */
export interface ProximityCopies {
  total: number;
  remaining: number;
  low: boolean;
  exhausted: boolean;
  refreshable: boolean;
}
const proximityUsable = (c: StoredCopy) => !!c.mdoc;
export function proximityCopies(cred: StoredCredential, lowAt = LOW_COPIES): ProximityCopies {
  const usable = cred.copies.filter(proximityUsable);
  const remaining = usable.filter((c) => c.usedBy.length === 0).length;
  return {
    total: usable.length,
    remaining,
    low: remaining <= lowAt,
    exhausted: remaining === 0,
    refreshable: !!cred.refresh,
  };
}

/**
 * Yakın alan oturumunun kopyası. Varsayılan: kullanılmamış mdoc kopyası; kalmadıysa `null` (sessiz yeniden kullanım yok).
 * `reuseLastCopy: true` (kişi bağlanabilirlik uyarısını kabul etti — §4.1): kopya bittiyse SON kopya yeniden kullanılır ve sonuç
 * `reused: true` taşır. Son kopya hep aynı kopyadır (yeniden kullanım tek kopyada toplanır, öbür kopyaların gösterimleri
 * birbirine bağlanmaz): önce yalnız yakın alanda gösterilmiş kopyalar (kimliği bilen uzak doğrulayıcının gördüğü kopya en son
 * tercih edilir), sonra yakın alanda en çok gösterilen, eşitlikte dizideki sonuncu.
 */
export function selectProximityCopy(
  cred: StoredCredential,
  opt: { reuseLastCopy?: boolean } = {},
): { copy: StoredCopy; reused: boolean } | null {
  const usable = cred.copies.filter(proximityUsable);
  const fresh = usable.find((c) => c.usedBy.length === 0);
  if (fresh) return { copy: fresh, reused: false };
  if (!opt.reuseLastCopy || !usable.length) return null;
  const sessions = (c: StoredCopy) => c.usedBy.filter((u) => u.startsWith(PROXIMITY_COPY_PREFIX)).length;
  const remote = (c: StoredCopy) => c.usedBy.length - sessions(c);
  let last = usable[0];
  for (const c of usable.slice(1)) {
    const better =
      (remote(c) === 0) !== (remote(last) === 0)
        ? remote(c) === 0
        : sessions(c) !== sessions(last)
          ? sessions(c) > sessions(last)
          : true; // eşitlikte dizideki sonuncu
    if (better) last = c;
  }
  return { copy: last, reused: true };
}

/**
 * Yakın alan gösteriminden ÖNCE verilecek saf karar (§4.1 tablosu). Ağ çağrısı ve ekran uygulamanın işidir:
 *  - `present`: kullanılmamış kopya var. `refreshInBackground` doğruysa (kopya azaldı ve yenileme belirteci var) uygulama
 *    gösterimden sonra arka planda yeniler (`autoRefreshCredential`; WL7 / ADR-0023 koşulları ve kişinin ayarı uygulamada).
 *  - `refresh_first`: kopya bitti, cihaz çevrimiçi — önce yenile, yeni kopyayla göster (`refreshable` değilse yenileme kişinin
 *    eylemidir: belgeyi yeniden alır).
 *  - `reuse_with_warning`: kopya bitti, cihaz çevrimdışı — kişiye "bu gösterim öncekiyle eşleştirilebilir" uyarısı; kabul ederse
 *    `presentProximity` / `presentToPerson` `reuseLastCopy: true` ile çağrılır. Uyarısız yeniden kullanım yoktur.
 *  - `unavailable`: belgenin yakın alanda gösterilebilen kopyası hiç yok.
 */
export interface ProximityCopyPlan extends ProximityCopies {
  action: "present" | "refresh_first" | "reuse_with_warning" | "unavailable";
  refreshInBackground: boolean;
}
export function planProximityCopy(cred: StoredCredential, p: { online: boolean; lowAt?: number }): ProximityCopyPlan {
  const s = proximityCopies(cred, p.lowAt);
  const action = !s.total
    ? "unavailable"
    : !s.exhausted
      ? "present"
      : p.online
        ? "refresh_first"
        : "reuse_with_warning";
  return { ...s, action, refreshInBackground: action === "present" && s.low && s.refreshable };
}

/**
 * Yenileme sonrası: yeni belge eskisinin yerini alır. Güvenlik: aynı tip ve aynı issuer olmalı. Eski belge ve ona bağlı geçiş
 * kartları (anahtarları silineceği için artık imzalanamaz) kaldırılır; çağıran `removedKeyRefs` anahtarlarını KeyProvider'dan siler.
 * SIRA SÖZLEŞMESİ (0.8.3; `autoRefreshCredential`, `refreshZkCopies` ve `removeCredential` için de geçerli): bu işlevler durumu
 * ve silinecek anahtar referanslarını DÖNDÜRÜR, anahtar silmez. Çağıran ÖNCE dönen durumu kalıcı yazar (`WalletStore.save`
 * başarıyla bitmeli), SONRA anahtarları siler. Ters sırada, yazma başarısız olursa depoda hâlâ eski belge kaydı durur ama
 * anahtarları silinmiştir — belge sunulamaz ve geri getirilemez. Anahtar silme hata verirse (`HardwareKeyProvider.delete`) kayıt
 * yine doğrudur; artık anahtar sonraki açılışta yeniden silinebilir.
 */
/**
 * D7 güvencesi: `newId` belgesi `oldId`'nin yerini alabilir mi? Yalnızca ikisi de varsa, farklıysa ve aynı tür + aynı kurumdansa.
 * Cüzdan yenileme niyetini bununla doğrular; eşleşmezse hiçbir şey silinmez (iç inceleme K2).
 */
export function canSupersede(state: WalletState, oldId: string | undefined, newId: string): boolean {
  if (!oldId || oldId === newId) return false;
  const old = state.credentials.find((c) => c.id === oldId);
  const neu = state.credentials.find((c) => c.id === newId);
  return !!old && !!neu && old.vct === neu.vct && old.issuerId === neu.issuerId;
}

export function supersedeCredential(
  state: WalletState,
  oldId: string,
  newId: string,
): { state: WalletState; removedKeyRefs: string[]; removedPasses: number } {
  const old = state.credentials.find((c) => c.id === oldId);
  const neu = state.credentials.find((c) => c.id === newId);
  if (!old || !neu || oldId === newId) return { state, removedKeyRefs: [], removedPasses: 0 };
  if (old.vct !== neu.vct || old.issuerId !== neu.issuerId)
    throw new Error("refresh: the new credential is not of the same type/issuer — the old one is kept");
  const passes = state.passes ?? [];
  const keep = passes.filter((p) => p.credentialId !== oldId);
  return {
    state: {
      ...state,
      credentials: state.credentials.filter((c) => c.id !== oldId),
      ...(state.passes ? { passes: keep } : {}),
    },
    removedKeyRefs: old.copies.map((c) => c.keyRef),
    removedPasses: passes.length - keep.length,
  };
}

export function manifestOf(state: WalletState, now = Date.now()): Manifest {
  return {
    version: 1,
    instanceId: state.instanceId,
    exportedAt: now,
    credentials: state.credentials.map((c) => ({ id: c.id, vct: c.vct, issuer: c.issuer, iat: c.iat })),
  };
}
/** ARF DASH_06a: kullanıcı günlükten kayıt siler (zaman damgasıyla; belgeye dokunmaz). */
export function deleteLogEntries(state: WalletState, ts: number[]): WalletState {
  const drop = new Set(ts);
  return {
    ...state,
    presentationLog: state.presentationLog.filter((e) => !drop.has(e.ts)),
    ...(state.events ? { events: state.events.filter((e) => !drop.has(e.ts)) } : {}),
  };
}
/**
 * Silme: belge kaydı + ona bağlı geçiş kartları (anahtarları silineceği için artık imzalanamaz) + anahtar referansları
 * (kopyalar, geçiş kartı anahtarları, yenileme DPoP anahtarı; çağıran KeyProvider.delete ile anahtarları siler).
 */
/** ADR-0060: silinmemesi gereken istemci örneği anahtarları — cüzdanın WIA'sı ve (`exceptCredId` dışındaki) belgelerin yenileme bağları. */
export function instanceKeysInUse(state: WalletState, exceptCredId?: string): Set<string> {
  const s = new Set<string>();
  if (state.wua?.keyRef) s.add(state.wua.keyRef);
  for (const c of state.credentials) {
    if (c.id === exceptCredId) continue;
    if (c.refresh?.instanceKeyRef) s.add(c.refresh.instanceKeyRef);
    if (c.zk?.instanceKeyRef) s.add(c.zk.instanceKeyRef);
  }
  return s;
}
export function removeCredential(state: WalletState, credId: string): { state: WalletState; keyRefs: string[] } {
  const c = state.credentials.find((x) => x.id === credId);
  const inUse = c ? instanceKeysInUse(state, credId) : undefined;
  return {
    state: {
      ...state,
      credentials: state.credentials.filter((x) => x.id !== credId),
      ...(state.passes ? { passes: state.passes.filter((p) => p.credentialId !== credId) } : {}),
    },
    keyRefs: c
      ? [
          ...new Set([
            ...c.copies.map((k) => k.keyRef),
            ...(state.passes ?? []).filter((p) => p.credentialId === credId).map((p) => p.keyRef),
            ...(c.refresh ? [c.refresh.dpopRef, c.refresh.instanceKeyRef ?? ""] : []),
            ...(c.zk ? [c.zk.dpopRef, c.zk.instanceKeyRef ?? "", ...c.zk.copies.map((k) => k.keyRef)] : []),
          ]),
        ]
          // ADR-0060: cüzdanın şu anki WIA'sının ve başka belgelerin yenileme bağlarının anahtarları silinmez
          .filter((k) => !!k && !inUse!.has(k))
      : [],
  };
}
