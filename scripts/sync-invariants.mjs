/**
 * scripts/sync-invariants.mjs — INVARIANTS.md'yi kaynak dokümanların "Değişmezler" tablolarından yeniden üretir (/sync-index adım 3).
 * Kural: kod DOKÜMAN KAPSAMLIDIR; çapraz atıf `DOC-ID/KOD`. Bu betik içerik yazmaz; yalnızca derler ve sayar.
 * Kaynak: docs/{specifications,architecture,project-memory}/**.md — başlığında "Değişmez" geçen bölümlerdeki `| **KOD** | metin |`
 * satırları + önceki INVARIANTS.md'de zaten indekslenmiş (doküman, kod) çiftleri (W1–W3, SEV1–3, SG1–7 gibi bölüm dışı tablolar) —
 * kaynak dokümanda hâlâ varsa korunur, yoksa düşer. Çıktı: INVARIANTS.md (aynı biçim) + stdout özeti. `--check` yalnızca karşılaştırır.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = join(ROOT, "docs");
const OUT = join(ROOT, "INVARIANTS.md");
const CHECK = process.argv.includes("--check");
const CODE = /^[A-Z]{1,6}[0-9]{1,3}[a-z]?$/;

function walk(d, out = []) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) {
      if (!/_archive|beta|delivery|framework|rfc|academy|research|guides/.test(n)) walk(p, out);
    } else if (n.endsWith(".md")) out.push(p);
  }
  return out;
}
function fm(txt) {
  const m = /^---\n([\s\S]*?)\n---/.exec(txt);
  const o = {};
  if (m)
    for (const l of m[1].split("\n")) {
      const k = /^([a-z_]+):\s*(.+)$/.exec(l);
      if (k) o[k[1]] = k[2].trim();
    }
  return o;
}
const cell = (s) =>
  s
    .replace(/^\*\*|\*\*$/g, "")
    .replace(/^`|`$/g, "")
    .trim();

// önceki indeks
const prev = new Map(); // docId → Map(code → text)
try {
  const old = readFileSync(OUT, "utf8");
  let cur = null;
  for (const l of old.split(/\r?\n/)) {
    const h = /^## ([A-Z][A-Z0-9-]+)\s*$/.exec(l);
    if (h) {
      cur = h[1];
      prev.set(cur, prev.get(cur) ?? new Map());
      continue;
    }
    const r = /^\| `([A-Z][A-Z0-9-]+)\/([A-Za-z0-9]+)` \| (.+) \|$/.exec(l);
    if (r && cur) prev.get(cur).set(r[2], r[3]);
  }
} catch {
  /* ilk üretim */
}

const docs = [];
for (const f of walk(DOCS)) {
  const txt = readFileSync(f, "utf8");
  const meta = fm(txt);
  if (!meta.document_id) continue;
  const lines = txt.split(/\r?\n/);
  const codes = new Map();
  const rowsAll = new Map();
  let inInv = false,
    invLevel = 0;
  for (const l of lines) {
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    if (h) {
      const lvl = h[1].length;
      if (/Değişmez/i.test(h[2])) {
        inInv = true;
        invLevel = lvl;
      } else if (inInv && lvl <= invLevel) inInv = false;
      continue;
    }
    const r = /^\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*(?:\|.*)?$/.exec(l);
    if (!r) continue;
    const c = cell(r[1]);
    if (!CODE.test(c)) continue;
    const text = r[2].replace(/\s*\|\s*$/, "").trim();
    rowsAll.set(c, text);
    if (inInv) codes.set(c, text);
  }
  // önceki indekste olan bölüm-dışı kodları koru (kaynakta hâlâ varsa)
  for (const [c, t] of prev.get(meta.document_id) ?? [])
    if (!codes.has(c) && rowsAll.has(c)) codes.set(c, rowsAll.get(c));
  if (codes.size)
    docs.push({ id: meta.document_id, title: meta.title ?? "", file: f.replace(ROOT, "").replace(/\\/g, "/"), codes });
}
docs.sort((a, b) => (a.id < b.id ? -1 : 1));
const total = docs.reduce((n, d) => n + d.codes.size, 0);
const prefixes = new Set();
for (const d of docs) for (const c of d.codes.keys()) prefixes.add(c.replace(/[0-9]+[a-z]?$/, ""));
// çakışma: aynı DOC/KOD iki kez olamaz (Map garantiler); rapor
const added = [],
  removed = [];
