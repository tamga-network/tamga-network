/**
 * `@tamga-network/verifier/web` — sitenin SAYFASINDA çalışan parça (D14). Doğrulama YAPMAZ: tarayıcıdaki kod kullanıcı
 * tarafından değiştirilebilir, bu yüzden karar her zaman sitenin sunucusunda `@tamga-network/verifier` ile (ya da barındırılan
 * doğrulayıcıda) verilir. Bu parça yalnızca isteği başlatır, QR / "cüzdanda aç" düğmesini gösterir, sonucu yoklar ve passkey
 * (WebAuthn) tarayıcı çağrılarını JSON'a çevirir.
 *
 *   import { mount, passkey } from "@tamga-network/verifier/web";
 *   mount(el, { verifier: "https://verify.tamga.network", policy: "site-signup",
 *               start: () => fetch("/tamga/start", { method: "POST" }).then((r) => r.json()),   // sitenizin sunucusu açar
 *               onResult: (id) => … });
 * Barındırılan doğrulayıcıda sunumu SİTENİN SUNUCUSU açar (RP beyanıyla — ADR-0017); kit yalnızca `status_token` ile durumu
 * izler, değer görmez. `start` verilmezse kit sunumu doğrudan açar (yalnızca demo kipinde ya da kendi doğrulayıcınızda).
 *
 * <script> ile: doğrulayıcı bu modülü paketleyip `/tamga-verifier.js` olarak sunar → `window.TamgaVerifier.mount(…)`.
 * Taşıma-bağımsız: tarayıcı Digital Credentials API'si yaygınlaşınca aynı arayüz `navigator.credentials.get` kullanır
 * (Chrome: OpenID4VP; Safari: mdoc — D-CRED-5).
 */

export interface MountOptions {
  /** Doğrulayıcı tabanı (barındırılan ya da sitenin kendi `@tamga-network/verifier` servisi). */
  verifier: string;
  /** Doğrulayıcıdaki politika kimliği (ör. `site-signup`, `site-signin`, `age-over-18`). */
  policy: string;
  /** ACCEPTED olunca: `presentationId` sitenin sunucusuna gönderilir; sunucu sonucu ve alanları doğrulayıcıdan kendisi alır. */
  onResult?: (presentationId: string, status: PresentationStatus) => void;
  onError?: (e: unknown) => void;
  /** Yoklama aralığı (ms), varsayılan 1500. */
  pollMs?: number;
  /** Sunumu sitenin sunucusu açar (ADR-0017 K2): `{presentation_id, qr_payload, expires_at, status_token}` döndürür. */
  start?: (o: { dcApiOrigin?: string }) => Promise<StartedPresentation>;
  /** Metin dili: "en" | "tr" | "tk". Verilmezse sayfanın `<html lang>` değeri, desteklenmiyorsa "en". */
  lang?: string;
  /**
   * Tarayıcı Digital Credentials API'si destekliyorsa (`navigator.credentials.get({ digital })`) QR'ın yanında "Bu cihazdan
   * paylaş" düğmesi. Kit kendisi başlatıyorsa sayfa kökenini `dc_api_origin` olarak gönderir; `start` veriliyse kit
   * `{ dcApiOrigin }` verir (yalnız tarayıcı destekliyorsa) ve sitenin sunucusu onu `dc_api_origin` olarak iletir. Yanıt şifrelidir (doğrulayıcıya), sayfa içeriği göremez.
   */
  dcApi?: boolean;
}

export type WidgetLang = "en" | "tr" | "tk";

