/**
 * Doğrulama politikaları (SPEC-API-0001 §3). Her politika RP'nin güven listesindeki kapsamını aşamaz (AP6);
 * `proximity` olan politika kabulde geçiş kartı verir (ADR-0012 B). Kişisel veri istemeyen politikada `required_claims: []`.
 */
import type { Policy } from "@tamga-network/verifier";

const TRUST_EDU: Policy["trust"] = {
  min_issuer_assurance: "I2",
  allowed_categories: ["EDUCATION"],
  require_recognition: true,
  state_code: "TR",
};
const TRUST_ID: Policy["trust"] = {
  min_issuer_assurance: "I2",
  allowed_categories: ["IDENTITY"],
  require_recognition: true,
  state_code: "TR",
};
/**
 * ADR-0033: mağaza incelemesi — DEMO imzacısı (`tamga-id-review`) güven listesinde I1'dir; gerçek politikalar I2 ister ve onu
 * reddeder. Yalnız aşağıdaki "review-" politikaları I1 kabul eder; bunlar inceleyicinin akışı denemesi içindir, gerçek kararda
 * kullanılmaz.
 */
const TRUST_REVIEW: Policy["trust"] = {
  min_issuer_assurance: "I1",
  allowed_categories: ["IDENTITY"],
  require_recognition: true,
  state_code: "TR",
};
/** ADR-0038: kapı grubu adları ortamdan (sandbox kendi örnek kurumlarının gruplarını kullanır); varsayılan gerçek ağ. */
export const CAMPUS_GROUP = process.env.TAMGA_VERIFY_CAMPUS_GROUP ?? "bilgi-campus";
export const TICKET_GROUP = process.env.TAMGA_VERIFY_TICKET_GROUP ?? "bubilet-gate";
const FRESH: Policy["freshness"] = { max_status_token_age_sec: 6 * 3600, max_trust_age_sec: 24 * 3600 };

export const POLICIES: Policy[] = [
  {
    policy_id: "job-application-degree",
    purpose: {
      "en-US": "Proof of graduation for a job application (Careers Office)",
      "tr-TR": "İş başvurusunda mezuniyet teyidi (Kariyer Merkezi)",
    },
    credentials: [
      {
        id: "diploma",
        vct_values: ["urn:tamga:edu:DiplomaCredential:1"],
        required_claims: ["is_graduate", "qualification_title", "eqf_level", "awarding_body_name"],
        constraints: { is_graduate: true, eqf_level: { min: 6 } },
      },
    ],
    trust: TRUST_EDU,
    freshness: FRESH,
  },
  {
    policy_id: "student-discount",
    purpose: {
      "en-US": "Student discount — enrolment status only",
      "tr-TR": "Öğrenci indirimi — yalnızca kayıt durumu",
    },
    credentials: [
      {
        id: "student",
        vct_values: ["urn:tamga:edu:StudentCredential:1"],
        required_claims: ["is_enrolled"],
        constraints: { is_enrolled: true },
      },
    ],
    trust: TRUST_EDU,
    freshness: FRESH,
  },
  {
    policy_id: "campus-access",
    purpose: {
      "en-US": "Campus access — access pass registration (once; then show the QR code at the turnstile)",
      "tr-TR": "Kampüs geçişi — geçiş kartı kaydı (bir kez; sonra turnikede QR göster)",
    },
    credentials: [
      {
        id: "student",
        vct_values: ["urn:tamga:edu:StudentCredential:1"],
        required_claims: ["is_enrolled"],
        constraints: { is_enrolled: true },
      },
    ],
    trust: TRUST_EDU,
    freshness: FRESH,
    proximity: { terminal_group: CAMPUS_GROUP, valid_days: 180 }, // ADR-0012 B; rıza süresi ≤ 6 ay (S-16)
  },
  {
    policy_id: "event-tamga-id",
    purpose: {
      "en-US": "Event entry — 10% off for every Tamga identity holder (valid identity only; no attributes requested)",
      "tr-TR": "Etkinlik girişi — Tamga kimliği olan herkese %10 indirim (yalnızca geçerli kimlik; alan istenmez)",
    },
    credentials: [{ id: "identity", vct_values: ["urn:tamga:id:IdentityAttestation:1"], required_claims: [] }],
    trust: TRUST_ID,
    freshness: FRESH,
  },
  // D10 — etkinlik kapısı: bilet sunumu → tek kullanımlık geçiş kartı (ADR-0012 K4). Alan: yalnızca etkinlik kodu + sınıf.
  {
    policy_id: "event-ticket",
    purpose: {
      "en-US": "Event gate — ticket access pass (present once, show the QR code at the gate; single entry)",
      "tr-TR": "Etkinlik kapısı — bilet geçiş kartı (bir kez sun, kapıda QR göster; tek geçiş)",
    },
    credentials: [
      {
        id: "ticket",
        vct_values: ["urn:tamga:tkt:EventTicket:1"],
        required_claims: ["event_id", "ticket_class"],
      },
    ],
    trust: {
      min_issuer_assurance: "I2",
      allowed_categories: ["EVENTS"], // ADR-0014 / D-CAT-1 — kategori kaba filtre; asıl kapı: vct + şema yetkisi (IC2)
      require_recognition: true,
      state_code: "TR",
    },
    freshness: FRESH,
    // Kartı bilet alınır alınmaz hazırlamak yaygın; etkinlik haftalar sonra olabilir → süre uzun tutulur, tek geçiş zaten sınırlar (K4).
    proximity: { terminal_group: TICKET_GROUP, valid_days: 400, single_use: true },
  },
  // D12 / D-CRED-5 — yaş doğrulaması ISO 18013-5 mdoc ile: yalnızca age_over_18 (evet/hayır); ad, doğum tarihi, TCKN açıklanmaz.
  // mdoc'un klasik kullanımı; Safari/iOS tarayıcı API'sinin kabul ettiği tek format bu (ADR-0013).
  {
    policy_id: "age-over-18-mdoc",
    purpose: {
      "en-US": "Over-18 check (ISO 18013-5 mdoc) — yes/no only",
      "tr-TR": "18 yaş üstü doğrulaması (ISO 18013-5 mdoc) — yalnızca evet/hayır",
    },
    credentials: [
      {
        id: "identity",
        vct_values: ["urn:tamga:id:IdentityAttestation:1"],
        format: "mso_mdoc",
        namespace: "tamga.id.1",
        required_claims: ["age_over_18"],
        constraints: { age_over_18: true },
      },
    ],
    trust: TRUST_ID,
    freshness: FRESH,
  },
  // ADR-0032 — 18 yaş üstü, sıfır bilgi ispatıyla (Longfellow): doğrulayıcı belgeyi, kurum imzasını, cihaz anahtarını ve
  // durum indeksini görmez; yalnız "kayıtlı bir kurumun kimlik belgesinde age_over_18 = true" ispatını. Cüzdan ZK
  // yapamıyorsa (bugün: Aşama 2 telefon modülü gelene kadar) doğrulayıcı `age-over-18-mdoc` ile sorar (ZK5).
  {
    policy_id: "age-over-18-zk",
    purpose: {
      "en-US": "Over-18 check with a zero-knowledge proof — yes/no only, nothing else",
      "tr-TR": "Sıfır bilgi ispatıyla 18 yaş üstü doğrulaması — yalnızca evet/hayır, başka hiçbir şey",
    },
    credentials: [
      {
        id: "identity",
        vct_values: ["urn:tamga:id:IdentityAttestation:1"],
        format: "mso_mdoc_zk",
        namespace: "tamga.id.1",
        required_claims: ["age_over_18"],
        constraints: { age_over_18: true },
      },
    ],
    trust: TRUST_ID,
    freshness: FRESH,
  },
  // D11 — web sitesine "Tamga ile kayıt ol / giriş yap". ADR-0031: hesap anahtarı site başına takma ad (siteler eşleştiremez);
  // kimlik belgesinin özeti ya da kimlik numarası siteye gitmez (PS4).
  {
    policy_id: "site-signup",
    purpose: {
      "en-US": "Website sign-up — given name, family name and your pseudonym for this site",
      "tr-TR": "Web sitesine üyelik — ad, soyad ve bu siteye özel takma adın",
    },
    credentials: [
      {
        id: "identity",
        vct_values: ["urn:tamga:id:IdentityAttestation:1"],
        required_claims: ["given_name", "family_name"],
      },
    ],
    pseudonym: { mode: "single" },
    trust: TRUST_ID,
    freshness: FRESH,
  },
  {
    policy_id: "site-signin",
    purpose: {
      "en-US": "Website sign-in — only your pseudonym for this site",
      "tr-TR": "Web sitesine giriş — yalnız bu siteye özel takma adın",
    },
    credentials: [],
    pseudonym: { mode: "single" },
    trust: TRUST_ID,
    freshness: FRESH,
  },
];

