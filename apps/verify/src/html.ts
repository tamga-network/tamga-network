/**
 * HTML görünümleri. Mantık yok: yalnızca kaçışlama ve şablonlar. Görünüm tamga.network ile aynı (brand.ts); kullanıcıya
 * görünen sayfalar tarayıcının diline göre İngilizce ya da Türkçe, operatör sayfası (politika listesi) İngilizce.
 */
import type { RelyingParty } from "@tamga-network/trust";
import type { Policy, Step, VerificationResult } from "@tamga-network/verifier";
import type { Presentation } from "./state.js";
import { brandPage, type Lang } from "./brand.js";
import { isDrivingPolicy } from "./policies.js";

export { langOf, type Lang } from "./brand.js";

export const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/**
 * <script> içine gömülecek değer: JSON + `<` ve U+2028/2029 kaçışı. `JSON.stringify` tek başına `</script>` dizisini kaçırmaz;
 * sorgu parametresinden gelen değer betiği kapatıp kod enjekte edebilirdi (yansıyan XSS — iç inceleme K1).
 */
export const jsLit = (v: unknown) =>
  JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

const HOST = "verify.tamga.network";

const T = {
  en: {
    service: "Tamga Verify",
    trace: "What happened in the background",
    notFound: "Presentation not found.",
    expiredTitle: "Link invalid or expired",
    expiredText: "A check link is valid for 5 minutes; ask the person to show it again.",
    waiting: "Waiting for the wallet",
    scan: "Scan the QR code with your wallet and approve the fields.",
    requested: "Requested",
    onlyValid: "a valid credential only",
    nothingElse: "No other field is requested.",
    secondsLeft: "s left",
    valid: "✔ VALID",
    invalid: "✖ INVALID",
    unknown: "? COULD NOT VERIFY",
    presentedAgo: (s: number) => `Presented ${s} s ago`,
    verifier: "verifier",
    knowingly: "the person showed this link knowingly; it is valid for 5 minutes",
    noFields: "No fields were requested: only possession of a valid credential was checked.",
    issuer: "Issuer",
    revocation: "revocation check",
    fullTrace: "full verification trace",
    acceptedText:
      "The credential is valid: the issuer is in the trusted list, the signature and device binding are correct, it is not revoked and the policy is met.",
    rejectedText: (step: string, reason: string) => `The credential is <b>invalid</b> — step ${step}: ${reason}`,
    indetText: (why: string, reason: string) =>
      `<b>Could not be verified</b> (NOT invalid): ${why} — ${reason}. Try again once the infrastructure is reachable.`,
    disclosedValues: "Disclosed values",
    valuesHidden:
      "Values are given only to the site that opened the presentation, from its own server and only once (ADR-0017); this page does not show them.",
    valuesNote: "separate endpoint — not written to the audit log (AP3)",
    type: "Type",
    status: "Status",
    trustSource: "Trust source",
    disclosedFields: "Disclosed fields",
    newCheck: "New verification",
    resultJson: "Result object (JSON)",
    // ADR-0039 K1/DL1: her sürücü belgesi bilgisi doğrulamasında görünür
    notOfficialLicence:
      "Not an official driving licence: this is information the Tamga identity service verified from the person's card (categories and validity). It does not replace the card and is not valid in traffic checks or official procedures.",
    // sample site
    welcome: (n: string) => `Welcome, ${n}`,
    accountNew: "Your account has just been created.",
    loginN: (n: number) => `This is your login number ${n}.`,
    onlyApproved: "The site received only the fields you approved; no password, no e-mail.",
    hasPasskeys: (n: number) =>
      `This account has ${n} passkey${n === 1 ? "" : "s"}. Next time you do not need your phone: “Sign in with passkey” → Face ID / fingerprint. The site sees no identity field at that login.`,
    addPasskeyHint:
      '<b>Add a passkey to sign in without your phone.</b> <span class="muted">You add it once; after that the wallet does not open and no field is shared. The passkey belongs to this site only — other sites cannot recognise you with it.</span>',
    addAnother: "Add a passkey on another device",
    addHere: "Add a passkey on this device",
    signOut: "Sign out",
    sampleTitle: "Sample site — SignUp.example",
    sampleText:
      "This page shows how any website can offer sign-up and sign-in with Tamga. The site sees nothing except the fields the user approves in the wallet.",
    signUp: "Sign up with Tamga",
    reviewSignUp: "App reviewers: sign up with the DEMO credential",
    passkeyLogin: "Sign in with passkey",
    signIn: "Sign in with Tamga",
    sampleNote:
      "Sign-up: given name, family name and your pseudonym for this site (another site gets a different one) · Passkey sign-in: no fields · Sign-in with Tamga (no passkey / new device): only your pseudonym",
    howToAdd: "How to add it to a site",
    howToAddNote:
      "The site's server uses the <code>presentation_id</code> to get the result and approved fields from the verifier and binds the session to its own cookie. When the browser Digital Credentials API is widespread, the same kit uses <code>navigator.credentials.get</code> instead of a QR code.",
    pkUnsupported: "Passkeys do not work on this address: open the page on localhost or an HTTPS domain.",
    pkNotAdded: "Passkey not added: ",
    pkNoLogin: "Passkey sign-in failed: ",
    openFailed: "could not open the presentation",
    sessionFailed: "could not start the session",
    // terminal
    terminal: "Turnstile / terminal",
    terminalText:
      "Hold the QR code from the wallet's Show screen to the camera or paste the token. The terminal does not identify the person: it checks only the signature, the time (≤ 60 s) and the replay list (AP13), shared by all gates through this service.",
    camNote:
      "The camera opens only in a secure context (localhost or HTTPS). Fallback: use “Share token” in the wallet and paste the text below.",
    openCam: "Open camera",
    check: "Verify",
    waitingShort: "Waiting",
    pass: "PASS",
    stop: "STOP",
    left: "s left",
    camOn: "Camera on: hold the QR code in the frame.",
    camFailed: "Could not open the camera: ",
    camInsecure: "The camera cannot open on this address: use localhost or HTTPS — or paste the token.",
    qrLib: "QR reader could not load (offline?) — paste the token.",
  },
  tr: {
    service: "Tamga Doğrulama",
    trace: "Arka planda ne oldu",
    notFound: "Sunum bulunamadı.",
    expiredTitle: "Bağlantı geçersiz ya da süresi dolmuş",
    expiredText: "Kontrol bağlantısı 5 dakika geçerlidir; kişiden yeniden göstermesini isteyin.",
    waiting: "Cüzdan bekleniyor",
    scan: "Cüzdanınızla QR'ı okutun ve alanları onaylayın.",
    requested: "İstenen",
    onlyValid: "yalnızca geçerli belge",
    nothingElse: "Başka hiçbir alan istenmez.",
    secondsLeft: "sn kaldı",
    valid: "✔ GEÇERLİ",
    invalid: "✖ GEÇERSİZ",
    unknown: "? DOĞRULANAMADI",
    presentedAgo: (s: number) => `Sunum ${s} sn önce yapıldı`,
    verifier: "doğrulayıcı",
    knowingly: "kişi bu bağlantıyı bilerek gösterdi; bağlantı 5 dk geçerli",
    noFields: "Alan istenmedi: yalnızca geçerli belge sahipliği doğrulandı.",
    issuer: "Veren kurum",
    revocation: "iptal kontrolü",
    fullTrace: "ayrıntılı doğrulama izi",
    acceptedText:
      "Belge geçerli: veren kurum güven listesinde, imza ve cihaz bağlaması doğru, iptal edilmemiş, politika sağlandı.",
    rejectedText: (step: string, reason: string) => `Belge <b>geçersiz</b> — adım ${step}: ${reason}`,
    indetText: (why: string, reason: string) =>
      `<b>Doğrulanamadı</b> (geçersiz DEĞİL): ${why} — ${reason}. Altyapı erişilebilir olunca yeniden deneyin.`,
    disclosedValues: "Açıklanan değerler",
    valuesHidden:
      "Değerler yalnızca sunumu açan siteye, kendi sunucusundan ve bir kez verilir (ADR-0017); bu sayfa onları göstermez.",
    valuesNote: "ayrı uç — denetim kaydına girmez (AP3)",
    type: "Tip",
    status: "Durum",
    trustSource: "Güven kaynağı",
    disclosedFields: "Açıklanan alanlar",
    newCheck: "Yeni doğrulama",
    resultJson: "Sonuç nesnesi (JSON)",
    notOfficialLicence:
      "Resmî sürücü belgesi yerine geçmez: bu, Tamga kimlik servisinin kişinin kartından doğruladığı bilgidir (sınıflar ve geçerlilik). Kartın yerini tutmaz; trafik denetiminde ve resmî işlemlerde geçmez.",
    welcome: (n: string) => `Hoş geldin, ${n}`,
    accountNew: "Hesabın şimdi açıldı.",
    loginN: (n: number) => `Bu ${n}. girişin.`,
    onlyApproved: "Site senden yalnızca onayladığın alanları aldı; şifre yok, e-posta yok.",
    hasPasskeys: (n: number) =>
      `Bu hesapta ${n} passkey var. Sonraki girişlerde telefona gerek yok: “Passkey ile giriş” → Face ID / parmak izi. Site bu girişte hiçbir kimlik alanı görmez.`,
    addPasskeyHint:
      '<b>Telefonsuz giriş için passkey ekle.</b> <span class="muted">Bir kez eklersin; sonra girişte cüzdan açılmaz, hiçbir alan paylaşılmaz. Passkey yalnızca bu siteye özeldir — başka siteler seni onunla tanıyamaz.</span>',
    addAnother: "Başka bir cihaza passkey ekle",
    addHere: "Bu cihaza passkey ekle",
    signOut: "Çıkış yap",
    sampleTitle: "Örnek site — ÜyeOl.example",
    sampleText:
      "Bu sayfa, herhangi bir web sitesinin Tamga ile nasıl kayıt/giriş alacağını gösterir. Site, kullanıcının cüzdanında onayladığı alanlar dışında hiçbir şey görmez.",
    signUp: "Tamga ile Kayıt Ol",
    reviewSignUp: "Uygulama inceleyicileri: DEMO belgeyle kayıt ol",
    passkeyLogin: "Passkey ile giriş",
    signIn: "Tamga ile Giriş Yap",
    sampleNote:
      "Kayıt: ad, soyad ve bu siteye özel takma adın (başka site başka takma ad görür) · Passkey ile giriş: hiçbir alan · Tamga ile giriş (passkey yoksa / yeni cihaz): yalnız takma adın",
    howToAdd: "Siteye nasıl eklenir",
    howToAddNote:
      "Sitenin sunucusu <code>presentation_id</code> ile doğrulayıcıdan sonucu ve onaylanan alanları alır; oturumu kendi çerezine bağlar. Tarayıcı Digital Credentials API'si yaygınlaşınca aynı kit QR yerine <code>navigator.credentials.get</code> kullanır.",
    pkUnsupported: "Passkey bu adreste çalışmaz: sayfayı localhost ya da HTTPS alan adıyla açın.",
    pkNotAdded: "Passkey eklenmedi: ",
    pkNoLogin: "Passkey ile giriş olmadı: ",
    openFailed: "sunum açılamadı",
    sessionFailed: "oturum açılamadı",
    terminal: "Turnike / terminal",
    terminalText:
      "Cüzdanın “Göster” ekranındaki QR'ı kameraya tut ya da jetonu yapıştır. Terminal kişiyi tanımaz: yalnızca imza, süre (≤ 60 sn) ve tekrar listesi denetlenir (AP13); tekrar listesi bu servis üzerinden tüm kapılar arasında ortaktır.",
    camNote:
      "Kamera yalnızca güvenli bağlamda açılır (localhost ya da HTTPS). Yedek: cüzdanda “Jetonu paylaş” ile metni kendine gönder, aşağıya yapıştır.",
    openCam: "Kamerayı aç",
    check: "Doğrula",
    waitingShort: "Bekleniyor",
    pass: "GEÇ",
    stop: "DUR",
    left: "sn kaldı",
    camOn: "Kamera açık: cüzdandaki QR'ı çerçeveye tut.",
    camFailed: "Kamera açılamadı: ",
    camInsecure: "Kamera bu adreste açılamıyor: localhost ya da HTTPS kullanın — ya da jetonu yapıştırın.",
    qrLib: "QR okuyucu yüklenemedi (çevrimdışı?) — jetonu yapıştırın.",
  },
};