/** Kullanıcıya görünen metinler (dil başına). Doğrulayıcının `failed_reason` metni teknik İngilizce kalır. */
export const MESSAGES: Record<WidgetLang, Record<string, string>> = {
  en: {
    accepted: "Verified.",
    indeterminate:
      "Could not be verified right now (your credential is not invalid) — please try again in a few minutes.",
    rejected: "Credential not accepted",
    preparing: "Preparing…",
    refused: "The verifier refused the request",
    unexpected: "Unexpected verifier response (request link).",
    open: "Open in Tamga Wallet",
    approveMobile: "Approve the requested fields in your wallet, then come back to this page.",
    approveQr: "Scan the QR code with Tamga Wallet on your phone and approve the requested fields.",
    onlyApproved: "Only the fields you approve are shared with this site. The request expires at",
    dcApi: "Share from this device",
  },
  tr: {
    accepted: "Doğrulandı.",
    indeterminate: "Şu an doğrulanamadı (belgeniz geçersiz değil) — birkaç dakika sonra tekrar deneyin.",
    rejected: "Belge kabul edilmedi",
    preparing: "Hazırlanıyor…",
    refused: "Doğrulayıcı isteği reddetti",
    unexpected: "Doğrulayıcı yanıtı beklenmedik (istek bağlantısı).",
    open: "Tamga Wallet'ta aç",
    approveMobile: "Cüzdanda alanları onaylayın, sonra bu sayfaya dönün.",
    approveQr: "Telefonunuzdaki Tamga Wallet ile QR'ı okutun ve alanları onaylayın.",
    onlyApproved: "Yalnızca onayladığınız alanlar bu siteye iletilir. İsteğin geçerlilik sonu:",
    dcApi: "Bu cihazdan paylaş",
  },
  tk: {
    accepted: "Tassyklandy.",
    indeterminate: "Häzir tassyklap bolmady (resminamaňyz nädogry däl) — birnäçe minutdan gaýtadan synanyşyň.",
    rejected: "Resminama kabul edilmedi",
    preparing: "Taýýarlanýar…",
    refused: "Tassyklaýjy haýyşy ret etdi",
    unexpected: "Tassyklaýjydan garaşylmadyk jogap (haýyş baglanyşygy).",
    open: "Tamga Wallet-de aç",
    approveMobile: "Gapjykda meýdançalary tassyklaň, soňra bu sahypa gaýdyp geliň.",
    approveQr: "Telefonyňyzdaky Tamga Wallet bilen QR-y okadyň we meýdançalary tassyklaň.",
    onlyApproved: "Diňe tassyklan meýdançalaryňyz bu saýta iberilýär. Haýyşyň möhleti:",
    dcApi: "Bu enjamdan paýlaş",
  },
};

/** `lang` seçeneği → desteklenen dil (ör. "tr-TR" → "tr"); bilinmeyen → "en". */
export function resolveLang(lang?: string): WidgetLang {
  const l = (lang ?? (typeof document !== "undefined" ? document.documentElement.lang : "") ?? "")
    .toLowerCase()
    .slice(0, 2);
  return l === "tr" || l === "tk" ? l : "en";
}

export interface StartedPresentation {
  presentation_id: string;
  request_uri: string;
  qr_payload: string;
  expires_at: string;
  /** Yalnızca durum okuyabilen jeton (ADR-0017 K4). */
  status_token?: string;
  /** `dc_api_origin` ile başlatıldıysa: `navigator.credentials.get` girdisi (OpenID4VP 1.0 Ek A, imzalı). */
  dc_api_request?: { protocol: string; data: { request: string } };
}

export interface PresentationStatus {
  state: string;
  outcome?: "ACCEPTED" | "REJECTED" | "INDETERMINATE";
  failed_reason?: string | null;
  [k: string]: unknown;
}

/**
 * Kullanıcıya gösterilecek sonuç metni. AP2 / S14: "geçersiz" (REJECTED) ile "şu an doğrulanamadı" (INDETERMINATE — altyapı,
 * tazelik, bağlantı) AYNI gösterilmez; ikincisi belgenin kötü olduğu anlamına gelmez, tekrar denenebilir.
 */
export function outcomeMessage(
  s: Pick<PresentationStatus, "outcome" | "failed_reason">,
  lang: WidgetLang = "en",
): string {
  const m = MESSAGES[lang];
  if (s.outcome === "ACCEPTED") return m.accepted;
  if (s.outcome === "INDETERMINATE") return m.indeterminate;
  return m.rejected + (s.failed_reason ? ": " + s.failed_reason : ".");
}

/** Tarayıcı Digital Credentials API'si var mı (Chrome/Edge 141+, Safari 26+; özellik algılama). */
export const digitalCredentialsSupported = (): boolean =>
  typeof window !== "undefined" && "DigitalCredential" in window && !!navigator.credentials;

/**
 * DC API ile sunum: tarayıcı/işletim sistemi cüzdanı açar, kişi onaylar, şifreli yanıt doğrulayıcıya iletilir (basit form POST;
 * yanıt okunmaz — sonuç durum yoklamasıyla gelir). Kullanıcı hareketi (tıklama) içinde çağrılmalı.
 */
