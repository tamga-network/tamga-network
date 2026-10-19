/**
 * ADR-0046 — gömülü açıklama politikası, cüzdan tarafı (EP2, EP3; ARF EDP_02/03/05/06/07/10).
 *  K2: politika belge alınırken imzalı Credential Issuer metadata'sından okunur, biçimi denetlenir ve belge kaydının yanında saklanır
 *      (politika + özet). Bozuk politika belge almayı durdurmaz; "değerlendirilemez" olarak saklanır.
 *  K3: sunumda, kayıt sertifikası (WRPRC) ADR-0026 K5'e göre doğrulandıktan sonra, ağ isteği olmadan değerlendirilir:
 *      (a) WRPRC `sub` = `rp_id` (+ öğede `service_id` varsa WRPRC `service_id` de) · (b) erişim sertifikasının konu adı = `subject_dns`
 *      öğesi · (c) WRPRC `entitlements` ∋ `entitlements` öğesi · güven kökü: WRPRC'yi ya da erişim sertifikasını imzalayan zincirde
 *      listelenen (veren adı, seri no) — yalnız imza zinciri doğrulanmış VE güvene bağlanmış sertifikalar sayılır
 *      (`anchoredChainCerts`); ad/seri yalnız doğrulanamayan bir sertifikada tutuyorsa değerlendirilemez, hiçbir zaman "geçti"
 *      değil. Kayıt sertifikası yoksa (istekte yok, yakın mesafe, cüzdandan cüzdana) değerlendirilemez.
 *  Erişim sertifikası çapası (0.5.2): kayıt sertifikası isteğe yalnız `organizationIdentifier` ile bağlanır; kayıt sertifikası
 *      herkese açıktır ve kopyalanabilir. Bu yüzden WRPRC'ye dayanan her karardan ÖNCE isteği imzalayan erişim sertifikası güvene
 *      bağlanmış olmalıdır: (i) yaprağın parmak izi doğrulayıcının imzalı listedeki kaydında sabitlenmiş (`registeredFingerprints`;
 *      `checkRp` aynı eşleşmeyi `x509_hash` ile denetler) YA DA (ii) zincir imzası yapraktan imzalı listedeki bir CA'ya
 *      (`trustAnchors`, `root_cas`) kadar doğrulanıyor (`anchoredChainCerts`). x5c kökü taşımaz (ARF RO-02): çapa, zincirin son
 *      sertifikasını imzalayan CA olabilir — bunun için çapa parmak izi değil sertifikadır (`root_cas[].cert_pem`). İkisi de yoksa sonuç "değerlendirilemez"
 *      (`untrusted_access_certificate`) — kendinden imzalı bir kopya hiçbir zaman "yetkili" sayılmaz.
 *  K4: sonuç onay ekranındadır — geçmezse ayrı uyarı, varsayılan "Paylaşma"; son karar kişinindir (cüzdan engellemez).
 */
import {
  EMBEDDED_DISCLOSURE_POLICY_MEMBER,
  disclosurePolicyDigest,
  restrictsDisclosure,
  validateDisclosurePolicy,
  type DisclosurePolicyType,
  type EmbeddedDisclosurePolicy,
} from "@tamga-network/core/disclosure-policy";
import type { EpochMillis } from "@tamga-network/core/time";
import { anchoredChainCerts, certMatchesRootOfTrust, certSubjectMatches } from "@tamga-network/trust/core";
import type { IssuerMetadata } from "./oid4vci.js";
import type { Match, VpRequest } from "./oid4vp.js";
import { relevantRegistrationCerts, type RelevantRegistrationCert } from "./wrprc.js";
import { anchorOpts, chainAnchored, type TrustAnchor } from "./anchors.js";

export type { EmbeddedDisclosurePolicy, DisclosurePolicyType } from "@tamga-network/core/disclosure-policy";

/** Belge kaydında saklanan politika (K2). */
export interface StoredDisclosurePolicy {
  /** biçim denetiminden geçmiş politika (bozuksa yok) */
  policy?: EmbeddedDisclosurePolicy;
  /** `sha256:<hex>` — belge verenin belge kaydındaki özetle aynı biçim (EP4) */
  digest: string;
  /** politika okunamadı: sunumda "değerlendirilemedi" uyarısı (K2) */
  malformed?: true;
}

