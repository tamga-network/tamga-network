// API başvuru sayfaları: docs/api/*.openapi.yaml → docs/api/<slug>.md (Türkçe, site /tr/api/…) + docs/en/api/<slug>.md.
// Sayfalar üretilir (gitignore; docs:sync çağırır) ve docs sitesinin kendi temasıyla gösterilir: uç başına yöntem rozeti,
// parametre / gövde / yanıt tabloları, curl ve yanıt örneği (kopyalama düğmeli kod blokları), sonda nesne tabloları.
// Türkçe metinler YAML'daki `x-tr` alanlarından gelir: `x-tr: "açıklama"` ya da `x-tr: { title, summary, description, name }`;
// yoksa İngilizce metin kullanılır. Makine okur YAML aynen /api/<dosya> olarak yayınlanır (OpenAPI araçlarına aktarmak için).
// Kullanım: node scripts/openapi-pages.mjs   (docs-sync-root.mjs de çağırır)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Yayınlanan API'ler, kenar çubuğu sırasıyla (docs/.vitepress/config.ts API_PAGES ile aynı adlar). */
export const API_PAGES = [
  { slug: "verify", file: "hosted-verifier-api.openapi.yaml" },
  { slug: "issuer", file: "tamga-issuer-api.openapi.yaml" },
  { slug: "institution-source", file: "institution-source.openapi.yaml" },
  { slug: "trust-lists", file: "trust-lists.openapi.yaml" },
  { slug: "status-lists", file: "status-lists.openapi.yaml" },
  { slug: "schema-catalogue", file: "schema-catalogue.openapi.yaml" },
];

const L = {
  en: {
    baseUrl: "Base URL",
    sandbox: "Sandbox",
    auth: "Authentication",
    spec: "Definition",
    download: "OpenAPI 3.1 file",
    none: "None — public",
    or: "or",
    endpoints: "Endpoints",
    endpoint: "Endpoint",
    description: "Description",
    parameters: "Parameters",
    name: "Name",
    in: "In",
    type: "Type",
    body: "Request body",
    field: "Field",
    responses: "Responses",
    status: "Status",
    returns: "Returns",
    example: "Example",
    request: "Request",
    response: "Response",
    objects: "Objects",
    required: "required",
    oneOf: "One of:",
    always: "Always",
    headers: "Headers:",
    noAuth: "No authentication: every endpoint is public.",
    servers: "Servers",
    importNote:
      "Import the machine-readable definition into any OpenAPI tool to generate a client or send test requests:",
    guide: "Guide",
    in_: { path: "path", query: "query", header: "header", cookie: "cookie" },
  },
  tr: {
    baseUrl: "Temel adres",
    sandbox: "Sandbox",
    auth: "Kimlik doğrulama",
    spec: "Tanım",
    download: "OpenAPI 3.1 dosyası",
    none: "Yok — herkese açık",
    or: "ya da",
    endpoints: "Uç noktalar",
    endpoint: "Uç nokta",
    description: "Açıklama",
    parameters: "Parametreler",
    name: "Ad",
    in: "Yer",
    type: "Tür",
    body: "İstek gövdesi",
    field: "Alan",
    responses: "Yanıtlar",
    status: "Durum",
    returns: "Döner:",
    example: "Örnek",
    request: "İstek",
    response: "Yanıt",
    objects: "Nesneler",
    required: "zorunlu",
    oneOf: "Değerler:",
    always: "Her zaman",
    headers: "Başlıklar:",
    noAuth: "Kimlik doğrulama yok: bütün uçlar herkese açık.",
    servers: "Sunucular",
    importNote:
      "Makine okur tanımı herhangi bir OpenAPI aracına aktararak istemci üretebilir ya da deneme isteği gönderebilirsiniz:",
    guide: "Rehber",
    in_: { path: "yol", query: "sorgu", header: "başlık", cookie: "çerez" },
  },
};

/** Dile göre metin: Türkçede `x-tr` (dize = açıklama; nesne = alan alan), yoksa özgün alan. */
function txt(obj, key, lang) {
  if (!obj) return undefined;
  if (lang === "tr") {
    const x = obj["x-tr"];
    if (typeof x === "string" && key === "description") return x;
    if (x && typeof x === "object" && x[key] !== undefined) return x[key];
  }
  return obj[key];
}