export async function presentViaDigitalCredentials(
  verifier: string,
  request: NonNullable<StartedPresentation["dc_api_request"]>,
): Promise<void> {
  const cred = (await navigator.credentials.get({
    digital: { requests: [request] },
    mediation: "required",
  } as CredentialRequestOptions)) as (Credential & { data?: unknown }) | null;
  const data = typeof cred?.data === "string" ? (JSON.parse(cred.data) as unknown) : cred?.data;
  const response = (data as { response?: unknown } | undefined)?.response;
  if (typeof response !== "string") throw new Error(MESSAGES.en.unexpected);
  await fetch(verifier + "/vp/response", {
    method: "POST",
    mode: "no-cors",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "response=" + encodeURIComponent(response),
  });
}

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function h(
  tag: string,
  attrs: Record<string, string | ((e: Event) => void)> = {},
  children: Array<Node | string> = [],
) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const c of children) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return el;
}

/** İmzalı OpenID4VP isteğini doğrulayıcıdan alır (kişisel veri yok; yalnızca istek bağlantısı). */
export async function start(opts: Pick<MountOptions, "verifier" | "policy" | "dcApi">): Promise<StartedPresentation> {
  const dc = opts.dcApi && digitalCredentialsSupported();
  const r = await fetch(opts.verifier + "/presentations", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ policy_id: opts.policy, ...(dc ? { dc_api_origin: location.origin } : {}) }),
  });
  if (!r.ok) throw new Error(MESSAGES.en.refused + " (" + r.status + ")");
  return (await r.json()) as StartedPresentation;
}

/** Düğme/QR'ı `el` içine çizer ve sonucu yoklar. Telefonda aynı cihaz (`openid4vp://`), bilgisayarda QR (cihazlar arası). */
export function mount(el: HTMLElement, opts: MountOptions): { stop: () => void } {
  el.innerHTML = "";
  const lang = resolveLang(opts.lang);
  const m = MESSAGES[lang];
  const status = h("p", { class: "tamga-status", style: "font-size:14px;color:#6B615B;margin:8px 0" }, [m.preparing]);
  const box = h("div", { style: "display:flex;flex-direction:column;align-items:center;gap:10px" }, [status]);
  el.appendChild(box);
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  const stop = () => {
    stopped = true;
    if (timer) clearInterval(timer);
  };

  const dcApiOrigin = opts.dcApi && digitalCredentialsSupported() ? location.origin : undefined;
  (opts.start ? opts.start(dcApiOrigin ? { dcApiOrigin } : {}) : start(opts))
    .then((p) => {
      if (stopped) return;
      // Bağlantı yalnızca cüzdan şeması olabilir (sunucu yanıtı bozulsa bile sayfada javascript:/http bağlantısı çizilmez)
      if (!/^openid4vp:\/\//i.test(p.qr_payload)) throw new Error(m.unexpected);
      const pid = encodeURIComponent(p.presentation_id);
      const dcReq = p.dc_api_request;
      // DC API isteği yalnız tarayıcı yolunda geçerli (response_uri yok); tarayıcı cihazlar arası QR'ı kendisi gösterir
      const viaDc = !!(opts.dcApi && dcReq && digitalCredentialsSupported());
      if (viaDc && dcReq) {
        box.appendChild(
          h(
            "button",
            {
              type: "button",
              class: "tamga-dcapi",
              style:
                "background:#B01E22;color:#fff;padding:12px 18px;border:0;border-radius:8px;font-weight:700;cursor:pointer",
              onclick: () => {
                presentViaDigitalCredentials(opts.verifier, dcReq).catch(() => {
                  /* kişi vazgeçti ya da cüzdan yok: QR yolu açık kalır */
                });
              },
            },
            [m.dcApi],
          ),
        );
      }
      if (viaDc) status.textContent = m.approveMobile;
      else if (isMobile()) {
        box.appendChild(
          h(
            "a",
            {
              href: p.qr_payload,
              class: "tamga-open",
              style:
                "display:inline-block;background:#B01E22;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700",
            },
            [m.open],
          ),
        );
        status.textContent = m.approveMobile;
      } else {
        box.appendChild(
          h("img", {
            src: opts.verifier + "/presentations/" + pid + "/qr.png",
            width: "220",
            height: "220",
            alt: "Tamga Wallet QR",
            style: "border-radius:12px;background:#fff;padding:6px",
          }),
        );
        status.textContent = m.approveQr;
      }
      box.appendChild(
        h("p", { style: "font-size:12px;color:#6B615B;margin:0" }, [
          m.onlyApproved + " " + new Date(p.expires_at).toLocaleTimeString(lang === "en" ? "en-GB" : lang) + ".",
        ]),
      );
      timer = setInterval(async () => {
        try {
          const s = (await (
            await fetch(
              opts.verifier +
                "/presentations/" +
                pid +
                (p.status_token ? "?st=" + encodeURIComponent(p.status_token) : ""),
            )
          ).json()) as PresentationStatus;
          if (s.state === "PENDING") return;
          stop();
          if (s.outcome === "ACCEPTED") {
            status.textContent = m.accepted;
            opts.onResult?.(p.presentation_id, s);
          } else {
            status.textContent = outcomeMessage(s, lang);
            opts.onError?.(s);
          }
        } catch {
          /* ağ hatası: yoklamaya devam */
        }
      }, opts.pollMs ?? 1500);
    })
    .catch((e: Error) => {
      status.textContent = e.message;
      opts.onError?.(e);
    });
  return { stop };
}

// ---- passkey (WebAuthn). Seçenekler/yanıtlar sitenin sunucusuyla W3C JSON biçiminde gider gelir
// (sunucu tarafı: ör. @simplewebauthn/server). Kayıttan sonra günlük giriş yalnızca passkey: belge sunumu yok, alan yok.

/** Tarayıcı base64url (btoa/atob) — `/web` bağımlılıksız kalsın diye burada (Node: core b64.ts, RN: wallet-core b64.ts; iç inceleme S6). */
const b64u = {
  enc(buf: ArrayBuffer): string {
    const b = new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  dec(str: string): ArrayBuffer {
    const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4));
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b.buffer;
  },
};