export const page = (lang: Lang, title: string, body: string, headExtra = "") =>
  brandPage({ lang, title: `${title} · ${T[lang].service}`, host: HOST, body, headExtra });

export const notFoundPage = (lang: Lang) => page(lang, "404", `<div class="panel"><h2>${T[lang].notFound}</h2></div>`);
export const expiredPage = (lang: Lang) =>
  page(
    lang,
    T[lang].expiredTitle,
    `<div class="result PENDING">${T[lang].expiredTitle}</div><p class="muted">${T[lang].expiredText}</p>`,
  );

const purposeOf = (p: Policy, lang: Lang) => p.purpose[lang === "tr" ? "tr-TR" : "en-US"] ?? p.purpose["en-US"] ?? "";
/** ADR-0039 K1/DL1: sürücü belgesi bilgisi isteyen her politikada, bekleme ve sonuç sayfalarında ibare. */
const drivingNote = (p: Policy, lang: Lang) =>
  isDrivingPolicy(p)
    ? `<p class="sub" role="note" data-not-official style="border:1px solid currentColor;border-radius:8px;padding:10px 12px"><b>${T[lang].notOfficialLicence}</b></p>`
    : "";

const META = new Set(["iss", "vct", "vct#integrity", "iat", "exp", "cnf", "status", "category"]);
const text = (v: unknown, lang: Lang) =>
  typeof v === "object" && v !== null
    ? ((v as Record<string, string>)[lang === "tr" ? "tr-TR" : "en-US"] ??
      (v as Record<string, string>)["en-US"] ??
      JSON.stringify(v))
    : String(v);
