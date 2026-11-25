/**
 * HTML görünümleri. Mantık yok: yalnızca kaçışlama ve şablonlar. Görünüm tamga.network ile aynı (brand.ts); kullanıcıya
 * görünen sayfalar tarayıcının diline göre İngilizce ya da Türkçe, operatör sayfası (politika listesi) İngilizce.
 */
import type { RelyingParty } from "@tamga-network/trust";
import type { Policy, Step, VerificationResult } from "@tamga-network/verifier";
import type { Presentation } from "./state.js";
import { brandPage, pageScript, type Lang } from "./brand.js";
export { pageScript };
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
    lookTitle: "What we checked",
    lookLead: "Five checks, without asking the issuer. Technical step codes in grey.",
    techDetails: "Technical details",
    look: {
      ok: "Checked",
      fail: "Failed",
      indet: "Could not check",
      skip: "Not checked",
      stopped: "Not reached: an earlier check failed",
      partial: "Partly checked",
      partialText: "The checks that ran passed; the rest were not reached.",
      sig: [
        "Signature",
        "Signed with the issuer's key; nothing was changed and it is within its validity dates.",
        "The signature, the content or the validity dates do not check out.",
      ],
      list: [
        "Trust list",
        "The issuer is in the signed trust list and was active when it issued this credential.",
        "The issuer is not in the trust list, or was not active at that time.",
      ],
      auth: [
        "Authorisation",
        "The issuer may issue this credential type; the request stays within what this verifier is registered for.",
        "The issuer is not authorised for this type, or the request breaks the rules.",
      ],
      status: [
        "Status",
        "Not revoked or suspended: checked against the issuer's status list, without contacting the issuer.",
        "The issuer has revoked or suspended this credential.",
      ],
      device: [
        "Device binding",
        "Shown from the phone it was issued to, for this request only.",
        "Could not prove that it came from the phone it was issued to.",
      ],
    } as Record<string, string | string[]>,
    notFound: "Presentation not found.",
    expiredTitle: "Link invalid or expired",
    expiredText: "A check link is valid for 5 minutes; ask the person to show it again.",
    waiting: "Waiting for the wallet",
    statusDone: "This check is complete",
    statusOnlyText: "Details are shown only on the page that started the check.",
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
      "Hold the QR code from the wallet's Show screen to the camera or paste the token. The terminal does not identify the person: it checks only the signature, the time (≤ 60 s) and the replay list (AP13), shared by all gates through this service. The gate identifies itself with a terminal key issued by the operator for this terminal group; without it nothing is checked or consumed.",
    keyLabel: "Terminal key (from the operator; kept only in this browser tab)",
    keyNeeded: "Terminal key missing or not valid for this group",
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
    lookTitle: "Nereye baktık",
    lookLead: "Beş denetim, kuruma sormadan. Gri kodlar teknik adımlar.",
    techDetails: "Teknik ayrıntılar",
    look: {
      ok: "Denetlendi",
      fail: "Geçmedi",
      indet: "Denetlenemedi",
      skip: "Bakılmadı",
      stopped: "Sıra gelmedi: önceki bir denetim geçmedi",
      partial: "Kısmen denetlendi",
      partialText: "Yapılan denetimler geçti; kalanlara sıra gelmedi.",
      sig: [
        "İmza",
        "Kurumun anahtarıyla imzalı; içeriği değiştirilmemiş, geçerlilik tarihleri içinde.",
        "İmza, içerik ya da geçerlilik tarihleri tutmuyor.",
      ],
      list: [
        "Güven listesi",
        "Kurum imzalı güven listesinde; belgeyi verdiğinde etkindi.",
        "Kurum listede yok ya da o tarihte etkin değildi.",
      ],
      auth: [
        "Yetki",
        "Kurum bu belge türünü vermeye yetkili; istek doğrulayıcının kayıtlı kapsamı içinde.",
        "Kurum bu tür için yetkili değil ya da istek kurallara uymuyor.",
      ],
      status: [
        "Durum",
        "İptal ya da askıda değil: kurumun iptal listesinden, kuruma sormadan bakıldı.",
        "Kurum belgeyi iptal etmiş ya da askıya almış.",
      ],
      device: [
        "Cihaz bağı",
        "Belgenin verildiği telefondan, yalnız bu istek için gösterildi.",
        "Belgenin verildiği telefondan geldiği kanıtlanamadı.",
      ],
    } as Record<string, string | string[]>,
    notFound: "Sunum bulunamadı.",
    expiredTitle: "Bağlantı geçersiz ya da süresi dolmuş",
    expiredText: "Kontrol bağlantısı 5 dakika geçerlidir; kişiden yeniden göstermesini isteyin.",
    waiting: "Cüzdan bekleniyor",
    statusDone: "Bu kontrol tamamlandı",
    statusOnlyText: "Ayrıntılar yalnızca kontrolü başlatan sayfada görünür.",
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
      "Cüzdanın “Göster” ekranındaki QR'ı kameraya tut ya da jetonu yapıştır. Terminal kişiyi tanımaz: yalnızca imza, süre (≤ 60 sn) ve tekrar listesi denetlenir (AP13); tekrar listesi bu servis üzerinden tüm kapılar arasında ortaktır. Kapı kendini işletmecinin bu terminal grubu için verdiği terminal anahtarıyla tanıtır; anahtarsız hiçbir şey denetlenmez ve tüketilmez.",
    keyLabel: "Terminal anahtarı (işletmeciden; yalnız bu tarayıcı sekmesinde tutulur)",
    keyNeeded: "Terminal anahtarı yok ya da bu grup için geçerli değil",
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
    ? `<p class="sub outlined" role="note" data-not-official><b>${T[lang].notOfficialLicence}</b></p>`
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

