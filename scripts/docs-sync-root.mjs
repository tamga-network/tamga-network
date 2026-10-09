// docs sitesinin üretilen sayfaları (gitignore) — iki dilde: İngilizce docs/en/…, Türkçe docs/… (site /tr/…).
//   sürüm notları  CHANGELOG.md   → docs/en/changelog.md, docs/changelog.md
//   bağlayıcı kurallar INVARIANTS.md → docs/en/rules.md, docs/rules.md (kural metinleri Türkçe kaynaktır)
//   paketler       packages/*/README.md → docs/en/packages/, docs/packages/
//   sözlük         docs/.vitepress/terms.json → docs/glossary.md, docs/en/glossary.md (TERMS:BEGIN…END arası; giriş elle)
//   API başvurusu  docs/api/*.openapi.yaml → docs/api/<slug>.md, docs/en/api/<slug>.md + docs/public/api/ (indirme)
//   marka simgeleri → docs/public/
import { mkdirSync, copyFileSync, readdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApiPages } from "./openapi-pages.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(repo, "docs");
const write = (p, text) => {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
};
const L = { en: join(docs, "en"), tr: docs };

// Sürüm notları (kaynak İngilizce; Türkçe sayfada başlık Türkçe)
{
  const cl = readFileSync(join(repo, "CHANGELOG.md"), "utf8").replace(/\r\n/g, "\n");
  const body = cl.slice(cl.indexOf("\n## ") + 1);
  write(
    join(L.en, "changelog.md"),
    [
      "---",
      "title: Release notes",
      "outline: [2, 3]",
      "---",
      "",
      "# Release notes",
      "",
      "Changes to the `@tamga-network/*` packages, the services and the documentation — newest first.",
      "",
      body,
    ].join("\n"),
  );
  write(
    join(L.tr, "changelog.md"),
    [
      "---",
      "title: Sürüm notları",
      "outline: [2, 3]",
      "---",
      "",
      "# Sürüm notları",
      "",
      "`@tamga-network/*` paketlerinin, servislerin ve belgelerin değişiklikleri — yeniden eskiye. Sürüm notları İngilizce tutulur.",
      "",
      body,
    ].join("\n"),
  );
}
// Bağlayıcı kurallar
{
  const inv = readFileSync(join(repo, "INVARIANTS.md"), "utf8").replace(/\r\n/g, "\n");
  const body = inv.replace(/^---[\s\S]*?\n---\n/, "").replace(/^# .*\n/m, "");
  write(
    join(L.tr, "rules.md"),
    ["---", "title: Bağlayıcı kurallar", "outline: [2, 2]", "---", "", "# Bağlayıcı kurallar", body].join("\n"),
  );
  write(
    join(L.en, "rules.md"),
    [
      "---",
      "title: Binding rules",
      "outline: [2, 2]",
      "---",
      "",
      "# Binding rules",
      "",
      "> Every binding rule (invariant) of the specifications and decisions, by document. The rule texts are the Turkish source; each code links to its document.",
      body,
    ].join("\n"),
  );
}
console.log("docs: sürüm notları + bağlayıcı kurallar (en, tr)");

// Paket sayfaları: packages/*/README.md (İngilizce, npm'deki metin) → iki dilde aynı içerik; dizin sayfası dile göre.
const PKG = [
  [
    "core",
    "Shared building blocks: digests, identifiers, certificate helpers",
    "Ortak yapı taşları: özetler, kimlik türetme, sertifika yardımcıları",
  ],
  [
    "trust",
    "Signed trust lists and TrustSource (+ /core: platform-independent core)",
    "İmzalı güven listeleri ve TrustSource (+ /core: platformdan bağımsız çekirdek)",
  ],
  [
    "schemas",
    "Credential type catalogue: type metadata, JSON Schema, integrity digests",
    "Belge türü kataloğu: tip tanımı, JSON Schema, içerik özetleri",
  ],
  [
    "sd-jwt",
    "SD-JWT VC: selective disclosure, key binding, status list",
    "SD-JWT VC: selective disclosure, key binding, status list",
  ],
  [
    "mdoc",
    "ISO/IEC 18013-5 mdoc: CBOR, COSE, issuance and verification",
    "ISO/IEC 18013-5 mdoc: CBOR, COSE, verme ve doğrulama",
  ],
  [
    "issuer",
    "Issuance: OpenID4VCI, status list publisher; /client for the hosted service",
    "Belge verme: OpenID4VCI, status list yayıncısı; /client barındırılan servis için",
  ],
  [
    "verifier",
    "Verification pipeline, OpenID4VP; /web page kit, /zk zero-knowledge proofs",
    "Doğrulama hattı, OpenID4VP; /web sayfa kiti, /zk sıfır bilgi ispatı",
  ],
  [
    "wallet-core",
    "Wallet core: keys, issuance, local checks, presentation",
    "Cüzdan çekirdeği: anahtarlar, belge alma, yerel denetim, gösterme",
  ],
];
for (const lang of ["en", "tr"]) {
  const out = join(L[lang], "packages");
  if (existsSync(out)) rmSync(out, { recursive: true });
  mkdirSync(out, { recursive: true });
  const rows = [];
  for (const [name, en, tr] of PKG) {
    const readme = join(repo, "packages", name, "README.md");
    if (!existsSync(readme)) continue;
    const body = readFileSync(readme, "utf8").replace(/\r\n/g, "\n");
    writeFileSync(
      join(out, `${name}.md`),
      `---\ntitle: "@tamga-network/${name}"\n---\n\n<!-- ÜRETİLDİ — kaynak: packages/${name}/README.md (npm run docs:sync) -->\n\n${body}`,
    );
    rows.push(`| [\`@tamga-network/${name}\`](./${name}) | ${lang === "en" ? en : tr} |`);
  }
  const intro =
    lang === "en"
      ? [
          "# Packages",
          "",
          "Tamga's open-source packages (`@tamga-network/*`, Apache-2.0). Each page is the package's own README — the same text",
          "as on npm. The packages are published on npm as the **0.3.1** test release; the stable 1.0.0 comes when everything is",
          "ready. In test releases the API may change.",
          "Working examples: [Code examples](/guides/code-examples).",
        ]
      : [
          "# Paketler",
          "",
          "Tamga'nın açık kaynak paketleri (`@tamga-network/*`, Apache-2.0). Her sayfa paketin kendi README'sidir — npm'deki",
          "metinle aynı, İngilizce. Paketler npm'de **0.3.1** deneme sürümüyle yayımlanır; kararlı 1.0.0 hazır olunca gelir.",
          "Deneme sürümünde arayüz değişebilir.",
          "Çalışan örnekler: [Kod örnekleri](/guides/code-examples).",
        ];
  writeFileSync(
    join(out, "index.md"),
    [
      "---",
      `title: ${lang === "en" ? "Packages" : "Paketler"}`,
      "---",
      "",
      ...intro,
      "",
      lang === "en" ? "| Package | What it does |" : "| Paket | Ne işe yarar |",
      "|---|---|",
      ...rows,
      "",
    ].join("\n"),
  );
}
console.log("docs: paket sayfaları (en, tr)");

// API tanımları: docs/api/*.openapi.yaml → docs/public/api/ (gitignore; indirme ve OpenAPI araçlarına aktarma için) +
// başvuru sayfaları docs/api/<slug>.md, docs/en/api/<slug>.md (scripts/openapi-pages.mjs; sitenin kendi temasıyla)
const apiOut = join(repo, "docs", "public", "api");
rmSync(apiOut, { recursive: true, force: true }); // eski üretimler (ör. önceki bağımsız başvuru sayfası) kalmasın
mkdirSync(apiOut, { recursive: true });
const apiFiles = readdirSync(join(repo, "docs", "api")).filter((f) => f.endsWith(".openapi.yaml"));
for (const f of apiFiles) copyFileSync(join(repo, "docs", "api", f), join(apiOut, f));
const apiPages = buildApiPages();
console.log(`docs/api: ${apiFiles.length} OpenAPI dosyası, ${apiPages} başvuru sayfası (en, tr)`);

// Marka simgeleri + robots.txt: ops/brand/icons/ (tek kaynak) → docs/public/ (gitignore). Paylaşım görseli og.png.
const brandSrc = join(repo, "ops", "brand", "icons");
const pub = join(repo, "docs", "public");
for (const f of ["favicon.ico", "icon.svg", "mark.svg", "apple-touch-icon.png", "og.png"])
  copyFileSync(join(brandSrc, f), join(pub, f));
writeFileSync(join(pub, "robots.txt"), "User-agent: *\nAllow: /\n\nSitemap: https://docs.tamga.network/sitemap.xml\n");
console.log("docs/public: marka simgeleri + robots.txt");

// Sözlük: docs/glossary.md ve docs/en/glossary.md'nin terim bölümü docs/.vitepress/terms.json'dan üretilir (tek kaynak).
// Sayfanın ön bilgisi ve giriş metni elle yazılır; TERMS:BEGIN … TERMS:END arası her docs:sync'te yeniden yazılır.
{
  const TERMS = JSON.parse(readFileSync(join(docs, ".vitepress", "terms.json"), "utf8"));
  const GROUPS = [
    {
      tr: "Temel kavramlar",
      en: "Core ideas",
      ids: [
        "eIDAS",
        "EUDI-Wallet",
        "ARF",
        "trust-framework",
        "rulebook",
        "federation",
        "conformance",
        "ledger",
        "validator",
        "OTS",
      ],
    },
    {
      tr: "Roller",
      en: "Roles",
      ids: [
        "issuer",
        "verifier",
        "relying-party",
        "RP",
        "holder",
        "wallet-provider",
        "authentic-source",
        "registrar",
        "TLSO",
        "QTSP",
        "intermediary",
      ],
    },
    {
      tr: "Belgeler",
      en: "Credentials",
      ids: [
        "credential",
        "attestation",
        "PID",
        "EAA",
        "QEAA",
        "PuB-EAA",
        "vct",
        "SD-JWT-VC",
        "mdoc",
        "mDL",
        "schema-catalogue",
        "issuance",
        "credential-offer",
        "batch-issuance",
        "refresh-token",
        "revocation",
        "status-list",
        "ELM",
        "ECTS",
        "ISCED-F",
      ],
    },
    {
      tr: "Gösterme ve gizlilik",
      en: "Presentation and privacy",
      ids: [
        "selective-disclosure",
        "disclosure",
        "salted-hash",
        "KB-JWT",
        "holder-binding",
        "key-binding",
        "proof-of-possession",
        "nonce",
        "DCQL",
        "pseudonym",
        "ZK",
        "Longfellow-ZK",
        "verification-pipeline",
        "transaction-log",
        "accountable-disclosure",
      ],
    },
    {
      tr: "Güven",
      en: "Trust",
      ids: [
        "trust-list",
        "trusted-list",
        "LOTL",
        "LoTE",
        "trust-anchor",
        "root-ca",
        "access-certificate",
        "registration-certificate",
        "WRPAC",
        "WRPRC",
        "x509_hash",
        "anchor-log",
        "identity-proofing",
        "LoA",
        "QES",
        "QSCD",
      ],
    },
    {
      tr: "Cüzdan",
      en: "Wallet",
      ids: ["wallet-unit", "WIA", "WUA", "key-attestation", "device-attestation", "passkey"],
    },
    {
      tr: "Standartlar ve protokoller",
      en: "Standards and protocols",
      ids: ["OpenID4VCI", "OpenID4VP", "HAIP", "PAR", "DPoP", "ETSI"],
    },
  ];
  const listed = new Set(GROUPS.flatMap((g) => g.ids));
  const rest = Object.keys(TERMS).filter((id) => !listed.has(id));
  if (rest.length) GROUPS.push({ tr: "Diğer", en: "Other", ids: rest });
  const cap = (s, lang) => (s ? s.charAt(0).toLocaleUpperCase(lang === "tr" ? "tr" : "en") + s.slice(1) : s);
  const entry = (id, lang) => {
    const t = TERMS[id];
    if (!t) return null;
    if (lang === "tr" && t.tr_label)
      return { key: t.tr_label, line: `**${cap(t.tr_label, "tr")}** (${t.label}) — ${t.tr}` };
    const head = /^[a-z][a-z0-9 -]*$/.test(t.label) ? cap(t.label, "en") : t.label;
    return {
      key: t.label,
      line: `**${head}**${t.expansion ? ` (${t.expansion})` : ""} — ${lang === "tr" ? t.tr : t.en}`,
    };
  };
  const body = (lang) =>
    GROUPS.map((g) => {
      const items = g.ids
        .map((id) => entry(id, lang))
        .filter(Boolean)
        .sort((a, b) => a.key.localeCompare(b.key, lang === "tr" ? "tr" : "en", { sensitivity: "base" }));
      return [`## ${g[lang]}`, "", ...items.flatMap((i) => [i.line, ""])].join("\n");
    }).join("\n");
  const BEGIN =
    "<!-- TERMS:BEGIN — docs/.vitepress/terms.json'dan üretilir (npm run docs:sync); bu işaretler arasını elle düzenlemeyin -->";
  const END = "<!-- TERMS:END -->";
  for (const [lang, file] of [
    ["tr", join(docs, "glossary.md")],
    ["en", join(docs, "en", "glossary.md")],
  ]) {
    const src = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    let head;
    if (src.includes(BEGIN)) head = src.slice(0, src.indexOf(BEGIN));
    else {
      // İlk üretim: giriş metninden sonraki ilk "## " başlığından itibaren eski elle yazılmış terimler kalkar.
      const i = src.indexOf("\n## ");
      head = (i < 0 ? src : src.slice(0, i + 1)).replace(/\n---\n*$/, "\n");
    }
    const text = `${head.trimEnd()}\n\n${BEGIN}\n\n${body(lang)}\n${END}\n`;
    if (text !== src) writeFileSync(file, text);
  }
  console.log(`docs: sözlük terms.json'dan (${Object.keys(TERMS).length} terim, en + tr)`);
}