const claimRows = (claims: Record<string, unknown> | null | undefined, lang: Lang, bold = false) =>
  claims
    ? Object.entries(claims)
        .filter(([k]) => !META.has(k))
        .map(
          ([k, v]) =>
            `<tr><td class="code">${esc(k)}</td><td>${bold ? "<b>" : ""}${esc(text(v, lang))}${bold ? "</b>" : ""}</td></tr>`,
        )
        .join("")
    : "";

const STEPS: Step[] = [
  "T0",
  "A1",
  "A2",
  "A3",
  "A3b",
  "A3c",
  "A3d",
  "A4",
  "A5",
  "A6",
  "A7",
  "A8",
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
  "B6",
  "C1",
  "C2",
  "C3",
  "C4",
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "E1",
  "E2",
  "E3",
  "E4",
];

export function tracePanel(p: Presentation, lang: Lang = "en") {
  const rows = p.trace
    .map(
      (e) =>
        `<tr><td class="fmt">+${((e.t - p.createdAt) / 1000).toFixed(1)}s</td><td>${esc(e.step)}${e.detail ? `<br><span class="muted small"><code>${esc(e.detail)}</code></span>` : ""}</td></tr>`,
    )
    .join("");
  return `<section><details open><summary>${T[lang].trace}</summary><div class="table-wrap" style="margin-top:12px"><table>${rows}</table></div></details></section>`;
}

