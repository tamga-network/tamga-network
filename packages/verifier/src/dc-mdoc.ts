/**
 * Tarayıcı Digital Credentials API'si — ISO/IEC 18013-7 Ek C (`org-iso-mdoc`), doğrulayıcı (sunucu) tarafı. OpenID4VP
 * (`openid4vp-v1-signed`) yolunun yanında ikinci protokol: Safari / iOS 26 tarayıcısı mdoc'u yalnız bununla ister.
 *
 *  1. `createMdocDcApiRequest` — politikanın `mso_mdoc` belgesinden DeviceRequest, HPKE alıcı anahtarı (EncryptionInfo) ve bu
 *     isteğin SessionTranscript'i; istenirse okuyucu imzası (`readerAuth`, doğrulayıcının erişim sertifikasıyla).
 *  2. Sayfa `navigator.credentials.get({ digital: { requests: [{ protocol: "org-iso-mdoc", data }] } })` çağırır, yanıtı
 *     doğrulayıcıya iletir.
 *  3. `openMdocDcApiResponse` — HPKE açar, DeviceResponse'u verir; `verifyPresentation({ format: "mso_mdoc", sessionTranscript })`
 *     aynı A–E hattıyla doğrular (cihaz imzası bu isteğin dökümüne bağlı — tekrar oynatılamaz, başka sitede kullanılamaz).
 * Durum (alıcı özel anahtarı + döküm) doğrulayıcının sunum kaydında kalır; tarayıcıya yalnız `data` gider.
 */
import {
  ORG_ISO_MDOC,
  createAnnexCRequest,
  deviceResponseStatus,
  openAnnexCResponse,
  type AnnexCRequestData,
  type ItemsRequest,
} from "@tamga-network/mdoc";
import type { Policy } from "./policy.js";

export { ORG_ISO_MDOC };

export interface MdocDcApiRequest {
  /** `navigator.credentials.get({ digital: { requests: [dcApiRequest] } })` girdisi */
  dcApiRequest: { protocol: typeof ORG_ISO_MDOC; data: AnnexCRequestData };
  /** sunucuda kalır: yanıtı açmak için */
  recipientPrivateKey: Uint8Array;
  /** sunucuda kalır: cihaz imzası ve HPKE `info` */
  sessionTranscript: Uint8Array;
  /** isteğin politikadaki belge kimliği (vp_token anahtarı yerine) */
  policyCredentialId: string;
}

/** Politikanın ilk `mso_mdoc` belgesi → ISO 18013-5 istek öğesi (saklama niyeti yok). */
export function mdocItemsFromPolicy(policy: Policy): { items: ItemsRequest[]; policyCredentialId: string } | null {
  const c = policy.credentials.find((x) => x.format === "mso_mdoc");
  if (!c || !c.namespace || !c.vct_values[0]) return null;
  return {
    policyCredentialId: c.id,
    items: [
      {
        docType: c.vct_values[0],
        nameSpaces: { [c.namespace]: Object.fromEntries(c.required_claims.map((n) => [n, false])) },
      },
    ],
  };
}

/**
 * Ek C isteği. `origin` isteği yapan sayfanın kökeni (döküme girer; başka kökenden gelen yanıt doğrulanmaz). `readerAuth`
 * verilirse istek okuyucu imzası taşır (bazı tarayıcı cüzdanları okuyucu kimliğini ister). Politikada `mso_mdoc` yoksa `null`.
 */
export function createMdocDcApiRequest(p: {
  policy: Policy;
  origin: string;
  readerAuth?: { sk: Uint8Array; x5chain: Uint8Array[] };
}): MdocDcApiRequest | null {
  const it = mdocItemsFromPolicy(p.policy);
  if (!it) return null;
  const r = createAnnexCRequest({ items: it.items, origin: p.origin, readerAuth: p.readerAuth });
  return {
    dcApiRequest: { protocol: ORG_ISO_MDOC, data: r.data },
    recipientPrivateKey: r.recipientPrivateKey,
    sessionTranscript: r.sessionTranscript,
    policyCredentialId: it.policyCredentialId,
  };
}

/**
 * Yanıt → `verifyPresentation`'a verilecek sunum (base64url DeviceResponse). Açılamayan yanıt hata fırlatır (sunum tüketilmez);
 * belgesiz yanıt (cüzdan reddetti, status ≠ 0) `refused` döner.
 */
export function openMdocDcApiResponse(
  response: unknown,
  state: Pick<MdocDcApiRequest, "recipientPrivateKey" | "sessionTranscript">,
): { presentation: string } | { refused: number } {
  const dr = openAnnexCResponse(response, state);
  try {
    const st = deviceResponseStatus(dr);
    if (st.status !== 0 && st.documents === 0) return { refused: st.status };
  } catch {
    /* çözülemeyen DeviceResponse: A1 doğrulamada reddeder */
  }
  return { presentation: Buffer.from(dr).toString("base64url") };
}