/**
 * Metadata'daki yapılandırmanın politikası (K2). Politika yoksa `undefined`. Cüzdan bunu belge kaydına yazar (`receiveCredentials`
 * kendisi çağırır); başka yoldan alınan belgeler (yenileme, kimliğe bağlı teklif) de aynı metadata'dan geçer.
 */
export function disclosurePolicyFromMetadata(
  metadata: Pick<IssuerMetadata, "credential_configurations_supported">,
  configurationId: string,
): StoredDisclosurePolicy | undefined {
  const raw = (
    metadata.credential_configurations_supported?.[configurationId]?.credential_metadata as
      Record<string, unknown> | undefined
  )?.[EMBEDDED_DISCLOSURE_POLICY_MEMBER];
  if (raw === undefined || raw === null) return undefined;
  const v = validateDisclosurePolicy(raw);
  if (v.ok) return { policy: v.policy, digest: disclosurePolicyDigest(v.policy)! };
  return { digest: disclosurePolicyDigest(raw as EmbeddedDisclosurePolicy)!, malformed: true };
}

export type DisclosurePolicyOutcome = "passed" | "failed" | "not_evaluable";
/**
 * Neden (onay ekranı metni ve iz kaydı; kişisel veri yok):
 *  - `no_policy`: belge kısıt taşımıyor (politika yok ya da `none`)
 *  - `authorized`: listedeki bir doğrulayıcı / ad / yetki türü / güven kökü eşleşti
 *  - `not_authorized`: doğrulayıcı politikanın izin verdikleri arasında değil
 *  - `no_registration_certificate`: istekte kayıt sertifikası yok (yakın mesafe, cüzdandan cüzdana dahil)
 *  - `malformed_policy`: saklanan politika okunamadı
 *  - `unverified_chain`: güven kökü öğesi zincirdeki bir sertifikayla tutuyor ama o sertifikanın imza zinciri doğrulanamadı ya da
 *    güvene bağlanamadı (kopyalanmış ad/seri, eklenmiş kök, desteklenmeyen algoritma) — değerlendirilemez
 *  - `untrusted_access_certificate`: isteği imzalayan erişim sertifikası ne doğrulayıcının kayıtlı parmak iziyle eşleşiyor ne de
 *    imzalı listedeki bir CA'ya bağlanıyor — kayıt sertifikası bu isteğe ait olduğu kanıtlanamadığı için değerlendirilemez
 */
export type DisclosurePolicyReason =
  | "no_policy"
  | "authorized"
  | "not_authorized"
  | "no_registration_certificate"
  | "malformed_policy"
  | "unverified_chain"
  | "untrusted_access_certificate";

export interface DisclosurePolicyResult {
  outcome: DisclosurePolicyOutcome;
  reason: DisclosurePolicyReason;
  /** belge kısıtlı mı (politika var ve `none` değil) — onay ekranı yalnız kısıtlı belgede uyarı düşünür */
  restricted: boolean;
  type?: DisclosurePolicyType;
  policyId?: string;
  /** EDP_05: "Kuralı oku" bağlantısı (https) */
  infoUri?: string;
  /** eşleşen öğe türü (iz kaydı için): rp · subject_dn · entitlement · root_of_trust */
  matchedBy?: "rp" | "subject_dn" | "entitlement" | "root_of_trust";
}

export { splitTrustAnchors, type TrustAnchor } from "./anchors.js";

/** Değerlendirme bağlamı: doğrulanmış kayıt sertifikaları (bu sorgu için) ve isteği imzalayan erişim sertifikası zinciri. */
export interface DisclosurePolicyContext {
  registrationCerts: RelevantRegistrationCert[];
  /** erişim sertifikası zinciri (yaprak ilk); yoksa yalnız yaprak */
  accessCertChain: Uint8Array[];
  /**
   * İmzalı listeden gelen güvenilir CA'lar (`TrustAnchor`: sertifika ya da SHA-256 parmak izi; ör. erişim sertifikası sağlayıcıları).
   * Erişim sertifikası zinciri yalnız bunlardan birine bağlanırsa güven kökü kararına girer: isteği gönderen kendi zincirini
   * kurabilir. Kökü x5c'de olmayan zincir için çapa sertifikası gerekir. Kayıt sertifikası zincirinin yaprağı zaten kayıt kurumu
   * anahtarıdır (imzalı listeden).
   */
  trustAnchors?: TrustAnchor[];
  /**
   * Doğrulayıcının imzalı listedeki kaydında sabitlenmiş erişim sertifikası parmak izleri (SHA-256, onaltılık; RP kaydının
   * `access_cert_fingerprint_sha256`'sı). Yaprak bunlardan biriyse erişim sertifikası güvene bağlı sayılır (kayıt sertifikasının
   * isteğe bağı için; güven kökü kuralında erişim zinciri yine yalnız `trustAnchors` ile sayılır).
   */
  registeredFingerprints?: string[];
}