/** Operatör görünümü (kök): politikalar, RP kaydı, güven listesi tazeliği. İngilizce. */
export function policiesPage(
  policies: Policy[],
  rp: RelyingParty | null | undefined,
  violations: (p: Policy) => string[],
  trust: { version: number; source: string },
  cachedLists: number,
) {
  const rows = policies
    .map((p) => {
      const viol = violations(p);
      const wanted = p.credentials
        .map(
          (c) =>
            `<span class="tag">${esc(c.vct_values[0])}</span><br>${c.required_claims.map(esc).join(", ") || "<span class=muted>no fields</span>"}`,
        )
        .join("");
      const action = viol.length
        ? `<span class="pill bad">AP6: ${esc(viol.join("; "))}</span>`
        : `<form method="post" action="/presentations"><input type="hidden" name="policy_id" value="${esc(p.policy_id)}"><button class="btn secondary">Create QR</button></form>`;
      return `<tr><td><b class="mono">${esc(p.policy_id)}</b><br><span class="muted small">${esc(purposeOf(p, "en"))}</span></td><td>${wanted}</td><td>${action}</td></tr>`;
    })
    .join("");
  const rpState = rp
    ? `${rp.status === "ACTIVE" ? '<span class="pill">Registered</span>' : `<span class="pill warn">${esc(rp.status)}</span>`}<small>${esc(rp.legal_name)}</small>`
    : `<span class="pill bad">Unregistered</span><small>not in the trusted list</small>`;
  return page(
    "en",
    "Verification policies",
    `<p class="eyebrow">Relying party · OpenID4VP · hosted verifier</p><h1>Tamga Verify</h1>
<p class="lede">The reference verifier: it requests exactly the fields a policy allows, checks the credential against the trusted list and returns one of three results — valid, invalid or could not verify.</p>
<dl class="status" style="margin-top:32px"><div><dt>Relying party</dt><dd>${rpState}</dd></div>
<div><dt>Scopes</dt><dd>${rp ? rp.scopes.length : 0}<small>registered purposes</small></dd></div>
<div><dt>Trusted list</dt><dd>v${trust.version}<small>${esc(trust.source)}</small></dd></div>
<div><dt>Status cache</dt><dd>${cachedLists}<small>lists prefetched</small></dd></div></dl>
<section><h2>Policies</h2><p class="sub">Each policy stays within a scope registered for this verifier in the trusted list (AP6); anything outside is refused before a request is made.</p>
<div class="table-wrap"><table><thead><tr><th>Policy</th><th>Requested</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></section>
<section><h2>For sites</h2><p class="sub">Add “Sign up / Sign in with Tamga” with one script: <a href="/sample-site">sample site</a> · <a href="https://docs.tamga.network">developer docs</a> · <a href="/policies">/policies</a> (JSON).</p></section>`,
  );
}