/**
 * "Nereye baktık" (CL72): teknik adımları beş sade karta toplar — yalnız görünüm, doğrulama mantığı değişmez. Kart durumu sonuçtaki
 * `failed_step` / `checks_performed` / `indeterminate_reason`'dan türetilir (üç değerli sonuç, CMP9): başarısız adım karttaysa
 * Geçmedi (INDETERMINATE'te Denetlenemedi); hiçbir adımı yapılmadıysa Bakılmadı; yapılanlar geçti ama başarısızlıktan sonra gelen
 * bir adımına sıra gelmediyse Kısmen denetlendi; hepsi yapılıp geçtiyse Denetlendi. Adım sırası A → B → C → D → E (`STEPS`).
 */
const LOOK: { key: "sig" | "list" | "auth" | "status" | "device"; steps: Step[]; codes: string }[] = [
  { key: "sig", steps: ["A1", "A2", "A3", "A3c", "A4", "A5", "A7", "A8", "Z1"], codes: "A1–A5 · A7–A8" },
  { key: "list", steps: ["T0", "A3b", "C1", "C3"], codes: "A3b · C1 · C3" },
  {
    key: "auth",
    steps: ["B1", "B2", "B3", "B4", "B5", "B6", "C2", "C4", "E1", "E2", "E3"],
    codes: "B1–B6 · C2 · C4 · E1–E3",
  },
  { key: "status", steps: ["D1", "D2", "D3", "D4", "D5", "D6"], codes: "D1–D6" },
  { key: "device", steps: ["A3d", "A6", "P1"], codes: "A3d · A6" },
];
const INDET_CARD: Record<string, string> = {
  STATUS_UNREACHABLE: "status",
  STATUS_STALE: "status",
  STATUS_VALUE_UNKNOWN: "status",
  SCHEMA_UNREACHABLE: "auth",
  CHAIN_UNREACHABLE: "list",
  INDEXER_STALE: "list",
};
type LookState = "ok" | "partial" | "fail" | "indet" | "skip";
const ORDER: Step[] = [...STEPS.slice(0, 12), "Z1", "P1", ...STEPS.slice(12)];
export function lookState(r: VerificationResult, card: (typeof LOOK)[number]): LookState {
  const indet = r.outcome === "INDETERMINATE";
  if (r.failed_step && card.steps.includes(r.failed_step)) return indet ? "indet" : "fail";
  if (indet && !r.failed_step && r.indeterminate_reason && INDET_CARD[r.indeterminate_reason] === card.key)
    return "indet";
  const done = (s: Step) => r.checks_performed.includes(s);
  if (!card.steps.some(done)) return "skip";
  if (r.failed_step) {
    const at = ORDER.indexOf(r.failed_step);
    if (card.steps.some((s) => ORDER.indexOf(s) > at && !done(s))) return "partial";
  }
  return "ok";
}
export function lookPanel(r: VerificationResult, lang: Lang = "en") {
  const t = T[lang];
  const mark: Record<LookState, string> = { ok: "✓", partial: "◐", fail: "✗", indet: "?", skip: "–" };
  const cards = LOOK.map((c) => {
    const st = lookState(r, c);
    const [title, okText, failText] = t.look[c.key] as string[];
    const label = st === "skip" && r.failed_step ? (t.look.stopped as string) : (t.look[st] as string);
    const text =
      st === "fail" ? failText : st === "ok" ? okText : st === "partial" ? (t.look.partialText as string) : label;
    return `<li class="lookcard ${st}"><span class="mark"><span aria-hidden="true">${mark[st]}</span> ${esc(st === "skip" ? (t.look.skip as string) : label)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p><span class="code small muted">${esc(c.codes)}</span></li>`;
  }).join("");
  return `<section><h2>${t.lookTitle}</h2><p class="muted small">${t.lookLead}</p><ul class="lookcards">${cards}</ul></section>`;
}

const traceRows = (p: Presentation) =>
  p.trace
    .map(
      (e) =>
        `<tr><td class="fmt">+${((e.t - p.createdAt) / 1000).toFixed(1)}s</td><td>${esc(e.step)}${e.detail ? `<br><span class="muted small"><code>${esc(e.detail)}</code></span>` : ""}</td></tr>`,
    )
    .join("");

