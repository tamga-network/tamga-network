// Tamga ARF (arf.tamga.network, ADR-0018) — sayfa üretimi, yayın arşivi ve "ne değişti" sayfası.
//   node scripts/arf-sync.mjs             → üretir (gitignore): güncel Türkçe sayfalar arf/tr/<sayfa>.md, eski yayınlar
//                                           arf/v<yayın>/ ve arf/tr/v<yayın>/, değişiklik sayfaları arf/changes.md + arf/tr/changes.md
//   node scripts/arf-sync.mjs --snapshot  → güncel yayını arf/archive/<latest>/ altına dondurur (kaynak + İngilizce)
//   node scripts/arf-sync.mjs --check     → çeviri sürümü (DY2), yayın kaydı ↔ belge sürümleri, arşiv ↔ güncel metin,
//                                           özel depo yolu (DY3); sorun varsa çıkış kodu 1
// Yayınlar arf/releases.json'da; en yenisi (`latest`) kök ve /tr/ altında, eskileri /v<yayın>/ ve /tr/v<yayın>/ altında.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRIVATE_NAMES_RE } from "./private-names.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(repo, "docs", "framework");
const ARF = join(repo, "arf");
const ARCHIVE = join(ARF, "archive");
const REL = JSON.parse(readFileSync(join(ARF, "releases.json"), "utf8"));
const LATEST = REL.latest;

const DOCS = [
  {
    id: "FW-ARF-0001",
    file: "0001-tamga-arf.md",
    page: "architecture",
    tr: "Tamga ARF — Mimari ve Referans Çerçevesi",
    en: "Architecture and Reference Framework",
  },
  {
    id: "FW-TF-0001",
    file: "0002-tamga-trust-framework.md",
    page: "annex-a-trust-framework",
    tr: "Ek A — Tamga Trust Framework (Güven Çerçevesi)",
    en: "Annex A — Trust Framework",
  },
  {
    id: "FW-RB-0001",
    file: "0003-tamga-rulebook.md",
    page: "annex-b-participant-rules",
    tr: "Ek B — Katılımcı Kuralları (Tamga Rulebook)",
    en: "Annex B — Participant Rules",
  },
  {
    id: "FW-RB-0002",
    file: "0004-attestation-rulebook-education.md",
    page: "annex-c-education",
    tr: "Ek C — Attestation Rulebook: Eğitim (Öğrenci Belgesi ve Diploma)",
    en: "Annex C — Attestation Rulebook: Education",
  },
  {
    id: "FW-RB-0003",
    file: "0005-attestation-rulebook-identity.md",
    page: "annex-c-identity",
    tr: "Ek C — Attestation Rulebook: Tamga Kimlik Belgesi",
    en: "Annex C — Attestation Rulebook: Identity",
  },
  {
    id: "FW-RB-0004",
    file: "0006-attestation-rulebook-event-ticket.md",
    page: "annex-c-event-ticket",
    tr: "Ek C — Attestation Rulebook: Etkinlik Bileti",
    en: "Annex C — Attestation Rulebook: Event Ticket",
  },
  {
    id: "FW-DEF-0001",
    file: "0007-definitions.md",
    page: "annex-d-definitions",
    tr: "Ek D — Tanımlar",
    en: "Annex D — Definitions",
  },
  {
    id: "FW-REF-0001",
    file: "0008-references.md",
    page: "annex-e-references",
    tr: "Ek E — Kaynaklar",
    en: "Annex E — References",
  },
];
// Yayınlanan metinde özel depo yolu, kişi adı ya da araç adı olmaz (DY3; onay alıntıları operatörün onay kaydında).
const PRIVATE_BASE = /tamga-platform\/|_reports\/|\.local\.json|\.env\b|\bClaude\b|\bOpus\b|\bFable\b|TOPARLAMA/;
const PRIVATE = { test: (s) => PRIVATE_BASE.test(s) || PRIVATE_NAMES_RE.test(s) };
/** Arşive giren metinden özel depo yolları çıkarılır (DY3); güncel kaynakta aynı ifadeler kullanılır. */
const SANITIZE = [
  [/Onay kaydı: `\.\.\/tamga-platform\/docs\/_reports\/[^`]+`\./g, "Onay kaydı operatörün arşivindedir."],
  [/ \(`tamga-platform\/apps\/issuer`\)/g, ""],
  [
    /\(şablonlar `tamga-platform\/docs\/legal\/`, private; yayınlanan özetler burada\)/g,
    "(şablonlar operatörde; yayınlanan özetler burada)",
  ],
  [/\n\(analiz: `\.\.\/tamga-platform\/docs\/standards\/[^`]+`\)/g, ""],
];
const sanitize = (t) => SANITIZE.reduce((s, [re, to]) => s.replace(re, to), t.replace(/\r\n/g, "\n"));