const DOCS = "https://docs.tamga.network";
const HOME = {
  en: {
    title: "Hosted verifier",
    eyebrow: "Relying party · OpenID4VP · hosted verifier",
    lede: "Tamga Verify checks Tamga credentials for sites, apps and gates without storing them. A registered site opens a presentation request; the person approves only the fields that the site's registered purpose allows; the result is one of three — valid, invalid or could not verify — and the values go once, only to the site that asked.",
    how: "How it works",
    howItems: [
      "Each request stays within a purpose registered for the site in the trusted list; anything beyond it is refused before the request is made.",
      "The credential is checked against the signed trusted list, the issuer's status list and the wallet's key.",
      "Nothing is kept: no credential, no field values, no IP address in the logs.",
    ],
    dev: "For developers",
    links: [
      ["guides/sign-in-with-tamga", "Sign in with Tamga", "add sign-up / sign-in to a website"],
      ["guides/verify-on-server", "Verify on your server", "run the checks yourself with @tamga-network/verifier"],
      ["guides/register-verifier", "Register as a verifier", "get listed with your purposes"],
    ],
    api: "Hosted Verifier API",
    apiNote: "OpenAPI reference",
    tryTitle: "Try it",
    tryText:
      "There are no demos on the live network. Sample institutions, test people and ready-made scenarios (campus, tickets, sign-up) are in the sandbox.",
    tryBtn: "Open the sandbox",
    rp: "Relying party",
    reg: "Registered",
    unreg: "Unregistered",
    notListed: "not in the trusted list",
    scopes: "Scopes",
    scopesNote: "registered purposes",
    list: "Trusted list",
    cache: "Status cache",
    cacheNote: "lists prefetched",
    pathPrefix: "en/",
  },
  tr: {
    title: "Barındırılan doğrulayıcı",
    eyebrow: "Doğrulayıcı · OpenID4VP · barındırılan doğrulayıcı",
    lede: "Tamga Verify, siteler, uygulamalar ve kapılar için Tamga belgelerini saklamadan doğrular. Kayıtlı bir site sunum isteği açar; kişi yalnız sitenin kayıtlı amacının izin verdiği alanları onaylar; sonuç üç değerden biridir — geçerli, geçersiz ya da doğrulanamadı — ve değerler yalnız soran siteye, bir kez gider.",
    how: "Nasıl çalışır",
    howItems: [
      "Her istek, sitenin güven listesindeki kayıtlı amacıyla sınırlıdır; fazlası istek yapılmadan reddedilir.",
      "Belge imzalı güven listesine, kurumun iptal listesine ve cüzdanın anahtarına karşı denetlenir.",
      "Hiçbir şey saklanmaz: belge yok, alan değeri yok, kayıtlarda IP adresi yok.",
    ],
    dev: "Geliştiriciler için",
    links: [
      ["guides/sign-in-with-tamga", "Tamga ile giriş", "web sitesine kayıt / giriş ekleyin"],
      ["guides/verify-on-server", "Kendi sunucunuzda doğrulayın", "denetimleri @tamga-network/verifier ile siz yapın"],
      ["guides/register-verifier", "Doğrulayıcı olarak kaydolun", "amaçlarınızla listeye girin"],
    ],
    api: "Hosted Verifier API",
    apiNote: "OpenAPI başvurusu",
    tryTitle: "Deneyin",
    tryText:
      "Gerçek ağda deneme yoktur. Örnek kurumlar, test kişileri ve hazır senaryolar (kampüs, bilet, kayıt) sandbox'tadır.",
    tryBtn: "Sandbox'ı aç",
    rp: "Doğrulayıcı",
    reg: "Kayıtlı",
    unreg: "Kayıtsız",
    notListed: "güven listesinde yok",
    scopes: "Amaçlar",
    scopesNote: "kayıtlı amaç",
    list: "Güven listesi",
    cache: "Durum önbelleği",
    cacheNote: "liste önceden çekildi",
    pathPrefix: "",
  },
} as const;

/**
 * Gerçek ağ ana sayfası (2026-10-04): deneme paneli yok — Tamga Verify'ın ne olduğu, geliştirici bağlantıları ve
 * "denemek için sandbox". Politika listesi API'dedir (/policies); inceleme politikaları vitrin olarak gösterilmez.
 */
export function homePage(
  lang: Lang,
  rp: RelyingParty | null | undefined,
  trust: { version: number; source: string },
  cachedLists: number,
  sandboxHref: string,
) {
  const h = HOME[lang];
  const rpState = rp
    ? `${rp.status === "ACTIVE" ? `<span class="pill">${h.reg}</span>` : `<span class="pill warn">${esc(rp.status)}</span>`}<small>${esc(rp.legal_name)}</small>`
    : `<span class="pill bad">${h.unreg}</span><small>${h.notListed}</small>`;
  const links = h.links
    .map(
      ([path, name, note]) =>
        `<li><a href="${DOCS}/${h.pathPrefix}${path}">${esc(name)}</a> — <span class="muted">${esc(note)}</span></li>`,
    )
    .join("");
  return page(
    lang,
    h.title,
    `<p class="eyebrow">${h.eyebrow}</p><h1>Tamga Verify</h1>
<p class="lede">${esc(h.lede)}</p>
<dl class="status" style="margin-top:32px"><div><dt>${h.rp}</dt><dd>${rpState}</dd></div>
<div><dt>${h.scopes}</dt><dd>${rp ? rp.scopes.length : 0}<small>${h.scopesNote}</small></dd></div>
<div><dt>${h.list}</dt><dd>v${trust.version}<small>${esc(trust.source)}</small></dd></div>
<div><dt>${h.cache}</dt><dd>${cachedLists}<small>${h.cacheNote}</small></dd></div></dl>
<section><h2>${h.how}</h2><ul>${h.howItems.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>
<section><h2>${h.dev}</h2><ul>${links}<li><a href="${DOCS}/api/">${h.api}</a> — <span class="muted">${h.apiNote}</span> · <a href="/policies">/policies</a> (JSON)</li></ul></section>
<section id="sandbox"><h2>${h.tryTitle}</h2><p class="sub">${esc(h.tryText)}</p><a class="btn" href="${esc(sandboxHref)}">${h.tryBtn}</a></section>`,
  );
}

