/**
 * Uzaktan kapatma — kapatma kodu (Tamga Wallet WA-ADR-0002 K1/K2/K6; RL1–RL3).
 *  - Sağlayıcı kodun kendisini hiç görmez: cüzdan ön özeti gönderir (SHA-256, wallet-core `lockCodePrehash`); burada bunun
 *    YAVAŞ özeti (scrypt N=2^15, r=8, p=1 — Node yerel crypto) birime bağlanır. Tuz sabit alan ayırıcıdır: özet, kodu bulmak
 *    için dizin anahtarıdır; kod ≈ 98 bit (30^20) olduğu için tahmin ve önceden hesaplanmış tablo pratik değildir — güvenlik
 *    deneme sayısına değil kodun uzunluğuna dayanır.
 *  - Kod girişi (sayfa ve JSON): her denemede aynı yavaş özet (biçim hatalı olsa da) + en az sabit yanıt süresi (zamanlama);
 *    bulunamayan kod ile biçim hatası aynı yanıt. Genel günlük/dakikalık sayaç YOK (tek kaynak herkesin sayfasını kapatabilirdi —
 *    DoS); yerine eşzamanlı scrypt üst sınırı (işlemci koruması; fazlası 503 + Retry-After). IP başına sınır nginx'te (IP yalnız
 *    nginx belleğinde). Kod, ön özet, IP günlüğe yazılmaz (RL2).
 *  - `/lost` sayfası: TR/EN, Tamga Wallet W2 markası, dış betik yok, `no-store`, çerçeve içinde açılmaz.
 */
import { scrypt, timingSafeEqual } from "node:crypto";
import { WP_PATHS, isLockCode, lockCodePrehash, normalizeLockCode } from "@tamga-network/wallet-core";

export const LOST_PATH = WP_PATHS.lost;
/** Yalnız kodla iptal — teknik uç birim iptaliyle aynı (`revocation_code` alanı); sayfa buraya gönderir. */
export const REVOKE_PATH = WP_PATHS.revoke;

export const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keyLen: 32, maxmem: 64 * 1024 * 1024 } as const;
const SALT = Buffer.from("tamga-wallet/lock-code/v1/scrypt", "utf8");

/** Ön özet → yavaş özet (hex). Ön özet biçimi bozuk olsa da hesaplanır (zamanlama eşitliği). */
export function slowHash(prehash: string): Promise<string> {
  return new Promise((res, rej) =>
    scrypt(Buffer.from(String(prehash), "utf8"), SALT, SCRYPT.keyLen, SCRYPT, (e, k) =>
      e ? rej(e) : res(k.toString("hex")),
    ),
  );
}
/** Sabit zamanlı eşitlik (eşit uzunluk; değilse false). */
export const hashEqual = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));

/** Eşzamanlı yavaş özet üst sınırı (işlemci koruması); sayaç yok, IP yok — yalnız o an süren iş sayısı. */
export class ConcurrencyGate {
  private running = 0;
  constructor(private max: number) {}
  /** Yer varsa alır (`true`); çağıran bitince `release()`. */
  take(): boolean {
    if (this.running >= this.max) return false;
    this.running++;
    return true;
  }
  release() {
    this.running = Math.max(0, this.running - 1);
  }
}
export const LOST_LIMITS = { concurrent: 4, minDelayMs: 400, retryAfterSec: 2 } as const;

/** Kod girişi sonucu (sayfa ve JSON aynı kümeyi kullanır). */
export type LostOutcome = "revoked" | "unknown" | "already_revoked" | "busy";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Girilen kodu normalize eder ve ön özetini üretir; biçim bozuksa da özet döner (`valid: false`). */
export function prehashOfInput(input: unknown): { valid: boolean; prehash: string } {
  const code = typeof input === "string" ? normalizeLockCode(input.slice(0, 64)) : "";
  return { valid: isLockCode(code), prehash: lockCodePrehash(code) };
}

// ------------------------------------------------------------------------------------------------- sayfa (TR/EN)
export type Lang = "tr" | "en";
export function pickLang(query: unknown, acceptLanguage: unknown): Lang {
  const q = (query as Record<string, unknown> | undefined)?.lang;
  if (q === "tr" || q === "en") return q;
  return typeof acceptLanguage === "string" && /^\s*tr\b|,\s*tr\b/i.test(acceptLanguage) ? "tr" : "en";
}

