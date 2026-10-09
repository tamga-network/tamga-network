/**
 * Cüzdan deposu — SPEC-WALLET-0001 §3 (yerel depo), §4 (batch kopyaları, WL5 yapışkan kopya), §7 (manifest; anahtar yok — WL2).
 * Depo soyut: uygulama JSON'u nereye yazacağını seçer (expo-file-system); anahtarlar KeyProvider'da (ayrı).
 */
import { verifyIssuedSdJwt, type LocalVerifyOk } from "./sdjwt.js";
import type { KeyStorage, PublicJwk } from "./keys.js";
import type { RedeemOutput } from "./oid4vci.js";
import type { WuaRecord } from "./wua.js";
import { verifyReceivedMdoc } from "./mdoc.js";
import type { TrustSource } from "@tamga-network/trust/core";

export interface StoredCopy {
  keyRef: string;
  cnf: PublicJwk;
  combined: string;
  idx?: number;
  usedBy: string[];
  /** D-CRED-5: aynı anahtara bağlı mdoc (base64url IssuerSigned). */
  mdoc?: string;
} // usedBy: client_id'ler (WL5)
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
}
export interface PresentationLogEntry {
  ts: number;
  clientId: string;
  vct: string;
  disclosed: string[];
  /** TS10: doğrulayıcının istediği alan adları (gönderilenden fazla olabilir); değer yok */
  requested?: string[];
  outcome: "sent" | "declined" | "error";
} // WL4: cihazda kalır
/** ARF DASH_05a: sunum dışındaki günlük olayları (ör. kullanıcının belge silmesi). Değer içermez. */
export interface WalletEvent {
  ts: number;
  /** deleted: belge silindi · deletion_request: doğrulayıcıdan silme talebi (TS7) · dpa_report: veri koruma kurumuna bildirim (TS8) */
  kind: "deleted" | "deletion_request" | "dpa_report" | "pseudonym_created" | "pseudonym_deleted";
  vct: string;
  typeName: string;
  /** deletion_request / dpa_report: ilgili doğrulayıcı ve kullanılan kanal (web/email/phone); değer yok */
  clientId?: string;
  channel?: "web" | "email" | "phone";
  /** dpa_report: kurum adı */
  authority?: string;
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
   * Güven denetimi (verilirse uygulanır; imzası doğrulanmış güven kaynağı — `fetchTrustSource`): belgenin `iss`'i teklifin
   * `credential_issuer`'ıyla aynı olmalı ve sertifikadan türetilen kurum (issuer_id) güven listesinde belgenin `iat`'ında belge
   * verebilir olmalı (C1). Aksi hâlde belge alınmaz — başka kurumun sertifikasıyla imzalanmış ya da listede olmayan kurumun
   * belgesi cüzdana "kurum belgesi" olarak girmez.
   */
  trust?: TrustSource;
}
/** Alınan kopyaları doğrular (her kopya kendi anahtarına bağlı mı — PR6) ve tek belge kaydı olarak ekler. Hatalı kopya seti reddedilir. */
export function receiveCredentials(
  state: WalletState,
  out: RedeemOutput,
  opt: ReceiveOptions = {},
): { state: WalletState; credential: StoredCredential; verified: LocalVerifyOk } {
  let first: LocalVerifyOk | null = null;
  const copies: StoredCopy[] = [];
  for (const c of out.copies) {
    const v = verifyIssuedSdJwt(c.combined, {
      expectedCnf: c.cnf,
      stateCode: opt.stateCode,
      catalogueHash: opt.catalogueHash,
      now: opt.now,
    });
    if (!v.ok) throw new Error(`copy rejected (${v.failedStep}): ${v.reason}`);
    if (first && (first.vct !== v.vct || first.issuerId !== v.issuerId))
      throw new Error("copies are not of the same type/issuer");
    if (opt.trust) {
      if (v.iss !== out.credentialIssuer)
        throw new Error("credential iss does not match the offer's credential_issuer");
      const c1 = opt.trust.isCredentialAcceptable(v.issuerId, v.iat);
      if (c1 !== "YES")
        throw new Error(
          c1 === "UNKNOWN"
            ? "the trusted list could not be checked; try again later"
            : "the issuer is not in the trusted list (C1)",
        );
    }
    first ??= v;
    // D-CRED-5: mdoc ikinci temsil — SD-JWT kopyasıyla çapraz doğrulanır (MD1–MD3); tutarsızsa kopya reddedilir
    if (c.mdoc) verifyReceivedMdoc(c.mdoc, { sdjwt: v, cnf: c.cnf, now: opt.now });
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
  const credential: StoredCredential = {
    id: `${first.issuerId.slice(2, 10)}-${first.iat.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    vct: out.vct,
    typeName: opt.typeName ?? display?.name ?? out.vct,
    issuer: out.credentialIssuer,
    issuerId: first.issuerId,
    leafFingerprint: first.leafFingerprint,
    iat: first.iat,
    exp: first.exp,
    statusUri: first.status?.status_list.uri,
    category: first.category,
    claims: first.claims,
    disclosureNames: first.disclosures.map((d) => d.name),
    copies,
    receivedAt: opt.now ?? Math.floor(Date.now() / 1000),
    ...(out.refresh ? { refresh: out.refresh } : {}),
    ...(out.zk ? { zk: { ...out.zk, copies: [] } } : {}),
  };
  return { state: { ...state, credentials: [...state.credentials, credential] }, credential, verified: first };
}

/** WL5: aynı verifier'a her zaman aynı kopya; yeni verifier'a kullanılmamış kopya; tükenirse null (yeniden ihraç gerekir). */
export function selectCopy(cred: StoredCredential, clientId: string): StoredCopy | null {
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
// ---------- D7: kopya tükenmesi ve kullanıcı-başlatmalı yenileme (SPEC-WALLET-0001 §4.3; WL7: otomatik yenileme YOK)
/** §4.3: kalan kopya bu sayıya inince kullanıcıya bildirilir ("2 kullanım kaldı"). */
export const LOW_COPIES = 2;

/** Henüz hiçbir doğrulayıcıya gösterilmemiş kopya sayısı (yeni doğrulayıcılar için kalan hak). */
export const remainingCopies = (cred: StoredCredential) => cred.copies.filter((c) => c.usedBy.length === 0).length;

/**
 * Bu doğrulayıcıya hangi kopya gider? sticky: daha önce gösterilen (WL5) · fresh: kullanılmamış · exhausted: yeni doğrulayıcı ve
 * kopya kalmadı → kullanıcı seçer: (a) yenile, (b) mevcut bir kopyayı yeniden kullan (korelasyon uyarısıyla). Yeniden kullanım
 * adayı, EN AZ doğrulayıcıya gösterilmiş kopyadır (korelasyon yüzeyi en küçük).
 */
export type CopyPlan =
  | { kind: "sticky" | "fresh"; keyRef: string; remaining: number }
  | { kind: "exhausted"; remaining: 0; reuse: { keyRef: string; seenBy: string[] } | null };
export function planCopy(cred: StoredCredential, clientId: string): CopyPlan {
  const sticky = cred.copies.find((c) => c.usedBy.includes(clientId));
  if (sticky) return { kind: "sticky", keyRef: sticky.keyRef, remaining: remainingCopies(cred) };
  const fresh = cred.copies.find((c) => c.usedBy.length === 0);
  if (fresh) return { kind: "fresh", keyRef: fresh.keyRef, remaining: remainingCopies(cred) };
  const reuse = [...cred.copies].sort((a, b) => a.usedBy.length - b.usedBy.length)[0];
  return { kind: "exhausted", remaining: 0, reuse: reuse ? { keyRef: reuse.keyRef, seenBy: [...reuse.usedBy] } : null };
}

/**
 * Yenileme sonrası: yeni belge eskisinin yerini alır. Güvenlik: aynı tip ve aynı issuer olmalı. Eski belge ve ona bağlı geçiş
 * kartları (anahtarları silineceği için artık imzalanamaz) kaldırılır; çağıran `removedKeyRefs` anahtarlarını KeyProvider'dan siler.
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
export function removeCredential(state: WalletState, credId: string): { state: WalletState; keyRefs: string[] } {
  const c = state.credentials.find((x) => x.id === credId);
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
            ...(c.refresh ? [c.refresh.dpopRef] : []),
            ...(c.zk ? [c.zk.dpopRef, ...c.zk.copies.map((k) => k.keyRef)] : []),
          ]),
        ].filter(Boolean)
      : [],
  };
}