export function pendingPage(lang: Lang, p: Presentation, id: string, qrDataUrl: string) {
  const t = T[lang];
  const left = Math.max(0, p.req.expiresAt - Math.floor(Date.now() / 1000));
  const wanted =
    p.policy.credentials
      .flatMap((c) => c.required_claims)
      .map(esc)
      .join(", ") || t.onlyValid;
  return page(
    lang,
    t.waiting,
    `<h1>${esc(purposeOf(p.policy, lang))}</h1><p class="lede">${t.scan} ${t.requested}: <b>${wanted}</b>. ${t.nothingElse}</p>${drivingNote(p.policy, lang)}
<section class="row" style="align-items:flex-start;gap:28px"><img class="qr" src="${qrDataUrl}" alt="QR" width="280" height="280">
<div class="stack" style="flex:1;min-width:240px"><div class="result PENDING">${t.waiting}… <span class="mono small">${left} ${t.secondsLeft}</span></div>
<pre>${esc(p.req.qrPayload)}</pre></div></section>${tracePanel(p, lang)}
<script>setInterval(async()=>{const r=await fetch('/presentations/${esc(id)}?st=${esc(p.statusToken)}');if(!r.ok)return;const j=await r.json();if(j.state==='DONE')location.reload();},2000)</script>`,
  );
}

/** ADR-0012 C: kontrol edenin görünümü — büyük sonuç + yalnızca açıklanan alanlar. */
export function checkPage(lang: Lang, p: Presentation, r: VerificationResult, id: string, verifierName: string) {
  const t = T[lang];
  const head = r.outcome === "ACCEPTED" ? t.valid : r.outcome === "REJECTED" ? t.invalid : t.unknown;
  const rows = claimRows(p.claims, lang, true);
  const ago = Math.round((Date.now() - (p.resultAt ?? p.createdAt)) / 1000);
  return page(
    lang,
    head,
    `<div class="result big ${r.outcome}">${head}</div>
<section><h2>${esc(purposeOf(p.policy, lang))}</h2><p class="muted small">${t.presentedAgo(ago)} · ${t.verifier} ${esc(verifierName)} · ${t.knowingly}</p>${drivingNote(p.policy, lang)}
${rows ? `<div class="table-wrap"><table class="kv"><tbody>${rows}</tbody></table></div>` : `<p class="muted">${t.noFields}</p>`}
<p class="muted small" style="margin-top:14px">${t.issuer}: ${esc(r.issuer?.legal_name ?? "—")} · ${t.revocation}: ${esc(r.status.value)} · <a href="/p/${esc(id)}">${t.fullTrace}</a></p></section>`,
  );
}

export function resultPage(lang: Lang, p: Presentation, r: VerificationResult, id: string, showValues = true) {
  const t = T[lang];
  const steps = STEPS.map(
    (s) => `<span class="${r.failed_step === s ? "fail" : r.checks_performed.includes(s) ? "" : "skip"}">${s}</span>`,
  ).join("");
  const explain =
    r.outcome === "ACCEPTED"
      ? t.acceptedText
      : r.outcome === "REJECTED"
        ? t.rejectedText(esc(r.failed_step), esc(r.failed_reason))
        : t.indetText(esc(r.indeterminate_reason), esc(r.failed_reason));
  const claims = !showValues
    ? `<section><h2>${t.disclosedValues}</h2><p class="muted">${t.valuesHidden}</p></section>`
    : p.claims
      ? `<section><h2>${t.disclosedValues}</h2><p class="sub small">/presentations/${esc(id)}/claims — ${t.valuesNote}</p><div class="table-wrap"><table class="kv"><tbody>${claimRows(p.claims, lang)}</tbody></table></div></section>`
      : "";
  const status = `${esc(r.status.value)}${r.status.token_age_sec !== null ? ` · token ${r.status.token_age_sec}s` : ""}${r.status.list_version !== null ? ` · anchor v${r.status.list_version}` : ""}`;
  return page(
    lang,
    r.outcome,
    `<div class="result ${r.outcome}">${r.outcome}</div><p class="lede" style="margin-top:16px">${explain}</p>${drivingNote(p.policy, lang)}
<section><div class="checks">${steps}</div></section>
<section><div class="table-wrap"><table class="kv"><tbody>
<tr><td>${t.issuer}</td><td>${esc(r.issuer?.legal_name ?? "—")} · ${esc(r.issuer?.assurance ?? "")} ${esc(r.issuer?.class ?? "")}<br><span class="code small">${esc(r.issuer?.issuer_id ?? "")}</span></td></tr>
<tr><td>${t.type}</td><td class="code">${esc(r.schema?.vct ?? "")}</td></tr><tr><td>${t.status}</td><td>${status}</td></tr>
<tr><td>${t.trustSource}</td><td>${esc(r.freshness.trust_source)} v${r.freshness.trust_version} · ${r.freshness.trust_age_sec}s</td></tr>
<tr><td>${t.disclosedFields}</td><td>${r.disclosed_claims.map(esc).join(", ")}</td></tr></tbody></table></div>
<p class="muted small">${esc(r.spec_version)} · ${esc(r.sdk_version)} · ${esc(r.verification_id)}</p><a class="btn" href="/">${t.newCheck}</a></section>
${claims}${tracePanel(p, lang)}<section><details><summary>${t.resultJson}</summary><pre>${esc(JSON.stringify(r, null, 2))}</pre></details></section>`,
  );
}