interface CredDescriptorJSON {
  id: string;
  type: "public-key";
  transports?: AuthenticatorTransport[];
}
export interface RegistrationOptionsJSON {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  excludeCredentials?: CredDescriptorJSON[];
  [k: string]: unknown;
}
export interface AuthenticationOptionsJSON {
  challenge: string;
  rpId?: string;
  allowCredentials?: CredDescriptorJSON[];
  [k: string]: unknown;
}

const descriptors = (l?: CredDescriptorJSON[]) => (l ?? []).map((c) => ({ ...c, id: b64u.dec(c.id) }));

export const passkey = {
  /** Tarayıcı passkey destekliyor mu (güvenli bağlam: localhost ya da HTTPS alan adı; IP adresinde çalışmaz). */
  supported: (): boolean => typeof window.PublicKeyCredential === "function" && window.isSecureContext,

  /** Kayıt: sunucunun kayıt seçenekleri → `navigator.credentials.create` → sunucuya gönderilecek yanıt. */
  async create(o: RegistrationOptionsJSON) {
    const cred = (await navigator.credentials.create({
      publicKey: {
        ...(o as unknown as PublicKeyCredentialCreationOptions),
        challenge: b64u.dec(o.challenge),
        user: { ...o.user, id: b64u.dec(o.user.id) },
        excludeCredentials: descriptors(o.excludeCredentials),
      },
    })) as PublicKeyCredential;
    const r = cred.response as AuthenticatorAttestationResponse;
    return {
      id: cred.id,
      rawId: b64u.enc(cred.rawId),
      type: cred.type,
      clientExtensionResults: cred.getClientExtensionResults(),
      authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
      response: {
        clientDataJSON: b64u.enc(r.clientDataJSON),
        attestationObject: b64u.enc(r.attestationObject),
        transports: r.getTransports ? r.getTransports() : [],
      },
    };
  },

  /** Giriş: sunucunun giriş seçenekleri → `navigator.credentials.get` → sunucuya gönderilecek yanıt. */
  async get(o: AuthenticationOptionsJSON) {
    const cred = (await navigator.credentials.get({
      publicKey: {
        ...(o as unknown as PublicKeyCredentialRequestOptions),
        challenge: b64u.dec(o.challenge),
        allowCredentials: descriptors(o.allowCredentials),
      },
    })) as PublicKeyCredential;
    const r = cred.response as AuthenticatorAssertionResponse;
    return {
      id: cred.id,
      rawId: b64u.enc(cred.rawId),
      type: cred.type,
      clientExtensionResults: cred.getClientExtensionResults(),
      authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
      response: {
        clientDataJSON: b64u.enc(r.clientDataJSON),
        authenticatorData: b64u.enc(r.authenticatorData),
        signature: b64u.enc(r.signature),
        userHandle: r.userHandle ? b64u.enc(r.userHandle) : undefined,
      },
    };
  },
};