/** Metinler WA-ADR-0002 K4 ile hizalı: cüzdan + Tamga kimlik belgesi iptal; kurum belgeleri süreleri bitene kadar geçerli görünebilir. */
const TEXT: Record<Lang, Record<string, string>> = {
  tr: {
    title: "Telefonumu kaybettim · Tamga Wallet",
    h1: "Telefonunu mu kaybettin?",
    lede: "Cüzdanını uzaktan kapat. Kapanan cüzdan yeni belge alamaz; Tamga kimlik belgen iptal edilir.",
    label: "Kapatma kodu",
    help: "Cüzdanı kurarken bir kez gösterilen 20 karakterlik kod (ör. 7KQ4M-…). Büyük/küçük harf ve tireler önemsizdir.",
    confirm: "Anladım: bu işlem geri alınamaz. Telefon bulunursa cüzdan yeniden kurulur.",
    submit: "Cüzdanı kapat",
    privacy:
      "Bu sayfa ad, telefon ya da e-posta istemez; hangi cüzdanın kapatıldığını göstermez. Kod sunucuda saklanmaz.",
    revokedH: "Cüzdan kapatıldı",
    revokedP:
      "Bu koda bağlı cüzdan kapatıldı: artık hiçbir kurum ona belge vermez ya da yenilemez; Tamga kimlik servisinin verdiği kimlik ve iletişim belgeleri en geç 24 saat içinde iptal edilir. Kurumların verdiği öbür belgeler, süreleri bitene kadar doğrulayıcılara geçerli görünebilir — onlar için kurumun kendi iptal yolunu kullan. Telefon internete bağlanınca belgelerini kendisi siler.",
    revokedNext: "Yeni telefonda Tamga Wallet’ı kur, kimliğini doğrula ve belgelerini kurumlardan yeniden al.",
    unknownH: "Kod tanınmadı",
    unknownP:
      "Kodu kontrol edip yeniden dene. Kodun yoksa bugün için başka bir yol yok; telefonu bulunca cüzdanı sıfırlayabilirsin.",
    alreadyH: "Bu cüzdan zaten kapatılmış",
    alreadyP: "Bu koda bağlı cüzdan daha önce kapatıldı. Yapılacak başka bir şey yok.",
    busyH: "Şu an yoğun",
    busyP: "Birkaç saniye sonra yeniden dene.",
    back: "Başa dön",
    other: "English",
    otherLang: "en",
  },
  en: {
    title: "I lost my phone · Tamga Wallet",
    h1: "Lost your phone?",
    lede: "Close your wallet remotely. A closed wallet gets no new credentials; your Tamga identity credential is revoked.",
    label: "Revocation code",
    help: "The 20-character code shown once when you set up the wallet (e.g. 7KQ4M-…). Case and dashes do not matter.",
    confirm: "I understand: this cannot be undone. If the phone turns up, the wallet is set up again.",
    submit: "Close the wallet",
    privacy:
      "This page asks for no name, phone or e-mail and never shows which wallet was closed. The code is not stored on the server.",
    revokedH: "Wallet closed",
    revokedP:
      "The wallet tied to this code is closed: no institution will issue or renew credentials to it, and the identity and contact credentials issued by the Tamga identity service are revoked within 24 hours. Other credentials issued by institutions may still look valid to verifiers until they expire — use the institution’s own revocation route for those. When the phone next connects to the internet it wipes its credentials.",
    revokedNext:
      "On a new phone install Tamga Wallet, verify your identity and get your credentials again from the institutions.",
    unknownH: "Code not recognised",
    unknownP:
      "Check the code and try again. Without the code there is no other way today; when you find the phone you can reset the wallet.",
    alreadyH: "This wallet is already closed",
    alreadyP: "The wallet tied to this code was closed earlier. Nothing else to do.",
    busyH: "Busy right now",
    busyP: "Try again in a few seconds.",
    back: "Start over",
    other: "Türkçe",
    otherLang: "tr",
  },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
/** Tamga Wallet W2 işareti (marka kiti; cüzdan `src/ui/logo.tsx` ile aynı yollar). Renk Al Kızıl / koyuda on-dark tonu. */
const LOGO = `<svg width="26" height="30" viewBox="240 200 544 640" role="img" aria-label="Tamga Wallet"><g fill="var(--brand)"><path d="M240 200 H784 V288 H240 Z"/><path d="M240 352 H480 V840 L392 752 V440 H240 Z"/><path d="M784 352 H544 V840 L632 752 V440 H784 Z"/><path d="M240 504 H328 V840 L240 752 Z"/><path d="M784 504 H696 V840 L784 752 Z"/></g></svg>`;
/** Tema: cüzdanın theme.ts belirteçleri (açık kâğıt / koyu gece; birincil düğme mürekkep; Al Kızıl yalnız logo). */
const CSS = `:root{--bg:#F8F6F1;--surface:#EFEBE2;--card:#FFFDF9;--line:#E2DCCF;--text:#14120F;--muted:#5E584F;--primary:#14120F;--on-primary:#F8F6F1;--brand:#B01E22;--danger:#C8371A;--danger-bg:#FBE5DF;--danger-text:#9E2A12;--success-bg:#DCEBD9;--success-text:#1F5A2E;--warn-bg:#F6E7C4;--warn-text:#6B4600}
@media (prefers-color-scheme:dark){:root{--bg:#101820;--surface:#16212B;--card:#1C2833;--line:#2C3A47;--text:#F8F6F1;--muted:#A9B3BC;--primary:#F8F6F1;--on-primary:#14120F;--brand:#E0554B;--danger:#FF8A73;--danger-bg:#3A1F1A;--danger-text:#FFB3A3;--success-bg:#1E3326;--success-text:#A9DDB5;--warn-bg:#3A2E12;--warn-text:#F2D08A}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{max-width:440px;margin:0 auto;padding:40px 20px 48px;display:flex;flex-direction:column;gap:18px;min-height:100vh}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px}.brand small{color:var(--muted);font-weight:500}
h1{margin:0;font-size:28px;line-height:1.2;letter-spacing:-.4px}p{margin:0;color:var(--muted);font-size:15px}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:12px}
label{font-size:11px;letter-spacing:1.2px;text-transform:uppercase;font-weight:600;color:var(--muted);font-family:"IBM Plex Mono",ui-monospace,monospace}
input[type=text]{width:100%;min-height:52px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--text);font:600 18px/1.2 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:1px;text-transform:uppercase}
input[type=text]:focus{outline:2px solid var(--text);outline-offset:1px}
.check{display:flex;gap:12px;align-items:flex-start;font-size:14px;color:var(--text)}.check input{width:22px;height:22px;margin:2px 0 0;flex-shrink:0;accent-color:var(--primary)}
button,.btn{display:flex;align-items:center;justify-content:center;min-height:52px;padding:0 18px;border-radius:14px;border:1px solid var(--primary);background:var(--primary);color:var(--on-primary);font:600 15px "IBM Plex Sans",system-ui,sans-serif;cursor:pointer;text-decoration:none}
.btn.secondary{background:transparent;color:var(--text);border-color:var(--line)}
.note{font-size:12px;color:var(--muted)}.grow{flex-grow:1}
.result{display:flex;flex-direction:column;gap:12px}.icon{width:64px;height:64px;border-radius:32px;display:flex;align-items:center;justify-content:center}
.ok .icon{background:var(--success-bg);color:var(--success-text)}.bad .icon{background:var(--danger-bg);color:var(--danger-text)}.warn .icon{background:var(--warn-bg);color:var(--warn-text)}
.lang{margin-left:auto;font-size:13px;color:var(--muted);text-decoration:underline}`;

function shell(lang: Lang, body: string): string {
  const t = TEXT[lang];
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(t.title)}</title><style>${CSS}</style></head><body><main class="wrap">
<div class="brand">${LOGO}<span>Tamga <small>Wallet</small></span><a class="lang" href="${LOST_PATH}?lang=${t.otherLang}" hreflang="${t.otherLang}">${esc(t.other)}</a></div>
${body}
</main></body></html>`;
}

const ICONS = {
  ok: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  bad: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>`,
};