/** Passkey tarayıcı yardımcıları (kit: TamgaVerifier.passkey) — sayfa içi betik; sunucu uçları /sample-site/passkey/*. */
const passkeyJs = (lang: Lang) => {
  const t = T[lang];
  return `const pkPost=(u,b)=>fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(b||{})}).then(async r=>({ok:r.ok,j:await r.json()}));
const pkMsg=(t)=>{const m=document.getElementById("msg");if(m)m.textContent=t;};
const pkNote=()=>{if(!TamgaVerifier.passkey.supported()){pkMsg(${jsLit(t.pkUnsupported)});return false;}return true;};
async function pkRegister(){if(!pkNote())return;try{const o=await pkPost("/sample-site/passkey/register/options");if(!o.ok)return pkMsg(o.j.reason);const resp=await TamgaVerifier.passkey.create(o.j);const v=await pkPost("/sample-site/passkey/register/verify",resp);if(v.ok)location.reload();else pkMsg(v.j.reason);}catch(e){pkMsg(${jsLit(t.pkNotAdded)}+e.message);}}
async function pkLogin(){if(!pkNote())return;try{const o=await pkPost("/sample-site/passkey/login/options");if(!o.ok)return pkMsg(o.j.reason);const resp=await TamgaVerifier.passkey.get(o.j.options);const v=await pkPost("/sample-site/passkey/login/verify",{flow:o.j.flow,response:resp});if(v.ok)location.reload();else pkMsg(v.j.reason);}catch(e){pkMsg(${jsLit(t.pkNoLogin)}+e.message);}}`;
};

/** D11 v1: "Sign up / Sign in with Tamga" örnek sitesi. Kit: /tamga-verifier.js (herhangi bir siteye eklenir). */
export function demoSitePage(
  lang: Lang,
  verifierBase: string,
  user: { name: string; logins: number; isNew: boolean; passkeys: number } | null,
) {
  const t = T[lang];
  const body = user
    ? `<h1>${esc(t.welcome(user.name))}</h1><p class="lede">${user.isNew ? t.accountNew : t.loginN(user.logins)} ${t.onlyApproved}</p>
<section><div class="panel">${user.passkeys ? `<p class="muted">${esc(t.hasPasskeys(user.passkeys))}</p>` : `<p>${t.addPasskeyHint}</p>`}
<div class="row"><button class="btn" id="addpk" type="button">${user.passkeys ? t.addAnother : t.addHere}</button>
<form method="post" action="/sample-site/logout"><button class="btn secondary">${t.signOut}</button></form></div><p id="msg" class="muted"></p></div></section>
<script src="/tamga-verifier.js"></script>
<script>${passkeyJs(lang)}
document.getElementById("addpk").onclick=pkRegister;</script>`
    : `<p class="eyebrow">Sample relying party</p><h1>${t.sampleTitle}</h1><p class="lede">${t.sampleText}</p>
<section><div class="row"><button class="btn" id="signup" type="button">${t.signUp}</button><button class="btn secondary" id="pklogin" type="button">${t.passkeyLogin}</button><button class="btn secondary" id="login" type="button">${t.signIn}</button></div>
<p class="muted small">${t.sampleNote}</p><p class="small"><button class="link-btn" id="reviewsignup" type="button">${t.reviewSignUp}</button></p><div id="tamga"></div><p id="msg" class="muted"></p></section>
<section><details><summary>${t.howToAdd}</summary><pre>&lt;script src="${esc(verifierBase)}/tamga-verifier.js"&gt;&lt;/script&gt;
&lt;div id="tamga"&gt;&lt;/div&gt;
&lt;script&gt;
TamgaVerifier.mount(document.getElementById("tamga"), {
  verifier: "${esc(verifierBase)}",
  policy: "site-signup",           // or "site-signin"
  onResult: (presentationId) =&gt; fetch("/session", { method: "POST", body: presentationId }),
});
&lt;/script&gt;</pre><p class="muted small">${t.howToAddNote}</p></details></section>
<script src="/tamga-verifier.js"></script>
<script>
const go=(policy)=>{document.getElementById("msg").textContent="";TamgaVerifier.mount(document.getElementById("tamga"),{verifier:${jsLit(verifierBase)},policy,lang:${jsLit(lang)},start:()=>fetch("/sample-site/start",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({policy})}).then((r)=>{if(!r.ok)throw new Error(${jsLit(t.openFailed)}+" ("+r.status+")");return r.json();}),onResult:async(id)=>{const r=await fetch("/sample-site/session",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({presentation_id:id})});const j=await r.json();if(j.ok)location.reload();else document.getElementById("msg").textContent=j.reason||${jsLit(t.sessionFailed)};}});};
document.getElementById("signup").onclick=()=>go("site-signup");document.getElementById("login").onclick=()=>go("site-signin");document.getElementById("reviewsignup").onclick=()=>go("review-site-signup");
${passkeyJs(lang)}
document.getElementById("pklogin").onclick=pkLogin;
</script>`;
  return page(lang, user ? t.welcome(user.name) : t.sampleTitle, body);
}