export function tracePanel(p: Presentation, lang: Lang = "en") {
  const rows = traceRows(p);
  return `<section><details open><summary>${T[lang].trace}</summary><div class="table-wrap mt-12"><table>${rows}</table></div></details></section>`;
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
<dl class="status mt-32"><div><dt>Relying party</dt><dd>${rpState}</dd></div>
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
<dl class="status mt-32"><div><dt>${h.rp}</dt><dd>${rpState}</dd></div>
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
<section class="row items-start gap-28"><img class="qr" src="${qrDataUrl}" alt="QR" width="280" height="280">
<div class="stack grow-240"><div class="result PENDING">${t.waiting}… <span class="mono small">${left} ${t.secondsLeft}</span></div>
<pre>${esc(p.req.qrPayload)}</pre></div></section>${tracePanel(p, lang)}
${pageScript("pending", { poll: `/presentations/${encodeURIComponent(id)}?st=${encodeURIComponent(p.statusToken)}` })}`,
  );
}

/**
 * ADR-0017 HV1/HV2 (sıkı kip): sunum kimliğini bilen ama durum jetonu (`?st=`) ya da sahip beyanı olmayan biri yalnızca nötr
 * durumu görür — sonuç, kurum, alanlar, iz ve durum jetonu yok.
 */
export function statusOnlyPage(lang: Lang, done: boolean) {
  const t = T[lang];
  const head = done ? t.statusDone : t.waiting;
  return page(lang, head, `<div class="result PENDING">${head}</div><p class="muted mt-16">${t.statusOnlyText}</p>`);
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
<p class="muted small mt-14">${t.issuer}: ${esc(r.issuer?.legal_name ?? "—")} · ${t.revocation}: ${esc(r.status.value)} · <a href="/p/${esc(id)}">${t.fullTrace}</a></p></section>`,
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
    `<div class="result ${r.outcome}">${r.outcome}</div><p class="lede mt-16">${explain}</p>${drivingNote(p.policy, lang)}
${lookPanel(r, lang)}
<section><div class="table-wrap"><table class="kv"><tbody>
<tr><td>${t.issuer}</td><td>${esc(r.issuer?.legal_name ?? "—")} · ${esc(r.issuer?.assurance ?? "")} ${esc(r.issuer?.class ?? "")}<br><span class="code small">${esc(r.issuer?.issuer_id ?? "")}</span></td></tr>
<tr><td>${t.type}</td><td class="code">${esc(r.schema?.vct ?? "")}</td></tr><tr><td>${t.status}</td><td>${status}</td></tr>
<tr><td>${t.trustSource}</td><td>${esc(r.freshness.trust_source)} v${r.freshness.trust_version} · ${r.freshness.trust_age_sec}s</td></tr>
<tr><td>${t.disclosedFields}</td><td>${r.disclosed_claims.map(esc).join(", ")}</td></tr></tbody></table></div>
<p class="muted small">${esc(r.spec_version)} · ${esc(r.sdk_version)} · ${esc(r.verification_id)}</p><a class="btn" href="/">${t.newCheck}</a></section>
${claims}<section><details><summary>${t.techDetails}</summary><div class="checks mt-12">${steps}</div>
<h3 class="mt-16">${t.trace}</h3><div class="table-wrap mt-12"><table>${traceRows(p)}</table></div></details></section><section><details><summary>${t.resultJson}</summary><pre>${esc(JSON.stringify(r, null, 2))}</pre></details></section>`,
  );
}

/** Örnek sitenin betiği (/assets/sample-site.js: site kiti + passkey) — adres, dil ve iletiler data-* özniteliklerinde. */
const sampleSiteScript = (lang: Lang, verifierBase: string) => {
  const t = T[lang];
  return `<script src="/tamga-verifier.js"></script>
${pageScript("sample-site", {
  verifier: verifierBase,
  lang,
  msg: JSON.stringify({
    pkUnsupported: t.pkUnsupported,
    pkNotAdded: t.pkNotAdded,
    pkNoLogin: t.pkNoLogin,
    openFailed: t.openFailed,
    sessionFailed: t.sessionFailed,
  }),
})}`;
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
${sampleSiteScript(lang, verifierBase)}`
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
${sampleSiteScript(lang, verifierBase)}`;
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
<video id="v" class="cam" playsinline hidden></video>
<label class="muted small" for="key">${t.keyLabel}</label>
<input id="key" type="password" autocomplete="off" placeholder="tk_…">
<div class="row"><button class="btn" id="cam" type="button">${t.openCam}</button><button class="btn secondary" id="chk" type="button">${t.check}</button></div>
<textarea id="tok" rows="4" placeholder="tamga-pass+jwt …"></textarea>
<div id="res" class="result PENDING">${t.waitingShort}</div><div id="det" class="muted"></div></section>
<script src="/assets/vendor/jsQR.js"></script>
${pageScript("terminal", {
  group,
  msg: JSON.stringify({
    pass: t.pass,
    stop: t.stop,
    left: t.left,
    keyNeeded: t.keyNeeded,
    camInsecure: t.camInsecure,
    camFailed: t.camFailed,
    qrLib: t.qrLib,
    camOn: t.camOn,
  }),
})}`,
  );
}
