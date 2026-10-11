/**
 * ADR-0046 — gömülü açıklama politikası, cüzdan tarafı (EP2, EP3; ARF EDP_02/03/05/06/07/10).
 *  K2: politika belge alınırken imzalı Credential Issuer metadata'sından okunur, biçimi denetlenir ve belge kaydının yanında saklanır
 *      (politika + özet). Bozuk politika belge almayı durdurmaz; "değerlendirilemez" olarak saklanır.
 *  K3: sunumda, kayıt sertifikası (WRPRC) ADR-0026 K5'e göre doğrulandıktan sonra, ağ isteği olmadan değerlendirilir:
 *      (a) WRPRC `sub` = `rp_id` (+ öğede `service_id` varsa WRPRC `service_id` de) · (b) erişim sertifikasının konu adı = `subject_dns`
 *      öğesi · (c) WRPRC `entitlements` ∋ `entitlements` öğesi · güven kökü: WRPRC'yi ya da erişim sertifikasını imzalayan zincirde
 *      listelenen (veren adı, seri no). Kayıt sertifikası yoksa (istekte yok, yakın mesafe, cüzdandan cüzdana) değerlendirilemez.
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
import { certMatchesRootOfTrust, certSubjectMatches } from "@tamga-network/trust/core";
import type { IssuerMetadata } from "./oid4vci.js";
import type { Match, VpRequest } from "./oid4vp.js";
import { relevantRegistrationCerts, type RelevantRegistrationCert } from "./wrprc.js";

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
 */
export type DisclosurePolicyReason =
  "no_policy" | "authorized" | "not_authorized" | "no_registration_certificate" | "malformed_policy";

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

/** Değerlendirme bağlamı: doğrulanmış kayıt sertifikaları (bu sorgu için) ve isteği imzalayan erişim sertifikası zinciri. */
export interface DisclosurePolicyContext {
  registrationCerts: RelevantRegistrationCert[];
  /** erişim sertifikası zinciri (yaprak ilk); yoksa yalnız yaprak */
  accessCertChain: Uint8Array[];
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
  // specific_roots_of_trust: WRPRC zinciri (ARF EDP_03) ya da erişim sertifikası zinciri (Tüzük Ek III, ETSI -08)
  const chains = [...certs.flatMap((c) => c.chainDer), ...ctx.accessCertChain];
  if (p.roots_of_trust?.some((r) => chains.some((der) => certMatchesRootOfTrust(der, r)))) return pass("root_of_trust");
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
  now = Date.now(),
): DisclosurePolicyContext | null {
  const r = relevantRegistrationCerts(req, registrarKeys, match, now);
  if (!r.valid) return null;
  return { registrationCerts: r.certs, accessCertChain: req.chainDer?.length ? req.chainDer : [req.leafDer] };
}

/** Kısayol: eşleşen belgenin politikası bu istek için (onay ekranı). */
export function checkDisclosurePolicy(
  req: VpRequest,
  registrarKeys: string[],
  match: Pick<Match, "queryId"> & { credential: { disclosurePolicy?: StoredDisclosurePolicy } },
  now = Date.now(),
): DisclosurePolicyResult {
  const stored = match.credential.disclosurePolicy;
  if (!stored) return evaluateDisclosurePolicy(undefined, null);
  return evaluateDisclosurePolicy(stored, disclosurePolicyContext(req, registrarKeys, match, now));
}

/**
 * Yakın mesafe (ISO 18013-5) ve cüzdandan cüzdana sunumda kayıt sertifikası yoktur: kısıtlı politika değerlendirilemez (ADR-0046
 * Sonuçlar — yakın mesafede uyarıyla gösterilir, cüzdandan cüzdana cüzdanın kararıdır).
 */
export const offlineDisclosurePolicy = (cred: { disclosurePolicy?: StoredDisclosurePolicy }): DisclosurePolicyResult =>
  evaluateDisclosurePolicy(cred.disclosurePolicy, null);