/** Belge kimliklerini ([[ADR-0017]]) site bağlantısına çevrilecek biçime getirir; kod parçalarına dokunmaz. */
function autolink(s) {
  if (!s) return "";
  return s
    .split(/(`[^`]*`)/)
    .map((part, i) =>
      i % 2 ? part : part.replace(/(?<![[\w-])((?:ADR|SPEC-[A-Z]+|GUIDE)-\d{4})(?![\w\]])/g, "[[$1]]"),
    )
    .join("");
}
const md = (s) => autolink(String(s ?? "").trim());
/** Tablo hücresi: tek satır, `|` kaçışlı. */
const cell = (s) =>
  md(s)
    .replace(/\s*\n\s*/g, " ")
    .replace(/\|/g, "\\|");
const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const anchor = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

function makeDoc(spec) {
  const refName = (ref) => ref.split("/").pop();
  const deref = (o) => {
    let cur = o;
    for (let i = 0; cur && cur.$ref && i < 10; i++) {
      const path = cur.$ref.replace(/^#\//, "").split("/");
      cur = path.reduce((a, k) => a?.[k], spec);
    }
    return cur ?? {};
  };
  return { spec, deref, refName };
}

/** Şema türünün kısa adı (tablo için). */
function typeLabel(doc, s) {
  if (!s) return "";
  if (s.$ref) {
    const n = doc.refName(s.$ref);
    return `[${n}](#object-${anchor(n)})`;
  }
  if (s.oneOf || s.anyOf) return (s.oneOf ?? s.anyOf).map((x) => typeLabel(doc, x)).join(" \\| ");
  let t = Array.isArray(s.type) ? s.type.join(" \\| ") : s.type;
  if (!t && s.enum) t = "string";
  if (!t && s.properties) t = "object";
  if (t === "array" && s.items) return `array&lt;${typeLabel(doc, s.items) || "any"}&gt;`;
  if (s.format && s.format !== "binary") t = `${t} (${s.format})`;
  return t ?? "any";
}

/** Açıklama hücresi: metin + değer kümesi / sabit / desen. */
function descCell(s, lang) {
  const t = L[lang];
  const parts = [];
  const d = txt(s, "description", lang);
  if (d) parts.push(cell(d));
  const en = s?.enum?.filter((v) => v !== null);
  if (en?.length) parts.push(`${t.oneOf} ${en.map((v) => `\`${v}\``).join(" · ")}`);
  if (s?.const !== undefined) parts.push(`${t.always} \`${s.const}\``);
  if (s?.default !== undefined) parts.push(`(default \`${s.default}\`)`);
  return parts.join(" ");
}

/** Nesne özelliklerini düzleştirir: iç içe satır içi nesneler `a.b`, dizi öğeleri `a[].b`. $ref'li olanlar bağlantı. */
function propRows(doc, schema, lang, prefix = "", depth = 0) {
  const s = schema.$ref ? doc.deref(schema) : schema;
  const req = new Set(s.required ?? []);
  const rows = [];
  for (const [name, raw] of Object.entries(s.properties ?? {})) {
    const p = raw;
    const full = `${prefix}${name}`;
    rows.push({ name: full, required: req.has(name), type: typeLabel(doc, p), desc: descCell(p.$ref ? {} : p, lang) });
    if (depth < 3 && !p.$ref) {
      if (p.properties) rows.push(...propRows(doc, p, lang, `${full}.`, depth + 1));
      else if (p.items && !p.items.$ref && p.items.properties)
        rows.push(...propRows(doc, p.items, lang, `${full}[].`, depth + 1));
    }
  }
  return rows;
}

function propTable(rows, lang) {
  const t = L[lang];
  const out = [`| ${t.field} | ${t.type} | ${t.description} |`, "|---|---|---|"];
  for (const r of rows)
    out.push(
      `| \`${r.name}\`${r.required ? ` <span class="api-req">${t.required}</span>` : ""} | ${r.type} | ${r.desc} |`,
    );
  return out.join("\n");
}