/**
 * Kayıt sertifikasının bu isteğe ait olduğunun ön koşulu: erişim sertifikası (yaprak) kayıtlı parmak iziyle eşleşiyor ya da zinciri
 * imzalı listedeki bir CA'ya bağlanıyor. Kendinden imzalı, kurum kimliği kopyalanmış sertifika ikisini de sağlayamaz.
 */
export function accessCertAnchored(
  ctx: Pick<DisclosurePolicyContext, "accessCertChain" | "trustAnchors" | "registeredFingerprints">,
): boolean {
  return chainAnchored(ctx.accessCertChain, ctx);
}

/**
 * K3 değerlendirmesi — saf, ağsız. `ctx` yoksa ya da kayıt sertifikası yoksa kısıtlı politika değerlendirilemez (başarısız
 * sayılır; K3). Birden çok kayıt sertifikası varsa herhangi biri politikayı karşılarsa geçer.
 */
export function evaluateDisclosurePolicy(
  stored: StoredDisclosurePolicy | undefined,
  ctx: DisclosurePolicyContext | null,
): DisclosurePolicyResult {
  if (stored?.malformed) return { outcome: "not_evaluable", reason: "malformed_policy", restricted: true };
  const p = stored?.policy;
  if (!p || !restrictsDisclosure(p))
    return {
      outcome: "passed",
      reason: "no_policy",
      restricted: false,
      ...(p ? { type: p.type, policyId: p.id } : {}),
    };
  const base = { restricted: true, type: p.type, policyId: p.id, ...(p.info_uri ? { infoUri: p.info_uri } : {}) };
  const certs = ctx?.registrationCerts ?? [];
  if (!ctx || !certs.length) return { ...base, outcome: "not_evaluable", reason: "no_registration_certificate" };
  // kayıt sertifikası isteğe yalnız kurum kimliğiyle bağlı: erişim sertifikası güvene bağlanmadan hiçbir öğe değerlendirilmez
  if (!accessCertAnchored(ctx)) return { ...base, outcome: "not_evaluable", reason: "untrusted_access_certificate" };
  const pass = (matchedBy: DisclosurePolicyResult["matchedBy"]): DisclosurePolicyResult => ({
    ...base,
    outcome: "passed",
    reason: "authorized",
    matchedBy,
  });
  if (p.type === "authorized_relying_parties") {
    for (const { payload } of certs) {
      // (a) ARF EDP_02 ikilisi — aracılı istekte de `sub` aracılanan (asıl) doğrulayıcıdır
      if (
        p.relying_parties?.some(
          (rp) => rp.rp_id === payload.sub && (rp.service_id === undefined || rp.service_id === payload.service_id),
        )
      )
        return pass("rp");
      // (c) ETSI -07b yetki türü
      if (p.entitlements?.some((e) => (payload.entitlements ?? []).includes(e))) return pass("entitlement");
    }
    // (b) ETSI -07a erişim sertifikasının konu adı. Aracılı istekte erişim sertifikası aracıyı gösterir; karar aracılanan
    // doğrulayıcınındır (ARF EDP_02 notu) — aracının adı eşleşme sayılmaz.
    const intermediated = certs.some((c) => !!c.payload.intermediary);
    const leaf = ctx.accessCertChain[0];
    if (!intermediated && leaf && p.subject_dns?.some((dn) => certSubjectMatches(leaf, dn))) return pass("subject_dn");
    return { ...base, outcome: "failed", reason: "not_authorized" };
  }
  // specific_roots_of_trust: WRPRC zinciri (ARF EDP_03) ya da erişim sertifikası zinciri (Tüzük Ek III, ETSI -08). Ad ve seri
  // numarası kopyalanabilir, x5c'ye istenen sertifika eklenebilir: yalnız imza zinciri yapraktan o sertifikaya kadar doğrulanmış ve
  // güvene bağlanmış sertifikalar sayılır. WRPRC yaprağı imzalı listedeki kayıt kurumu anahtarıdır (verifyWrprc); erişim
  // sertifikası zinciri yalnız `trustAnchors`'tan birine bağlanırsa sayılır.
  const anchors = anchorOpts(ctx.trustAnchors);
  const chains = [
    ...certs.map((c) => ({
      raw: c.chainDer,
      trusted: anchoredChainCerts(c.chainDer, { leafTrusted: true, ...anchors }),
    })),
    {
      raw: ctx.accessCertChain,
      trusted: anchoredChainCerts(ctx.accessCertChain, { leafTrusted: false, ...anchors }),
    },
  ];
  const roots = p.roots_of_trust ?? [];
  if (roots.some((r) => chains.some((c) => c.trusted.some((der) => certMatchesRootOfTrust(der, r)))))
    return pass("root_of_trust");
  if (roots.some((r) => chains.some((c) => c.raw.some((der) => certMatchesRootOfTrust(der, r)))))
    return { ...base, outcome: "not_evaluable", reason: "unverified_chain" };
  return { ...base, outcome: "failed", reason: "not_authorized" };
}