for (const d of docs) {
  const p = prev.get(d.id) ?? new Map();
  for (const c of d.codes.keys()) if (!p.has(c)) added.push(`${d.id}/${c}`);
  for (const c of p.keys()) if (!d.codes.has(c)) removed.push(`${d.id}/${c}`);
}
for (const [id, m] of prev) if (!docs.some((d) => d.id === id)) for (const c of m.keys()) removed.push(`${id}/${c}`);

const today = new Date().toISOString().slice(0, 10);
const body = `---
document_id: INVARIANTS
title: Değişmezler İndeksi — Tüm Dokümanların Bağlayıcı Kuralları
category: Reference
domain: Platform
status: Active
review_status: Draft
version: 1.1.0
created: 2026-09-09
last_updated: ${today}
authors:
  - Tamga Network Engineering
language: tr
document_type: reference
audience:
  - engineers
  - architects
  - ai-agents
tags:
  - invariants
  - reference
  - index
keywords:
  - invariant index
  - document scoped codes
  - cross document citation
summary: >
  Tüm spesifikasyon ve mimari dokümanlarındaki değişmezlerin (invariant) tek
  indeksi. ÜRETİLEN DOSYADIR — kaynak, her dokümanın kendi "Değişmezler"
  tablosudur (scripts/sync-invariants.mjs). Amacı iki: (1) kod çakışmalarını
  görünür kılmak, (2) bir kuralın hangi dokümanda tanımlandığını hızlıca bulmak.
  Çapraz atıf her zaman \`DOC-ID/KOD\` biçiminde yapılır.
priority: High
---

# Nasıl kullanılır

**Değişmez kodları doküman kapsamlıdır.** Farklı dokümanlarda aynı kod
bulunabilir — bu yüzden çapraz atıf **her zaman** doküman kimliğiyle yapılır:

\`\`\`
✓ [[SPEC-CRED-0003]]/S1        doğru
✗ S1                            belirsiz
\`\`\`

**Adım kodları değişmez değildir.** Doğrulama hattının \`A1…E4\` adım kodları
([[SPEC-API-0001]] §1) kanoniktir ve \`failed_step\` alanında kullanılır; değişmez
tablolarıyla karıştırılmamalıdır. Çerçeve belgelerinin (\`docs/framework/\`) RB-* kuralları
da değişmez değildir; kaynak koda atıf verirler (D-GOV-6).

**Bu dosya üretilir.** Bir değişmezi değiştirmek için kaynak dokümanı
değiştir, sonra \`node scripts/sync-invariants.mjs\` ile bu indeksi yeniden üret. Elle düzenleme yapılmaz.

**Toplam: ${total} kodlanmış değişmez, ${docs.length} dokümanda.** Ayrıca bir Draft spec
(SPEC-ID-0001) doküman-kapsamlı **kısa kod atanmamış** numaralı değişmez listesi
taşır; [[SPEC-ID-0002]] ile superseded olduğu için kodlanmadı ve aşağıda
"Kodlanmamış Değişmez Listeleri" altında not olarak izlenir (sayıya dahil değil).

---

${docs.map((d) => `\n## ${d.id}\n\n*${d.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}*\n\n| Kod | Açıklama |\n|---|---|\n${[...d.codes].map(([c, t]) => `| \`${d.id}/${c}\` | ${t} |`).join("\n")}\n`).join("\n")}

---

# Kodlanmamış Değişmez Listeleri

| Doküman | Konum | Değişmez sayısı | Not |
|---|---|---|---|
| \`SPEC-ID-0001\` | §7 Değişmezler | 5 | **Superseded, kodlanmadı.** Entity profili [[SPEC-ID-0002]] ile superseded; kod ataması yapılmaz. Atıf madde numarasıyla yapılır (ör. \`SPEC-ID-0001\` §7/2). |

---

# Kod Çakışmaları

Şu an **çakışma yok**. ${total} kodlanmış değişmezin \`DOC-ID/KOD\` uzayında yinelenen giriş yoktur
(üretici aynı dokümanda aynı kodu iki kez kabul etmez). Prefix uzayı (doküman kapsamlı):
${[...prefixes].sort().join(", ")}.

---

# Durum

**Üretilen dosya** — ${today} (\`scripts/sync-invariants.mjs\`). Toplam ${total} kodlanmış değişmez, ${docs.length} dokümanda.
`;
console.log(`dokümanlar: ${docs.length} · kod: ${total} · eklenen: ${added.length} · düşen: ${removed.length}`);
if (added.length) console.log("  + " + added.join(", "));
if (removed.length) console.log("  - " + removed.join(", "));
if (!CHECK) {
  writeFileSync(OUT, body);
  console.log("INVARIANTS.md yazıldı");
}