/** Şemadan örnek değer (YAML'da `example` varsa o). */
function sample(doc, s, depth = 0) {
  if (!s || depth > 6) return null;
  if (s.example !== undefined) return s.example;
  if (s.$ref) return sample(doc, doc.deref(s), depth + 1);
  if (s.const !== undefined) return s.const;
  if (s.enum) return s.enum.find((v) => v !== null) ?? null;
  if (s.oneOf || s.anyOf) return sample(doc, (s.oneOf ?? s.anyOf)[0], depth + 1);
  const type = Array.isArray(s.type) ? s.type.find((x) => x !== "null") : (s.type ?? (s.properties ? "object" : null));
  switch (type) {
    case "object": {
      // Zorunlu alanlar + örneği olanlar (zorunlu alan yoksa hepsi): örnek gerçek bir yanıta benzesin
      const req = new Set(s.required ?? []);
      const o = {};
      for (const [k, v] of Object.entries(s.properties ?? {}))
        if (!req.size || req.has(k) || v.example !== undefined) o[k] = sample(doc, v, depth + 1);
      return o;
    }
    case "array":
      return s.items ? [sample(doc, s.items, depth + 1)] : [];
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return true;
    case "string":
      if (s.format === "date-time") return "2026-10-09T12:00:00Z";
      if (s.format === "date") return "2026-10-09";
      if (s.format === "uri") return "https://example.org";
      return "…";
    default:
      return null;
  }
}

/** Ortam değişkeni adı (curl örneği): rpAssertion → RP_ASSERTION. */
const envName = (k) => k.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();

function schemeLabel(sch, lang) {
  if (!sch) return "";
  if (sch.type === "http") return `Bearer${sch.bearerFormat ? ` (\`${sch.bearerFormat}\`)` : ""}`;
  if (sch.type === "apiKey") return `\`${sch.name}\` ${L[lang].in_[sch.in] ?? sch.in}`;
  return sch.type;
}

function opSecurity(spec, op) {
  const sec = op.security ?? spec.security ?? [];
  return sec.filter((x) => Object.keys(x).length).map((x) => Object.keys(x)[0]);
}

const isJson = (mt) => /json/.test(mt);
function renderExample(value, mt) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return { lang: "text", text: value };
  if (isJson(mt)) return { lang: "json", text: JSON.stringify(value, null, 2) };
  return { lang: "text", text: String(value) };
}
function mediaExample(doc, media, mt) {
  if (!media || /png|octet-stream|javascript|markdown|pem/.test(mt)) return null;
  const v = media.example ?? (media.examples ? Object.values(media.examples)[0]?.value : undefined);
  return renderExample(v !== undefined ? v : sample(doc, media.schema), mt);
}

function curlFor(doc, path, method, op, base) {
  const { spec } = doc;
  const lines = [];
  let url = base + path;
  for (const p of (op.parameters ?? []).map((x) => doc.deref(x)).filter((x) => x.in === "path")) {
    const ex = p.example ?? p.schema?.example ?? p.schema?.enum?.[0];
    if (ex !== undefined) url = url.replace(`{${p.name}}`, String(ex));
  }
  lines.push(`curl${method === "get" ? "" : ` -X ${method.toUpperCase()}`} "${url}"`);
  const schemes = opSecurity(spec, op);
  if (schemes.length) {
    const k = schemes[0];
    const sch = spec.components?.securitySchemes?.[k];
    if (sch?.type === "http" && !/source-request/.test(sch.bearerFormat ?? ""))
      lines.push(`-H "Authorization: Bearer $${envName(k)}"`);
    else if (sch?.type === "apiKey" && sch.in === "header") lines.push(`-H "${sch.name}: $${envName(k)}"`);
  }
  for (const p of (op.parameters ?? []).map((x) => doc.deref(x)).filter((x) => x.in === "header" && x.required))
    lines.push(`-H "${p.name}: ${p.schema?.const ?? p.schema?.example ?? "…"}"`);
  const body = op.requestBody ? doc.deref(op.requestBody) : null;
  if (body?.content) {
    const [mt, media] = Object.entries(body.content)[0];
    lines.push(`-H "Content-Type: ${mt}"`);
    const ex = media.example ?? sample(doc, media.schema);
    lines.push(`-d '${JSON.stringify(ex).replace(/'/g, "'\\''")}'`);
  }
  return lines.join(" \\\n  ");
}