const DATE = {
  en: (d) =>
    new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  tr: (d) =>
    new Date(d + "T00:00:00Z").toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
};

// ---------------------------------------------------------------- yardımcılar
function split(txt) {
  const t = txt.replace(/\r\n/g, "\n");
  if (!t.startsWith("---\n")) return { fm: {}, raw: "", body: t };
  const end = t.indexOf("\n---", 3);
  const raw = t.slice(4, end);
  const fm = {};
  for (const line of raw.split("\n")) {
    const m = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (m) fm[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return { fm, raw, body: t.slice(end + 4).replace(/^\n+/, "") };
}

function summary(raw) {
  const lines = raw.split("\n");
  const i = lines.findIndex((l) => /^summary:\s*>/.test(l));
  if (i < 0) return "";
  const out = [];
  for (const l of lines.slice(i + 1)) {
    if (!/^\s+/.test(l)) break;
    out.push(l.trim());
  }
  return out.join(" ");
}

/** Başlıkları bir kademe indirir (tek H1 sayfa başlığıdır); kod blokları dokunulmaz. */
function demote(body) {
  let fence = false;
  return body
    .split("\n")
    .map((l) => {
      if (/^```/.test(l)) fence = !fence;
      if (fence || !/^#{1,5}\s/.test(l)) return l;
      return "#" + l.replace(/^# CHANGELOG$/, "# Değişiklik geçmişi");
    })
    .join("\n");
}

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);
function write(p, text) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}
const release = (id) => REL.releases.find((r) => r.id === id);
/** Türkçe kaynak metni: güncel yayın docs/framework'ten, eskiler arşivden. */
const trSource = (rid, d) => (rid === LATEST ? read(join(SRC, d.file)) : read(join(ARCHIVE, rid, "tr", d.file)));
/** İngilizce sayfa: güncel yayın arf/'den, eskiler arşivden (yoksa null — o yayın İngilizce değildi). */
const enSource = (rid, d) =>
  rid === LATEST ? read(join(ARF, `${d.page}.md`)) : read(join(ARCHIVE, rid, "en", `${d.page}.md`));
/** Yayının sayfa kökü: güncel kök, eskiler /v<yayın>/. */
const base = (rid, lang) => (lang === "tr" ? "/tr/" : "/") + (rid === LATEST ? "" : `v${rid}/`);

// ---------------------------------------------------------------- Türkçe sayfa
function renderTr(src, d, rid) {
  const { fm, raw, body } = split(sanitize(src));
  const old = rid !== LATEST;
  const hasEn = enSource(rid, d) !== null;
  const line2 = [
    old ? `**Yayın ${rid}** (${DATE.tr(release(rid).date)}) — dondurulmuş metin.` : `**Yayın ${rid}** — güncel.`,
    hasEn
      ? `Kaynak metin (Türkçe); [İngilizce çevirisi](${base(rid, "en")}${d.page}) aynı sürümdedir.`
      : "Kaynak metin (Türkçe).",
  ].join(" ");
  return [
    "---",
    `title: ${JSON.stringify(d.tr)}`,
    `source: ${d.id}`,
    "outline: [2, 3]",
    "---",
    "",
    `<!-- ÜRETİLDİ — elle düzenlemeyin. Kaynak: ${old ? `arf/archive/${rid}/tr/` : "docs/framework/"}${d.file} (npm run arf:sync) -->`,
    "",
    `# ${d.tr}`,
    "",
    '<div class="arf-meta">',
    "",
    `**Belge** ${d.id} · **Sürüm** ${fm.version} · **Durum** ${fm.status} · **Güncelleme** ${fm.last_updated} · **Lisans** CC BY 4.0  `,
    line2,
    "",
    "</div>",
    "",
    summary(raw),
    "",
    demote(body).trimEnd(),
    "",
  ].join("\n");
}

// ---------------------------------------------------------------- yayın özet sayfası (eski yayınlar)
function releaseIndex(rid, lang) {
  const r = release(rid);
  const tr = lang === "tr";
  const rows = DOCS.filter((d) => r.docs[d.id]).map((d) => {
    const hasEn = enSource(rid, d) !== null;
    const target = tr || hasEn ? `${base(rid, lang)}${d.page}` : `${base(rid, "tr")}${d.page}`;
    const title = tr ? d.tr : d.en + (hasEn ? "" : " (Turkish)");
    return `| [${title}](${target}) | ${d.id} | ${r.docs[d.id]} |`;
  });
  const onlyTr = !r.languages.includes("en");
  return [
    "---",
    `title: ${JSON.stringify(`Tamga ARF ${rid}`)}`,
    "aside: false",
    "---",
    "",
    `# Tamga ARF ${rid}`,
    "",
    `<span class="arf-release">${tr ? "Yayın" : "Release"} ${rid} · ${DATE[lang](r.date)}</span>`,
    "",
    tr
      ? `Bu, Tamga ARF'nin **eski bir yayınıdır**; metinler yayınlandığı hâliyle dondurulmuştur. Güncel yayın: [${LATEST}](/tr/).`
      : `This is an **earlier release** of Tamga ARF; the texts are frozen as published. Current release: [${LATEST}](/).` +
        (onlyTr ? " This release was published in Turkish only; the links open the Turkish text." : ""),
    "",
    `| ${tr ? "Belge" : "Document"} | ID | ${tr ? "Sürüm" : "Version"} |`,
    "|---|---|---|",
    ...rows,
    "",
    `## ${tr ? "Bu yayında" : "In this release"}`,
    "",
    ...r.notes[lang].map((n) => `- ${n}`),
    "",
    tr ? "[Yayınlar arasında ne değişti →](/tr/changes)" : "[What changed between releases →](/changes)",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------- satır farkı (LCS) → diff blokları
function lineDiff(a, b) {
  const n = a.length;
  const m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) ops.push([" ", a[i++], j++]);
    else if (L[i + 1][j] >= L[i][j + 1]) ops.push(["-", a[i++], j]);
    else ops.push(["+", b[j], j++]);
  }
  while (i < n) ops.push(["-", a[i++], j]);
  while (j < m) ops.push(["+", b[j], j++]);
  return ops;
}

/** Değişen yerleri 2 satır bağlamla gruplar; her grup en yakın başlığı (yeni metinde) taşır. */
function hunks(oldText, newText) {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const ops = lineDiff(a, b);
  const heading = (jIdx) => {
    for (let k = Math.min(jIdx, b.length - 1); k >= 0; k--)
      if (/^#{2,4}\s/.test(b[k])) return b[k].replace(/^#+\s*/, "");
    return "";
  };
  const changed = ops.map((o, k) => (o[0] !== " " ? k : -1)).filter((k) => k >= 0);
  if (!changed.length) return [];
  const groups = [];
  let cur = null;
  for (const k of changed) {
    if (cur && k - cur.end <= 5) cur.end = k;
    else groups.push((cur = { start: k, end: k }));
  }
  return groups.map((g) => {
    const s = Math.max(0, g.start - 2);
    const e = Math.min(ops.length - 1, g.end + 2);
    const lines = ops.slice(s, e + 1).map(([t, text]) => `${t}${text}`);
    return {
      section: heading(ops[g.start][2]),
      lines,
      adds: lines.filter((l) => l[0] === "+").length,
      dels: lines.filter((l) => l[0] === "-").length,
    };
  });
}

function changesPage(lang) {
  const tr = lang === "tr";
  const out = [
    "---",
    `title: ${JSON.stringify(tr ? "Ne değişti" : "What changed")}`,
    "outline: [2, 3]",
    "---",
    "",
    `<!-- ÜRETİLDİ — elle düzenlemeyin (npm run arf:sync) -->`,
    "",
    `# ${tr ? "Yayınlar arasında ne değişti" : "What changed between releases"}`,
    "",
    tr
      ? "Her yayın için belge sürümleri, değişen bölümler ve satır satır farklar. Satır farkları Türkçe kaynak metin üzerinden hesaplanır; `+` eklenen, `-` çıkarılan satırdır."
      : "For each release: document versions, the sections that changed and a line-by-line comparison. `+` marks an added line, `-` a removed line.",
    "",
  ];
  for (let k = 0; k < REL.releases.length - 1; k++) {
    const nw = REL.releases[k];
    const ol = REL.releases[k + 1];
    out.push(`## ${ol.id} → ${nw.id} (${DATE[lang](nw.date)})`, "");
    out.push(...nw.notes[lang].map((n) => `- ${n}`), "");
    out.push(
      `| ${tr ? "Belge" : "Document"} | ${ol.id} | ${nw.id} | ${tr ? "Değişen bölüm" : "Sections changed"} |`,
      "|---|---|---|---|",
    );
    const detail = [];
    for (const d of DOCS) {
      if (!nw.docs[d.id]) continue;
      if (!ol.docs[d.id]) {
        out.push(
          `| [${tr ? d.tr : d.en}](${base(nw.id, lang)}${d.page}) | — | ${nw.docs[d.id]} | ${tr ? "yeni belge" : "new document"} |`,
        );
        continue;
      }
      // İngilizce sayfada: her iki yayında İngilizce varsa İngilizce metin, yoksa Türkçe kaynak karşılaştırılır.
      const useEn = !tr && enSource(nw.id, d) !== null && enSource(ol.id, d) !== null;
      const text = (rid) =>
        useEn ? split(sanitize(enSource(rid, d))).body : demote(split(sanitize(trSource(rid, d))).body);
      const hs = hunks(text(ol.id), text(nw.id));
      const sections = [...new Set(hs.map((h) => h.section).filter(Boolean))];
      const title = tr ? d.tr : d.en;
      out.push(
        `| [${title}](${base(nw.id, lang)}${d.page}) | ${ol.docs[d.id]} | ${nw.docs[d.id]} | ${hs.length ? sections.length : "—"} |`,
      );
      if (!hs.length) continue;
      const adds = hs.reduce((s, h) => s + h.adds, 0);
      const dels = hs.reduce((s, h) => s + h.dels, 0);
      detail.push(`### ${title} — ${ol.docs[d.id]} → ${nw.docs[d.id]}`, "");
      if (!tr && !useEn)
        detail.push(`*Release ${ol.id} was Turkish only; this comparison is on the Turkish source text.*`, "");
      detail.push(`${tr ? "Değişen bölümler" : "Sections changed"}: ${sections.map((s) => `“${s}”`).join(" · ")}`, "");
      detail.push(`::: details ${tr ? "Satır satır" : "Line by line"} (+${adds} / −${dels})`, "", "```diff");
      for (const h of hs) detail.push(`@@ ${h.section || (tr ? "başlangıç" : "start")} @@`, ...h.lines);
      detail.push("```", "", ":::", "");
    }
    out.push("", ...detail);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------- akış
const mode = process.argv.includes("--check") ? "check" : process.argv.includes("--snapshot") ? "snapshot" : "sync";
const problems = [];
const latest = release(LATEST);
if (!latest) problems.push(`releases.json: latest ${LATEST} kayıtlı değil`);

// Marka simgeleri + robots.txt: ops/brand/icons/ (tek kaynak) → arf/public/ (gitignore).
if (mode === "sync") {
  const pub = join(repo, "arf", "public");
  mkdirSync(pub, { recursive: true });
  for (const f of ["favicon.ico", "icon.svg", "mark.svg", "apple-touch-icon.png", "og.png"])
    copyFileSync(join(repo, "ops", "brand", "icons", f), join(pub, f));
  writeFileSync(join(pub, "robots.txt"), "User-agent: *\nAllow: /\n\nSitemap: https://arf.tamga.network/sitemap.xml\n");
}

if (mode === "snapshot") {
  for (const d of DOCS) {
    write(join(ARCHIVE, LATEST, "tr", d.file), sanitize(read(join(SRC, d.file))));
    write(join(ARCHIVE, LATEST, "en", `${d.page}.md`), sanitize(read(join(ARF, `${d.page}.md`))));
  }
  console.log(`arf: yayın ${LATEST} arşive donduruldu → arf/archive/${LATEST}/`);
  process.exit(0);
}

for (const d of DOCS) {
  const src = read(join(SRC, d.file));
  const { fm } = split(src);
  if (latest && latest.docs[d.id] !== fm.version)
    problems.push(
      `releases.json ${LATEST}: ${d.id} ${latest.docs[d.id]} ≠ kaynak ${fm.version} — yeni yayın kaydı açın ya da güncelleyin`,
    );
  const en = read(join(ARF, `${d.page}.md`));
  if (!en) problems.push(`${d.page}.md yok (İngilizce çeviri, ${d.id})`);
  else {
    const e = split(en);
    if (e.fm.translation_of !== d.id) problems.push(`${d.page}.md: translation_of ${e.fm.translation_of} ≠ ${d.id}`);
    if (e.fm.source_version !== fm.version)
      problems.push(
        `${d.page}.md: source_version ${e.fm.source_version} ≠ kaynak ${d.id} ${fm.version} — İngilizceyi güncelleyin (DY2)`,
      );
    if (PRIVATE.test(e.body)) problems.push(`${d.page}.md: özel depo yolu içeriyor (DY3)`);
    const arcEn = read(join(ARCHIVE, LATEST, "en", `${d.page}.md`));
    if (arcEn !== null && arcEn !== sanitize(en))
      problems.push(`arşiv ${LATEST}/en/${d.page}.md güncel metinden farklı — npm run arf:snapshot`);
  }
  if (PRIVATE.test(src)) problems.push(`${d.file}: özel depo yolu içeriyor (DY3) — ARF'de yayınlanır`);
  const arcTr = read(join(ARCHIVE, LATEST, "tr", d.file));
  if (arcTr === null) problems.push(`arşiv ${LATEST}/tr/${d.file} yok — npm run arf:snapshot`);
  else if (arcTr !== sanitize(src))
    problems.push(`arşiv ${LATEST}/tr/${d.file} güncel metinden farklı — npm run arf:snapshot`);
}
for (const r of REL.releases) {
  if (r.id === LATEST) continue;
  for (const d of DOCS) {
    if (!r.docs[d.id]) continue;
    const t = read(join(ARCHIVE, r.id, "tr", d.file));
    if (t === null) problems.push(`arşiv ${r.id}/tr/${d.file} yok`);
    else {
      if (PRIVATE.test(t)) problems.push(`arşiv ${r.id}/tr/${d.file}: özel depo yolu (DY3)`);
      if (split(t).fm.version !== r.docs[d.id])
        problems.push(`arşiv ${r.id}/tr/${d.file}: sürüm ${split(t).fm.version} ≠ releases.json ${r.docs[d.id]}`);
    }
  }
}

if (mode === "sync") {
  for (const dir of readdirSync(ARF)) if (/^v\d/.test(dir)) rmSync(join(ARF, dir), { recursive: true });
  for (const dir of readdirSync(join(ARF, "tr")))
    if (/^v\d/.test(dir)) rmSync(join(ARF, "tr", dir), { recursive: true });
  for (const r of REL.releases) {
    for (const d of DOCS) {
      if (!r.docs[d.id]) continue;
      write(join(ARF, "tr", r.id === LATEST ? "" : `v${r.id}`, `${d.page}.md`), renderTr(trSource(r.id, d), d, r.id));
      if (r.id !== LATEST) {
        const en = enSource(r.id, d);
        if (en) write(join(ARF, `v${r.id}`, `${d.page}.md`), en);
      }
    }
    if (r.id !== LATEST) {
      write(join(ARF, `v${r.id}`, "index.md"), releaseIndex(r.id, "en"));
      write(join(ARF, "tr", `v${r.id}`, "index.md"), releaseIndex(r.id, "tr"));
    }
  }
  write(join(ARF, "changes.md"), changesPage("en"));
  write(join(ARF, "tr", "changes.md"), changesPage("tr"));
}

if (problems.length) {
  console.error("arf: " + problems.length + " sorun\n  - " + problems.join("\n  - "));
  // Üretim (sync) sürerken uyarır; yayını durduran denetim --check'tir (CI, deploy).
  if (mode === "check") process.exit(1);
}
console.log(
  mode === "check"
    ? `arf: ${DOCS.length} belge · ${REL.releases.length} yayın · çeviri ve arşiv güncel`
    : `arf: ${REL.releases.length} yayın üretildi (güncel ${LATEST}) + değişiklik sayfaları`,
);