/** Kod giriş formu. */
export function lostFormHtml(lang: Lang): string {
  const t = TEXT[lang];
  return shell(
    lang,
    `<h1>${esc(t.h1)}</h1><p>${esc(t.lede)}</p>
<form class="card" method="post" action="${LOST_PATH}" autocomplete="off">
<input type="hidden" name="lang" value="${lang}">
<label for="code">${esc(t.label)}</label>
<input id="code" name="code" type="text" inputmode="text" autocapitalize="characters" autocorrect="off" spellcheck="false" maxlength="32" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" required aria-describedby="help">
<span id="help" class="note">${esc(t.help)}</span>
<label class="check" style="text-transform:none;letter-spacing:0;font:inherit;font-size:14px"><input type="checkbox" name="confirm" value="1" required><span>${esc(t.confirm)}</span></label>
<button type="submit">${esc(t.submit)}</button>
</form>
<span class="note">${esc(t.privacy)}</span>`,
  );
}

/** Sonuç sayfası; hangi cüzdan olduğu gösterilmez (RL2). */
export function lostResultHtml(lang: Lang, outcome: LostOutcome): string {
  const t = TEXT[lang];
  const map: Record<LostOutcome, { cls: string; icon: string; h: string; p: string; next?: string }> = {
    revoked: { cls: "ok", icon: ICONS.ok, h: t.revokedH, p: t.revokedP, next: t.revokedNext },
    unknown: { cls: "bad", icon: ICONS.bad, h: t.unknownH, p: t.unknownP },
    already_revoked: { cls: "warn", icon: ICONS.ok, h: t.alreadyH, p: t.alreadyP },
    busy: { cls: "warn", icon: ICONS.bad, h: t.busyH, p: t.busyP },
  };
  const m = map[outcome];
  return shell(
    lang,
    `<div class="result ${m.cls}"><span class="icon">${m.icon}</span><h1>${esc(m.h)}</h1><p>${esc(m.p)}</p>${
      m.next ? `<p>${esc(m.next)}</p>` : ""
    }</div><div class="grow"></div><a class="btn secondary" href="${LOST_PATH}?lang=${lang}">${esc(t.back)}</a>`,
  );
}

export const HTTP_STATUS: Record<LostOutcome, number> = { revoked: 200, unknown: 404, already_revoked: 409, busy: 503 };