function renderOperation(doc, path, method, op, lang, base) {
  const t = L[lang];
  const { spec } = doc;
  const out = [];
  const id = anchor(op.operationId ?? `${method}-${path}`);
  out.push(`### ${txt(op, "summary", lang) ?? `${method.toUpperCase()} ${path}`} {#${id}}`, "");
  out.push(
    `<div class="api-endpoint"><span class="api-method ${method}">${method.toUpperCase()}</span><code>${esc(path)}</code></div>`,
    "",
  );
  const d = txt(op, "description", lang);
  if (d) out.push(md(d), "");
  const schemes = opSecurity(spec, op);
  out.push(
    `<p class="api-auth"><span>${t.auth}</span> ${
      schemes.length
        ? schemes
            .map((k) =>
              esc(schemeLabel(spec.components?.securitySchemes?.[k], lang)).replace(/`([^`]+)`/g, "<code>$1</code>"),
            )
            .join(` ${t.or} `)
        : t.none
    }</p>`,
    "",
  );

  const params = (op.parameters ?? []).map((x) => doc.deref(x));
  if (params.length) {
    out.push(`#### ${t.parameters}`, "", `| ${t.name} | ${t.in} | ${t.type} | ${t.description} |`, "|---|---|---|---|");
    for (const p of params)
      out.push(
        `| \`${p.name}\`${p.required ? ` <span class="api-req">${t.required}</span>` : ""} | ${t.in_[p.in] ?? p.in} | ${typeLabel(doc, p.schema)} | ${[cell(txt(p, "description", lang)), descCell({ ...p.schema, description: undefined }, lang)].filter(Boolean).join(" ")} |`,
      );
    out.push("");
  }

  const body = op.requestBody ? doc.deref(op.requestBody) : null;
  if (body?.content) {
    const [mt, media] = Object.entries(body.content)[0];
    out.push(`#### ${t.body}`, "", `<p class="api-mt"><code>${esc(mt)}</code></p>`, "");
    const rows = propRows(doc, media.schema ?? {}, lang);
    if (rows.length) out.push(propTable(rows, lang), "");
    else if (media.schema?.$ref) out.push(`${t.returns} ${typeLabel(doc, media.schema)}`, "");
  }

  const responses = Object.entries(op.responses ?? {});
  if (responses.length) {
    out.push(`#### ${t.responses}`, "", `| ${t.status} | ${t.description} |`, "|---|---|");
    for (const [code, raw] of responses) {
      const r = doc.deref(raw);
      const extra = [];
      const media = r.content ? Object.entries(r.content)[0] : null;
      if (media) {
        const sch = media[1].schema;
        const refs = sch?.$ref
          ? [sch]
          : sch?.oneOf
            ? sch.oneOf.filter((x) => x.$ref)
            : sch?.items?.$ref
              ? [sch.items]
              : [];
        if (refs.length) extra.push(`${t.returns} ${refs.map((x) => typeLabel(doc, x)).join(` ${t.or} `)}`);
      }
      if (r.headers)
        extra.push(
          `${t.headers} ${Object.keys(r.headers)
            .map((h) => `\`${h}\``)
            .join(", ")}`,
        );
      const cls = code.startsWith("2") ? "ok" : code.startsWith("4") ? "warn" : "err";
      out.push(
        `| <span class="api-code ${cls}">${code}</span> | ${[cell(txt(r, "description", lang)), ...extra].filter(Boolean).join(" ")} |`,
      );
    }
    out.push("");
  }

  // Örnek: curl + ilk başarılı yanıtın örneği
  const ok = responses.find(([c]) => c.startsWith("2"));
  const okResp = ok ? doc.deref(ok[1]) : null;
  const okMedia = okResp?.content ? Object.entries(okResp.content)[0] : null;
  const resEx = okMedia ? mediaExample(doc, okMedia[1], okMedia[0]) : null;
  out.push(`#### ${t.example}`, "", "::: code-group", "", "```bash [" + t.request + " · curl]");
  out.push(curlFor(doc, path, method, op, base), "```", "");
  if (resEx) out.push("```" + resEx.lang + ` [${t.response} · ${ok[0]}]`, resEx.text, "```", "");
  out.push(":::", "");
  return out.join("\n");
}