POLICIES.push(
  {
    policy_id: "review-age-over-18",
    purpose: {
      "en-US": "App review (DEMO credential): over-18 check — yes/no only",
      "tr-TR": "Uygulama incelemesi (DEMO belge): 18 yaş üstü — yalnızca evet/hayır",
    },
    credentials: [
      {
        id: "identity",
        vct_values: ["urn:tamga:id:IdentityAttestation:1"],
        required_claims: ["age_over_18"],
        constraints: { age_over_18: true },
      },
    ],
    trust: TRUST_REVIEW,
    freshness: FRESH,
  },
  {
    policy_id: "review-site-signup",
    purpose: {
      "en-US":
        "App review (DEMO credential): website sign-up — given name, family name and your pseudonym for this site",
      "tr-TR": "Uygulama incelemesi (DEMO belge): web sitesine üyelik — ad, soyad ve bu siteye özel takma adın",
    },
    credentials: [
      {
        id: "identity",
        vct_values: ["urn:tamga:id:IdentityAttestation:1"],
        required_claims: ["given_name", "family_name"],
      },
    ],
    pseudonym: { mode: "single" },
    trust: TRUST_REVIEW,
    freshness: FRESH,
  },
);

export const findPolicy = (id: string | undefined) => POLICIES.find((p) => p.policy_id === id);

/** Cüzdanın "Kontrol ettir" ekranı için özet (kişisel veri yok). Yalnız takma adla giriş politikaları (belge yok) listelenmez. */
export const policySummaries = () =>
  POLICIES.filter((p) => p.credentials.length > 0).map((p) => ({
    policy_id: p.policy_id,
    purpose: p.purpose["en-US"],
    purpose_localized: p.purpose,
    vct_values: p.credentials.flatMap((c) => c.vct_values),
    claims: p.credentials.flatMap((c) => c.required_claims),
    proximity: !!p.proximity,
    format: p.credentials[0]?.format ?? "dc+sd-jwt",
  }));