/** ADR-0012 B: turnike/terminal sayfası (kamera: BarcodeDetector; yoksa jsQR; yoksa yapıştır). */
/**
 * ADR-0033: mağaza inceleyicisinin doğrudan bağlantısı (/app-review) — yalnız inceleme politikaları; ana sayfadan bağlanmaz,
 * arama motorlarına kapalı (noindex). Düğme sunum isteğini açar ve bekleme sayfasına (QR) gider.
 */
export function appReviewPage(lang: Lang, policies: Policy[]) {
  const tr = lang === "tr";
  const rows = policies
    .map(
      (p) =>
        `<tr><td><b>${esc(purposeOf(p, lang))}</b><br><span class="mono small muted">${esc(p.policy_id)}</span></td><td><form method="post" action="/presentations"><input type="hidden" name="policy_id" value="${esc(p.policy_id)}"><button class="btn secondary">${tr ? "QR oluştur" : "Create QR"}</button></form></td></tr>`,
    )
    .join("");
  return page(
    lang,
    tr ? "Uygulama incelemesi" : "App review",
    `<h1>${tr ? "Uygulama incelemesi" : "App review"}</h1>
<p class="lede">${tr ? "Yalnız mağaza incelemesi içindir: inceleme kodu ile alınan DEMO kimlik belgesini kabul eder; gerçek doğrulamalarda kullanılmaz." : "For app store review only: accepts the DEMO identity credential obtained with the review code; not used for real checks."}</p>
<div class="table-wrap"><table><tbody>${rows}</tbody></table></div>`,
    '<meta name="robots" content="noindex, nofollow">',
  );
}

/** Kapı politikası olmayan ağda /terminal: nötr bilgi (kapı denemesi sandbox'ta). */
export const noTerminalPage = (lang: Lang) =>
  page(
    lang,
    lang === "tr" ? "Kapı doğrulaması" : "Gate check",
    lang === "tr"
      ? `<div class="panel"><h2>Bu ağda kapı doğrulaması yok.</h2><p class="muted">Turnike ve bilet kapısı senaryoları sandbox'ta denenir.</p></div>`
      : `<div class="panel"><h2>No gate checks on this network.</h2><p class="muted">Turnstile and ticket gate scenarios can be tried in the sandbox.</p></div>`,
  );

export function terminalPage(lang: Lang, group: string) {
  const t = T[lang];
  return page(
    lang,
    t.terminal,
    `<p class="eyebrow">${esc(group)}</p><h1>${t.terminal}</h1><p class="lede">${t.terminalText}</p>
<section class="stack"><p class="muted small" id="camnote">${t.camNote}</p>
<video id="v" playsinline style="width:100%;max-width:420px;border-radius:10px;background:#000;display:none"></video>
<div class="row"><button class="btn" id="cam" type="button">${t.openCam}</button><button class="btn secondary" id="chk" type="button">${t.check}</button></div>
<textarea id="tok" rows="4" placeholder="tamga-pass+jwt …"></textarea>
<div id="res" class="result PENDING">${t.waitingShort}</div><div id="det" class="muted"></div></section>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js"></script>
<script>
const $=(i)=>document.getElementById(i);let last="";
async function check(tk){const r=await fetch("/terminal/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:tk,terminal_group:${jsLit(group)}})});const j=await r.json();$("res").className="result "+(j.ok?"ACCEPTED":"REJECTED");$("res").textContent=j.ok?${jsLit(t.pass)}:${jsLit(t.stop)};$("det").textContent=j.ok?("pass "+j.passId+" · "+j.expiresIn+" "+${jsLit(t.left)}):(j.reason||"");}
$("chk").onclick=()=>check($("tok").value.trim());
$("cam").onclick=async()=>{if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){$("camnote").textContent=${jsLit(t.camInsecure)};return;}
const v=$("v");v.style.display="block";let s;try{s=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});}catch{try{s=await navigator.mediaDevices.getUserMedia({video:true});}catch(e){$("camnote").textContent=${jsLit(t.camFailed)}+e.message;return;}}
v.srcObject=s;await v.play();let read;
if("BarcodeDetector" in window){const d=new BarcodeDetector({formats:["qr_code"]});read=async()=>{const c=await d.detect(v);return c.length?c[0].rawValue:null;};}
else if(window.jsQR){const cv=document.createElement("canvas");const cx=cv.getContext("2d",{willReadFrequently:true});read=async()=>{if(!v.videoWidth)return null;cv.width=v.videoWidth;cv.height=v.videoHeight;cx.drawImage(v,0,0);const im=cx.getImageData(0,0,cv.width,cv.height);const r=jsQR(im.data,im.width,im.height,{inversionAttempts:"dontInvert"});return r?r.data:null;};}
else{$("camnote").textContent=${jsLit(t.qrLib)};return;}
$("camnote").textContent=${jsLit(t.camOn)};
setInterval(async()=>{try{const tk=await read();if(tk&&tk!==last){last=tk;$("tok").value=tk;check(tk);}}catch{}},400);};
</script>`,
  );
}