/**
 * Sunum isteği için bağlam: kayıt sertifikaları ADR-0026 K5'e göre doğrulanır (kayıt kurumu imzası, süre, erişim sertifikasıyla
 * bağ). Sertifikalar geçersizse `null` döner — çağıran isteği zaten reddeder (WRC4).
 */
export function disclosurePolicyContext(
  req: VpRequest,
  registrarKeys: string[],
  match: Pick<Match, "queryId">,
  now?: EpochMillis,
  trustAnchors: TrustAnchor[] = [],
  registeredFingerprints: string[] = [],
): DisclosurePolicyContext | null {
  const r = relevantRegistrationCerts(req, registrarKeys, match, now);
  if (!r.valid) return null;
  return {
    registrationCerts: r.certs,
    accessCertChain: req.chainDer?.length ? req.chainDer : [req.leafDer],
    ...(trustAnchors.length ? { trustAnchors } : {}),
    ...(registeredFingerprints.length ? { registeredFingerprints } : {}),
  };
}

/**
 * Kısayol: eşleşen belgenin politikası bu istek için (onay ekranı). `trustAnchors`: erişim sertifikası zinciri için güvenilir CA
 * sertifikaları ya da parmak izleri (imzalı listenin `root_cas`'ı; kökü x5c'de olmayan zincir için sertifika gerekir). `registeredFingerprints`: doğrulayıcının imzalı listedeki kaydının erişim
 * sertifikası parmak izi (`checkRp` eşleşmeyi doğruladıysa; taklitte verilmez). İkisi de yoksa kısıtlı politika değerlendirilemez.
 */
export function checkDisclosurePolicy(
  req: VpRequest,
  registrarKeys: string[],
  match: Pick<Match, "queryId"> & { credential: { disclosurePolicy?: StoredDisclosurePolicy } },
  now?: EpochMillis,
  trustAnchors: TrustAnchor[] = [],
  registeredFingerprints: string[] = [],
): DisclosurePolicyResult {
  const stored = match.credential.disclosurePolicy;
  if (!stored) return evaluateDisclosurePolicy(undefined, null);
  return evaluateDisclosurePolicy(
    stored,
    disclosurePolicyContext(req, registrarKeys, match, now, trustAnchors, registeredFingerprints),
  );
}

/**
 * Yakın mesafe (ISO 18013-5) ve cüzdandan cüzdana sunumda kayıt sertifikası yoktur: kısıtlı politika değerlendirilemez (ADR-0046
 * Sonuçlar — yakın mesafede uyarıyla gösterilir, cüzdandan cüzdana cüzdanın kararıdır).
 */
export const offlineDisclosurePolicy = (cred: { disclosurePolicy?: StoredDisclosurePolicy }): DisclosurePolicyResult =>
  evaluateDisclosurePolicy(cred.disclosurePolicy, null);