/** Bir API'nin sayfası. */
export function renderApiPage(spec, file, lang) {
  const t = L[lang];
  const doc = makeDoc(spec);
  const info = spec.info ?? {};
  const title = txt(info, "title", lang);
  const summary = txt(info, "summary", lang);
  const servers = spec.servers ?? [];
  const base = (servers[0]?.url ?? "").replace(/\{(\w+)\}/g, (_m, v) => servers[0].variables?.[v]?.default ?? `{${v}}`);
  const out = [];
  out.push(
    "---",
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(summary ?? "")}`,
    "outline: [2, 3]",
    "pageClass: api-page",
    "---",
    "",
    `<!-- Üretilen sayfa: docs/api/${file} (npm run docs:sync) — bu dosyayı elle düzenlemeyin -->`,
    "",
    `# ${title}`,
    "",
  );
  if (summary) out.push(`<p class="api-lede">${esc(summary)}</p>`, "");

  // Künye: sunucular, kimlik doğrulama, tanım dosyası
  const schemes = Object.entries(spec.components?.securitySchemes ?? {});
  const facts = [];
  for (const s of servers)
    facts.push(
      `<div><dt>${esc(txt(s, "description", lang) ?? t.baseUrl)}</dt><dd><code>${esc(s.url)}</code></dd></div>`,
    );
  facts.push(
    `<div><dt>${t.auth}</dt><dd>${
      (spec.security ?? []).length && schemes.length
        ? schemes.map(([, s]) => esc(schemeLabel(s, lang)).replace(/`([^`]+)`/g, "<code>$1</code>")).join(` ${t.or} `)
        : t.none
    }</dd></div>`,
  );
  facts.push(
    `<div><dt>${t.spec}</dt><dd><a href="/api/${file}" download>${t.download}</a>${
      spec.externalDocs
        ? ` · <a href="${esc(spec.externalDocs.url.replace(/^https:\/\/docs\.tamga\.network(?=\/)/, ""))}">${t.guide}</a>`
        : ""
    }</dd></div>`,
  );
  out.push(`<dl class="api-facts">${facts.join("")}</dl>`, "");

  const desc = txt(info, "description", lang);
  if (desc) out.push(md(desc), "");

  // Uç noktalar özeti
  const ops = [];
  for (const [path, item] of Object.entries(spec.paths ?? {}))
    for (const method of ["get", "post", "put", "patch", "delete"])
      if (item[method]) ops.push({ path, method, op: item[method] });
  out.push(`## ${t.endpoints}`, "", `| ${t.endpoint} | ${t.description} |`, "|---|---|");
  for (const { path, method, op } of ops)
    out.push(
      `| <span class="api-method ${method}">${method.toUpperCase()}</span> [\`${path}\`](#${anchor(op.operationId ?? `${method}-${path}`)}) | ${cell(txt(op, "summary", lang))} |`,
    );
  out.push("");

  // Kimlik doğrulama
  out.push(`## ${t.auth}`, "");
  if ((spec.security ?? []).length === 0 && !ops.some(({ op }) => opSecurity(spec, op).length)) out.push(t.noAuth, "");
  for (const [, s] of schemes) out.push(`**${schemeLabel(s, lang)}**`, "", md(txt(s, "description", lang)), "");

  // Etiket gruplarıyla uçlar
  const tags = spec.tags?.length ? spec.tags : [{ name: "" }];
  for (const tag of tags) {
    const inTag = ops.filter(({ op }) => (op.tags?.[0] ?? "") === tag.name || (!tag.name && !op.tags?.length));
    if (!inTag.length) continue;
    const tname = txt(tag, "name", lang) || t.endpoints;
    out.push(`## ${tname} {#tag-${anchor(tag.name || "endpoints")}}`, "");
    const td = txt(tag, "description", lang);
    if (td) out.push(md(td), "");
    for (const { path, method, op } of inTag) out.push(renderOperation(doc, path, method, op, lang, base));
  }

  // Nesneler
  const schemas = Object.entries(spec.components?.schemas ?? {});
  if (schemas.length) {
    out.push(`## ${t.objects}`, "");
    for (const [name, s] of schemas) {
      out.push(`### ${name} {#object-${anchor(name)}}`, "");
      const d = txt(s, "description", lang);
      if (d) out.push(md(d), "");
      const rows = propRows(doc, s, lang);
      if (rows.length) out.push(propTable(rows, lang), "");
      else if (s.type) out.push(`${t.type}: \`${s.type}\``, "");
    }
  }

  out.push("---", "", `${t.importNote} [\`${file}\`](/api/${file}).`, "");
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function buildApiPages() {
  for (const { slug, file } of API_PAGES) {
    const spec = parse(readFileSync(join(repo, "docs", "api", file), "utf8"));
    for (const [lang, dir] of [
      ["tr", join(repo, "docs", "api")],
      ["en", join(repo, "docs", "en", "api")],
    ]) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${slug}.md`), renderApiPage(spec, file, lang));
    }
  }
  return API_PAGES.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(`docs/api: ${buildApiPages()} API başvuru sayfası (en + tr)`);
}
