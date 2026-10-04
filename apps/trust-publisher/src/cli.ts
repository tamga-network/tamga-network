/**
 * trust-publisher CLI — provisional TLSO
 *   build      registry/*.source.json + ops/pki + packages/schemas/dist → dist/{lotl,tl-tr}.{json,jws}, keys/, CHANGELOG.md, archive/
 *   anchor     --kind status_list --list-id --issuer-id --list-uri --content-hash --list-version [--published-at]
 *   heartbeat  boş çapa satırı (saatlik kadans, S5 mantığı)
 *   verify     dist/ setini yükleyici ile doğrular ve özet basar; --full: arşivlerle seq 0'dan tam zincir (TL10 replay)
 *   archive    çapa günlüğünü kontrol noktasıyla arşivler (TL12; otomatik eşik TAMGA_ANCHORS_MAX_LINES=500)
 *   status <slug> <ACTIVE|SUSPENDED|REVOKED|RETIRED> [--reason r] [--invalidates-from <iso>|valid_from]
 *                                                 issuer statüsünü değiştirir (status_history'ye ekler; kayıt silinmez — TL2), listeyi
 *                                                 yeniden imzalar (≤24 s kuralı; CHANGELOG). REVOKED + --invalidates-from: o andan sonraki
 *                                                 belgeler düşer (`valid_from` = kurumun bütün belgeleri)
 *   rp-status <dns_name> <STATUS> [--reason r]    doğrulayıcı statüsü (aynı kural)
 *   end-use <dns_name> <scope_id|group_id>        doğrulayıcının bir kullanımını ya da kapı grubunu sona erdirir (valid_until = şimdi)
 *   register issuer|rp <başvuru.json> [--check]   kurum / doğrulayıcı ekler (ADR-0024 kayıt verisi denetlenir), listeyi imzalar
 *   scope <dns_name> <kullanım.json> [--check]    kayıtlı doğrulayıcıya yeni kullanım (kapsam) ekler (ADR-0034: alan adıyla)
 *   authorize <slug> <vct> [--revoke]             kuruma şema yetkisi verir / kaldırır (kayıt silinmez, bitiş tarihi konur)
 *   list                                          kurumlar ve doğrulayıcılar; eksik kayıt verisi
 * Kurallar: version monoton, previous_version_hash = önceki .jws'in sha256'sı; dist/ değişmez arşivi.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
  statSync,
  rmSync,
  renameSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { X509Certificate } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  pemSigner,
  signJson,
  pemToDer,
  sha256Tag,
  utf8,
  computeCaId,
  computeIssuerId,
  computeRpId,
  x509HashClientId,
  computeSchemaId,
  certFingerprintSha256Hex,
  loadTrustSet,
  verifyJws,
  parseLote,
  ExternalListPointer,
  Anchor as AnchorSchema,
  type Anchor,
} from "../../../packages/trust/src/index.js";

import { buildLote, contactFromRegistration, jadesHeader, type LoteContact, type LoteInput } from "./lote.js";
import { checkRegistrations, issuerEntitlements } from "./registration.js";
import { buildWrprcPayloads, wrprcHeader } from "./wrprc.js";
import {
  RegistryError,
  addIssuer,
  addRelyingParty,
  addScope,
  setAuthorization,
  setIssuerStatus,
  setRpStatus,
  endRpUse,
  summarize,
  type RegistryEnv,
} from "./registry-ops.js";
const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, "..");
// Kaynak kayıt ve çıktı klasörü ortamla değiştirilebilir (testler geçici klasörde çalışır; varsayılan davranış aynı)
const REG = resolve(process.env.TAMGA_TP_REGISTRY ?? resolve(app, "registry"));
const DIST = resolve(process.env.TAMGA_TP_DIST ?? resolve(app, "dist"));
const ARCHIVE = resolve(DIST, "archive");
const PKI = resolve(process.env.TAMGA_TP_PKI ?? resolve(app, "..", "..", "ops", "pki"));
/** ADR-0038: kayıt defterinin ortamı (lotl.source.json `environment`; yoksa gerçek ağ). */
const ENVIRONMENT: "production" | "sandbox" = existsSync(resolve(REG, "lotl.source.json"))
  ? (JSON.parse(readFileSync(resolve(REG, "lotl.source.json"), "utf8")).environment ?? "production")
  : "production";
const SCHEMAS_INDEX = resolve(app, "..", "..", "packages", "schemas", "dist", "index.json");

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const iso = (d: Date) => d.toISOString();
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);
function cert(name: string) {
  const pem = readFileSync(resolve(PKI, `${name}.cert.pem`), "utf8");
  const der = pemToDer(pem);
  // ADR-0038 SB1: test sertifikası gerçek listeye, gerçek sertifika sandbox listesine girmez
  const isTest = /(TEST)/.test(new X509Certificate(der).subject);
  if (isTest !== (ENVIRONMENT === "sandbox"))
    throw new Error(
      `SB1: ${name} sertifikası ${isTest ? "test" : "gerçek"}, kayıt defteri ${ENVIRONMENT} — karıştırılamaz`,
    );
  return { pem, der, fp: certFingerprintSha256Hex(der) };
}
function keyEntry(name: string) {
  const c = cert(name);
  return { fingerprint_sha256: c.fp, cert_ref: name, status: "ACTIVE" };
}
async function signer(name = "tl-signer-1") {
  return pemSigner(
    readFileSync(resolve(PKI, `${name}.pkcs8.pem`), "utf8"),
    readFileSync(resolve(PKI, `${name}.cert.pem`), "utf8"),
  );
}
function prevInfo(file: string): { version: number; hash: string | null } {
  const jws = resolve(DIST, `${file}.jws`),
    json = resolve(DIST, `${file}.json`);
  if (!existsSync(jws)) return { version: 0, hash: null };
  const v = readJson(json).version as number;
  return { version: v, hash: sha256Tag(utf8(readFileSync(jws, "utf8"))) };
}
/** Atomik yazım: geçici dosya + yeniden adlandırma — servisler ve nginx yarım yazılmış liste okumasın. */
function writeAtomic(path: string, data: string) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}
function writeVersioned(file: string, obj: Record<string, unknown>, jws: string) {
  mkdirSync(ARCHIVE, { recursive: true });
  const json = JSON.stringify(obj, null, 2) + "\n";
  // önce imzalı .jws (doğrulayıcılar onu okur), sonra okunabilir .json kopyası
  writeAtomic(resolve(DIST, `${file}.jws`), jws);
  writeAtomic(resolve(DIST, `${file}.json`), json);
  writeFileSync(resolve(ARCHIVE, `${file}.v${String(obj.version).padStart(4, "0")}.jws`), jws);
}
function changelog(line: string) {
  const f = resolve(DIST, "CHANGELOG.md");
  const head = "# trust.tamga.network — Changelog (public)\n";
  if (!existsSync(f)) writeFileSync(f, `${head}\n`);
  else {
    // eski Türkçe başlık tek seferlik İngilizceye çevrilir; satırların kendisi (geçmiş) olduğu gibi kalır
    const cur = readFileSync(f, "utf8");
    if (cur.startsWith("# trust.tamga.network — Değişiklik")) writeFileSync(f, head + cur.slice(cur.indexOf("\n") + 1));
  }
  appendFileSync(f, `- ${iso(new Date())} — ${line}\n`);
}

/** LoTE'ler: cüzdan sağlayıcıları, erişim sertifikası sağlayıcıları, belge verenler. Tamga listeleriyle aynı imzacı. */
async function writeLotes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lotlSrc: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tlSrc: any,
  cc: string,
  lotlVersion: number,
  tlVersion: number,
  now: Date,
  signerCertDer: Uint8Array,
) {
  const operatorName: string = lotlSrc.operator.name;
  const opContact: LoteContact = lotlSrc.operator.lote_contact;
  const next = plusDays(now, Math.min(180, lotlSrc.next_update_days)); // Ek E: en çok 6 ay
  const defContact = (url: string): LoteContact => ({
    postal: { StreetAddress: "(to be published)", Country: cc },
    electronic: [url],
    info: [url],
  });
  const lotes: LoteInput[] = [
    {
      kind: "wallet-providers",
      sequence: lotlVersion,
      territory: cc,
      operatorName,
      operatorContact: opContact,
      issuedAt: now,
      nextUpdate: next,
      entities: (lotlSrc.wallet_providers as Array<Record<string, any>>) // eslint-disable-line @typescript-eslint/no-explicit-any
        .filter((w) => w.status === "ACTIVE")
        .map((w) => ({
          name: w.legal_name,
          contact: w.lote_contact ?? opContact,
          services: (w.solutions as Array<Record<string, string>>)
            .filter((x) => x.status === "ACTIVE")
            .map((x) => ({
              role: "Issuance" as const,
              name: `Tamga Wallet (${x.solution_id})`,
              certsDer: (w.wua_signing_certs as string[]).map((n) => cert(n).der),
              uniqueId: x.solution_id,
              supplyPoint: "https://wallet.tamga.network",
            })),
        })),
    },
    {
      kind: "wrpac-providers",
      sequence: tlVersion,
      territory: cc,
      operatorName,
      operatorContact: opContact,
      issuedAt: now,
      nextUpdate: next,
      entities: [
        {
          name: operatorName,
          contact: opContact,
          services: (tlSrc.root_cas as Array<{ cert: string; legal_name?: string }>).map((r) => ({
            role: "Issuance" as const,
            name: r.legal_name ?? "Tamga national root CA (provisional)",
            certsDer: [cert(r.cert).der],
          })),
        },
      ],
    },
    {
      kind: "eaa-providers",
      sequence: tlVersion,
      territory: cc,
      operatorName,
      operatorContact: opContact,
      issuedAt: now,
      nextUpdate: next,
      entities: (tlSrc.issuers as Array<Record<string, any>>) // eslint-disable-line @typescript-eslint/no-explicit-any
        .filter((i) => i.status === "ACTIVE")
        .map((i) => ({
          name: typeof i.legal_name === "string" ? i.legal_name : String(Object.values(i.legal_name)[0]),
          contact: i.lote_contact ?? contactFromRegistration(i, cc) ?? defContact(i.issuer_url),
          services: [
            {
              role: "Issuance" as const,
              name: `${i.slug} — attestation issuance`,
              certsDer: [cert(i.cert).der],
              uniqueId: computeIssuerId(cc, cert(i.cert).der),
              supplyPoint: i.issuer_url,
            },
            ...(i.status_cert
              ? [
                  {
                    role: "Revocation" as const,
                    name: `${i.slug} — status list`,
                    certsDer: [cert(i.status_cert).der],
                    supplyPoint: i.status_list_base,
                  },
                ]
              : []),
          ],
        })),
    },
  ];
  const s = await signer();
  mkdirSync(resolve(DIST, "lote"), { recursive: true });
  mkdirSync(ARCHIVE, { recursive: true });
  for (const l of lotes) {
    const obj = buildLote(l);
    const jws = await signJson(s, obj, jadesHeader(signerCertDer, now));
    writeAtomic(resolve(DIST, "lote", `${l.kind}.jws`), jws);
    writeAtomic(resolve(DIST, "lote", `${l.kind}.json`), JSON.stringify(obj, null, 2) + "\n");
    writeFileSync(resolve(ARCHIVE, `lote-${l.kind}.v${String(l.sequence).padStart(4, "0")}.jws`), jws);
  }
}

/**
 * ADR-0026: kayıt sertifikaları — imzalı listeye giren kayıtlardan (WRC1), kayıt kurumu anahtarıyla (WRC2). Her yayında
 * `dist/wrprc/` baştan üretilir (süresi dolan ya da kaldırılan kullanım kalmaz); dizin `wrprc/index.json`.
 */
async function writeWrprcs(
  tl: { relying_parties: Record<string, unknown>[]; issuers: Record<string, unknown>[] },
  lotlSrc: Record<string, unknown>,
  cc: string,
  now: Date,
) {
  const out = resolve(DIST, "wrprc");
  rmSync(out, { recursive: true, force: true });
  const nl = (lotlSrc.national_lists as Array<Record<string, unknown>>).find((n) => n.state_code === cc);
  const reg = (nl?.roles as Record<string, { signing_certs?: string[] }> | undefined)?.registrar;
  const ref = reg?.signing_certs?.[0];
  if (!ref || !existsSync(resolve(PKI, `${ref}.pkcs8.pem`))) {
    console.warn("[uyarı] ADR-0026: kayıt kurumu anahtarı yok — kayıt sertifikası üretilmedi (npm run pki)");
    return;
  }
  const regSigner = await signer(ref);
  const { items, skipped } = buildWrprcPayloads(tl, {
    now,
    registryUri: String(nl?.list_url ?? `https://trust.tamga.network/tl-${cc.toLowerCase()}.jws`),
  });
  for (const w of skipped) console.warn(`[uyarı] ADR-0026 kayıt sertifikası üretilmedi: ${w}`);
  const index = [];
  for (const it of items) {
    const jwt = await signJson(regSigner, it.payload, wrprcHeader(now));
    mkdirSync(dirname(resolve(DIST, it.path)), { recursive: true });
    writeAtomic(resolve(DIST, it.path), jwt);
    const { payload, ...meta } = it;
    index.push({ ...meta, exp: new Date(payload.exp * 1000).toISOString() });
  }
  mkdirSync(out, { recursive: true });
  writeAtomic(resolve(out, "index.json"), JSON.stringify({ generated_at: iso(now), items: index }, null, 2) + "\n");
}

async function build() {
  mkdirSync(DIST, { recursive: true });
  const now = new Date();
  const lotlSrc = readJson(resolve(REG, "lotl.source.json"));
  const schemasIndex = existsSync(SCHEMAS_INDEX)
    ? (readJson(SCHEMAS_INDEX) as Array<{
        vct: string;
        schema_id: string;
        metadata_url: string;
        content_hash: string;
        content_hashes?: string[];
        layer: string;
        status: string;
      }>)
    : [];
  if (schemasIndex.length === 0) throw new Error("packages/schemas/dist/index.json yok — önce `npm run schemas:build`");

  // ---- tl-tr
  const tlSrc = readJson(resolve(REG, "tl-tr.source.json"));
  const cc: string = tlSrc.state_code;
  const rootCas = tlSrc.root_cas.map((r: Record<string, unknown>) => {
    const c = cert(r.cert as string);
    const { cert: _c, ...rest } = r;
    return { ca_id: computeCaId(cc, c.der), ...rest, cert_fingerprint_sha256: c.fp, cert_pem: c.pem.trim() };
  });
  const caIdByRef = new Map<string, string>(
    tlSrc.root_cas.map((r: { cert: string }, i: number) => [r.cert, rootCas[i].ca_id]),
  );
  const issuers = tlSrc.issuers.map((r: Record<string, unknown>) => {
    const c = cert(r.cert as string);
    const {
      cert: _c,
      status_cert,
      parent_ca,
      schema_authorizations,
      ...rest
    } = r as Record<string, unknown> & {
      status_cert?: string;
      parent_ca: string;
      schema_authorizations: Array<{ vct: string; [k: string]: unknown }>;
      delegate_keys?: Array<Record<string, unknown>>;
    };
    // S11: iptal listesi ayrı anahtarla imzalanır; doğrulayıcı imzacıyı bu kayıtla eşler (sahte liste HTTPS'e güvenmeden reddedilir)
    const statusKey = status_cert
      ? [{ fingerprint_sha256: cert(status_cert).fp, purpose: "status_list", status: "ACTIVE" }]
      : [];
    return {
      issuer_id: computeIssuerId(cc, c.der),
      ...rest,
      ...(statusKey.length ? { delegate_keys: [...((rest.delegate_keys as unknown[]) ?? []), ...statusKey] } : {}),
      parent_ca_id: caIdByRef.get(parent_ca),
      cert_fingerprint_sha256: c.fp,
      // ADR-0024 K2: yetki türü sınıftan
      entitlements: (rest.entitlements as string[] | undefined) ?? issuerEntitlements(String(rest.class)),
      schema_authorizations: schema_authorizations.map(({ vct, ...a }) => ({
        schema_id: computeSchemaId(vct),
        vct,
        ...a,
      })),
    };
  });
  const rps = tlSrc.relying_parties.map((r: Record<string, unknown>) => {
    const c = cert(r.access_cert as string);
    const { access_cert: _a, dns_name, ...rest } = r;
    // ADR-0034: kalıcı kimlik = erişim sertifikasının SAN'ındaki alan adı; OpenID4VP client_id = x509_hash (HAIP 1.0 §5)
    const dns = String(dns_name ?? "").toLowerCase();
    if (!dns) throw new Error(`relying_party ${String(r.access_cert)}: dns_name yok`);
    const san = new X509Certificate(c.der).subjectAltName ?? "";
    if (
      !san
        .split(",")
        .map((x) => x.trim())
        .includes(`DNS:${dns}`)
    )
      throw new Error(`relying_party ${dns}: alan adı erişim sertifikasının SAN'ında yok`);
    return {
      rp_id: computeRpId(cc, c.der),
      client_id: x509HashClientId(c.der),
      dns_name: dns,
      ...rest,
      access_cert_fingerprint_sha256: c.fp,
    };
  });
  // ADR-0024 K5: yeni kayıtlarda eksik zorunlu alan → yayın durur; eski kayıtlar için uyarı
  const reg = checkRegistrations(rps, issuers);
  if (reg.errors.length) throw new Error(`ADR-0024: eksik kayıt verisi — ${reg.errors.join("; ")}`);
  for (const w of reg.warnings) console.warn(`[uyarı] ADR-0024 kayıt verisi eksik (pilot öncesi tamamlanmalı): ${w}`);
  const tlPrev = prevInfo(`tl-${cc.toLowerCase()}`);
  const tl = {
    list_format_version: tlSrc.list_format_version,
    list_type: "trusted_list",
    ...(ENVIRONMENT === "sandbox" ? { environment: "sandbox" } : {}),
    state_code: cc,
    version: tlPrev.version + 1,
    issued_at: iso(now),
    next_update: iso(plusDays(now, tlSrc.next_update_days)),
    previous_version_hash: tlPrev.hash,
    operator: tlSrc.operator,
    root_cas: rootCas,
    issuers,
    relying_parties: rps,
    national_schemas: tlSrc.national_schemas,
  };
  const s = await signer();
  writeVersioned(`tl-${cc.toLowerCase()}`, tl, await signJson(s, tl));
  await writeWrprcs(tl, lotlSrc, cc, now);

  // ---- lotl
  const lotlPrev = prevInfo("lotl");
  // Şema kayıt zamanı KALICIDIR: önceki lotl.json'dan, yoksa ilk şema çapasından (D8: çapa = kayıt anı); yeni şema → şimdi.
  // Aksi hâlde her build "since = now" üretir ve eski belgeler C2'de (iat < since) düşer — sahne 10'da bulundu.
  const prevLotlSchemas: Array<{ schema_id: string; registered_at: string; status_history: unknown[] }> = existsSync(
    resolve(DIST, "lotl.json"),
  )
    ? (readJson(resolve(DIST, "lotl.json")).schemas ?? [])
    : [];
  const firstSchemaAnchor = (schemaId: string): string | null => {
    if (!existsSync(resolve(DIST, "anchors.jsonl"))) return null;
    // TL9: ilk şema çapası arşive taşınmış olabilir → tam zincir (kontrol noktaları izlenir)
    for (const line of fullAnchorsJsonl().jsonl.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const pl = JSON.parse(Buffer.from(line.split(".")[1], "base64url").toString("utf8"));
        if (pl.kind === "schema" && pl.schema_id === schemaId) return pl.ts;
      } catch {
        /* atla */
      }
    }
    return null;
  };
  const schemaReg = (schemaId: string) => {
    const prev = prevLotlSchemas.find((x) => x.schema_id === schemaId);
    const at = prev?.registered_at ?? firstSchemaAnchor(schemaId) ?? iso(now);
    return { registered_at: at, status_history: prev?.status_history ?? [{ status: "ACTIVE", since: at }] };
  };
  const national = lotlSrc.national_lists.map((n: Record<string, unknown>) => {
    const { signing_certs, roles, ...rest } = n as Record<string, unknown> & {
      signing_certs?: string[];
      roles?: Record<string, Record<string, unknown>>;
    };
    const out: Record<string, unknown> = { ...rest };
    if (signing_certs) out.signing_keys = signing_certs.map(keyEntry);
    if (roles) {
      out.roles = Object.fromEntries(
        Object.entries(roles).map(([k, v]) => {
          if (v.cert) {
            const { cert: cref, ...rv } = v;
            return [k, { ...rv, ca_id: caIdByRef.get(cref as string) }];
          }
          // ADR-0026 K1: kayıt kurumu anahtarı (WRPRC imzası) parmak iziyle yayınlanır
          if (Array.isArray(v.signing_certs)) {
            const { signing_certs: sc, ...rv } = v;
            return [k, { ...rv, signing_keys: (sc as string[]).map(keyEntry) }];
          }
          return [k, v];
        }),
      );
    }
    return out;
  });
  const lotl = {
    list_format_version: lotlSrc.list_format_version,
    list_type: "lotl",
    ...(ENVIRONMENT === "sandbox" ? { environment: "sandbox" } : {}),
    version: lotlPrev.version + 1,
    issued_at: iso(now),
    next_update: iso(plusDays(now, lotlSrc.next_update_days)),
    previous_version_hash: lotlPrev.hash,
    operator: lotlSrc.operator,
    catalogue: lotlSrc.catalogue,
    anchor_signing_keys: (lotlSrc.anchor_signing_certs as string[]).map(keyEntry),
    national_lists: national,
    schemas: schemasIndex
      .filter((x) => x.layer === "NETWORK")
      .map((x) => ({
        schema_id: x.schema_id,
        vct: x.vct,
        metadata_url: x.metadata_url,
        content_hash: x.content_hash,
        content_hashes: x.content_hashes ?? [x.content_hash],
        layer: "NETWORK",
        governance: "provisional-operator",
        status: "ACTIVE",
        ...schemaReg(x.schema_id),
      })),
    eaa_categories: lotlSrc.eaa_categories,
    wallet_providers: (lotlSrc.wallet_providers as Array<Record<string, unknown>>).map((w) => {
      const { wua_signing_certs, ...rest } = w as Record<string, unknown> & { wua_signing_certs: string[] };
      return { ...rest, wua_signing_keys: wua_signing_certs.map(keyEntry) };
    }),
    pid_providers: lotlSrc.pid_providers,
    // ADR-0032 ZK2: kabul edilen sıfır bilgi ispatı devreleri (Longfellow combined_hash + dosya özeti)
    ...(lotlSrc.zk_circuits ? { zk_circuits: lotlSrc.zk_circuits } : {}),
    // ADR-0036 federasyon: dış listeler (adres + sabit imzacı + kapsam + onay kaydı). Eksik/yer tutuculu kayıt yayını durdurur.
    ...(lotlSrc.external_lists?.length ? { external_lists: externalListsFrom(lotlSrc.external_lists) } : {}),
  };
  writeVersioned("lotl", lotl, await signJson(s, lotl));

  // ---- keys/ (ilan) + şema çapaları
  mkdirSync(resolve(DIST, "keys"), { recursive: true });
  const rootFps = {
    note: "LOTL signing certificate fingerprints — the same values are published at tamga.network/trust-anchor and in the Trust Framework.",
    lotl_signing_keys: (lotlSrc.anchor_signing_certs as string[]).map(keyEntry),
    national_root_cas: rootCas.map((r: { ca_id: string; legal_name: string; cert_fingerprint_sha256: string }) => ({
      ca_id: r.ca_id,
      legal_name: r.legal_name,
      cert_fingerprint_sha256: r.cert_fingerprint_sha256,
    })),
  };
  writeFileSync(resolve(DIST, "keys", "root-fingerprints.json"), JSON.stringify(rootFps, null, 2) + "\n");
  for (const n of ["tl-signer-1", "root-ca", "wallet-provider", "rp-verify"])
    writeFileSync(resolve(DIST, "keys", `${n}.cert.pem`), cert(n).pem);

  // ---- LoTE izdüşümü (ETSI TS 119 602; ARF OIA_15b) — kaynakta açıkken üretilir
  if (lotlSrc.lote?.enabled) await writeLotes(lotlSrc, tlSrc, cc, lotl.version, tl.version, now, s.certDer);

  // Şema çapaları: her yayımlanmış sürüm özeti bir kez (D8 kayıt anı; ADR-0010 K4 yeni küçük sürüm = yeni çapa)
  {
    const anchored = new Set<string>();
    if (existsSync(resolve(DIST, "anchors.jsonl")))
      for (const line of fullAnchorsJsonl().jsonl.split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {
          const pl = JSON.parse(Buffer.from(line.split(".")[1], "base64url").toString("utf8"));
          if (pl.kind === "schema") anchored.add(`${pl.schema_id}|${pl.content_hash}`);
        } catch {
          /* atla */
        }
      }
    for (const x of schemasIndex)
      for (const h of x.content_hashes ?? [x.content_hash])
        if (!anchored.has(`${x.schema_id}|${h}`))
          await appendAnchor({ kind: "schema", schema_id: x.schema_id, vct: x.vct, content_hash: h });
  }
  changelog(
    `build: lotl v${lotl.version}, tl-${cc.toLowerCase()} v${tl.version}; issuers=${issuers.map((i: { slug: string; status: string }) => (i.status === "ACTIVE" ? i.slug : `${i.slug}(${i.status})`)).join(",")}; schemas=${schemasIndex.length}`,
  );
  console.log(
    JSON.stringify(
      {
        lotl: lotl.version,
        [`tl-${cc.toLowerCase()}`]: tl.version,
        issuers: issuers.map((i: { slug: string; issuer_id: string }) => ({ slug: i.slug, issuer_id: i.issuer_id })),
        root_cas: rootCas.map((r: { ca_id: string }) => r.ca_id),
      },
      null,
      2,
    ),
  );
}

type AnchorBody = Anchor extends infer A ? (A extends Anchor ? Omit<A, "seq" | "previous_hash" | "ts"> : never) : never;
/**
 * Süreçler arası kilit: birden fazla servis (issuer, kimlik servisi) aynı çapa günlüğüne yazar. Kilit olmadan
 * "oku → imzala → ekle" arasında başka süreç yazarsa seq/hash zinciri kırılır (2026-09-25 bulgusu). mkdir atomiktir;
 * 30 sn üstü kilit bayat sayılır. Bekleme ≤ 10 sn.
 */
async function withAnchorLock<T>(fn: () => Promise<T>): Promise<T> {
  const lock = resolve(DIST, "anchors.lock");
  const t0 = Date.now();
  for (;;) {
    try {
      mkdirSync(lock);
      break;
    } catch {
      try {
        if (Date.now() - statSync(lock).mtimeMs > 30_000) {
          rmSync(lock, { recursive: true, force: true });
          continue;
        }
      } catch {
        /* yarışta silinmiş olabilir */
      }
      if (Date.now() - t0 > 10_000) throw new Error("anchors: kilit alınamadı (10 sn)");
      await new Promise((r) => setTimeout(r, 50 + Math.floor(Math.random() * 100)));
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}
const ANCHORS_FILE = () => resolve(DIST, "anchors.jsonl");
/** Günlük bu satır sayısını aşınca kontrol noktasıyla arşivlenir (TL12). Yükleme süresi satır sayısıyla doğrusal büyür. */
const ANCHORS_MAX_LINES = Number(process.env.TAMGA_ANCHORS_MAX_LINES ?? 500);
const anchorLines = (file: string) =>
  existsSync(file)
    ? readFileSync(file, "utf8")
        .split(/\r?\n/)
        .filter((l) => l.trim())
    : [];
const payloadOf = (line: string) => JSON.parse(Buffer.from(line.split(".")[1], "base64url").toString("utf8")) as Anchor;

async function appendAnchor(body: AnchorBody) {
  return withAnchorLock(async () => {
    const file = ANCHORS_FILE();
    const lines = anchorLines(file);
    const last = lines.at(-1);
    // seq = son satırın seq'i + 1 (satır sayısı DEĞİL: kontrol noktasından sonra satır sayısı seq'i vermez)
    const seq = last ? payloadOf(last).seq + 1 : 0;
    const prev = last ? sha256Tag(utf8(last)) : null;
    const payload = { seq, previous_hash: prev, ts: iso(new Date()), ...body } as Anchor;
    // İmzalamadan önce biçim denetimi: bozuk bir satır (eksik argüman, geçersiz tarih) günlüğe girerse yükleyici tüm güven
    // setini reddeder (CMP2 DUR) — hatayı, satırı yazmak isteyen komutta yakala
    const chk = AnchorSchema.safeParse(payload);
    if (!chk.success)
      throw new Error(
        `anchors: geçersiz çapa: ${chk.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`,
      );
    const s = await signer();
    const line = await signJson(s, payload);
    appendFileSync(file, line + "\n");
    if (lines.length + 1 > ANCHORS_MAX_LINES) await rotateAnchorsLocked();
    return payload;
  });
}

/**
 * TL12 — kontrol noktasıyla arşivleme (kilit alınmış olmalı). Mevcut satırların hepsi `archive/anchors-<from>-<to>.jsonl`
 * dosyasına taşınır (silinmez; tam geçmiş replay için durur), yeni günlüğün tek satırı imzalı kontrol noktası olur:
 * seq = son arşivlenen + 1, previous_hash = son arşivlenen satırın hash'i → zincir kesintisiz. Sonraki çapa bu satıra bağlanır.
 */
async function rotateAnchorsLocked() {
  const file = ANCHORS_FILE();
  const lines = anchorLines(file);
  if (lines.length < 2) return null;
  const first = payloadOf(lines[0]);
  const last = payloadOf(lines[lines.length - 1]);
  const pad = (n: number) => String(n).padStart(7, "0");
  const name = `anchors-${pad(first.seq)}-${pad(last.seq)}.jsonl`;
  mkdirSync(ARCHIVE, { recursive: true });
  const archivePath = resolve(ARCHIVE, name);
  if (existsSync(archivePath)) throw new Error(`anchors: arşiv zaten var: ${name}`);
  const bytes = lines.join("\n") + "\n";
  const state = snapshotOf(lines); // arşive gidecek satırların ürettiği son durum (yazmadan ÖNCE hesapla)
  writeFileSync(archivePath, bytes);
  const payload: Anchor = {
    seq: last.seq + 1,
    previous_hash: sha256Tag(utf8(lines[lines.length - 1])),
    ts: iso(new Date()),
    kind: "checkpoint",
    archive: {
      file: `archive/${name}`,
      sha256: sha256Tag(utf8(bytes)),
      seq_from: first.seq,
      seq_to: last.seq,
      lines: lines.length,
    },
    state,
  };
  const s = await signer();
  const line = await signJson(s, payload);
  writeAtomic(file, line + "\n");
  changelog(`anchors: ${lines.length} lines (seq ${first.seq}–${last.seq}) → ${name}; checkpoint seq ${payload.seq}`);
  return payload;
}

/**
 * TL12 anlık durum: verilen günlük diliminin ürettiği son durum. Dilim durumlu bir kontrol noktasıyla başlıyorsa oradan devam
 * eder (arşiv okunmaz); durumsuz eski bir kontrol noktasıyla başlıyorsa tam zincir yeniden oynatılır.
 */
function snapshotOf(lines: string[]) {
  const status = new Map<string, Record<string, unknown>>();
  const schemas = new Map<string, Record<string, unknown>>();
  let src = lines;
  const head = lines[0] ? payloadOf(lines[0]) : null;
  if (head?.kind === "checkpoint") {
    if (head.state) {
      for (const r of head.state.status_lists) status.set(r.list_id, r);
      for (const r of head.state.schemas) schemas.set(r.schema_id, r);
      src = lines.slice(1);
    } else
      src = fullAnchorsJsonl()
        .jsonl.split(/\r?\n/)
        .filter((l) => l.trim()); // eski biçim: tam zincirden kur
  }
  for (const l of src) {
    const a = payloadOf(l);
    if (a.kind === "status_list") {
      const prev = status.get(a.list_id) as { list_version?: number } | undefined;
      if (!prev || a.list_version > (prev.list_version ?? -1))
        status.set(a.list_id, {
          list_id: a.list_id,
          issuer_id: a.issuer_id,
          list_uri: a.list_uri,
          content_hash: a.content_hash,
          list_version: a.list_version,
          published_at: a.published_at,
          seq: a.seq,
        });
    } else if (a.kind === "schema")
      schemas.set(a.schema_id, { schema_id: a.schema_id, content_hash: a.content_hash, seq: a.seq });
  }
  return {
    status_lists: [...status.values()] as Array<{
      list_id: string;
      issuer_id: string;
      list_uri: string;
      content_hash: string;
      list_version: number;
      published_at: string;
      seq: number;
    }>,
    schemas: [...schemas.values()] as Array<{ schema_id: string; content_hash: string; seq: number }>,
  };
}

/**
 * Tam geçmiş (TL10 replay): kontrol noktalarını izleyerek arşivleri geriye doğru toplar, her arşivin sha256'sını kontrol
 * noktasındaki değerle karşılaştırır ve tek zincir olarak döndürür (seq 0'dan bugüne).
 */
function fullAnchorsJsonl(): { jsonl: string; archives: string[] } {
  const archives: string[] = [];
  let lines = anchorLines(ANCHORS_FILE());
  for (;;) {
    const head = lines[0] ? payloadOf(lines[0]) : null;
    if (!head || head.kind !== "checkpoint") break;
    const p = resolve(DIST, head.archive.file);
    if (!existsSync(p)) throw new Error(`anchors: arşiv eksik: ${head.archive.file}`);
    const bytes = readFileSync(p, "utf8");
    if (sha256Tag(utf8(bytes)) !== head.archive.sha256)
      throw new Error(`anchors: arşiv hash uyuşmuyor: ${head.archive.file}`);
    archives.unshift(head.archive.file);
    // Kontrol noktası zincirin parçasıdır (sonraki çapa ona bağlanır): arşiv satırları + kontrol noktası + devamı
    lines = [...bytes.split(/\r?\n/).filter((l) => l.trim()), ...lines];
  }
  return { jsonl: lines.join("\n") + (lines.length ? "\n" : ""), archives };
}

function arg(name: string, def?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

/** Operatör kayıt aracı (registry-ops.ts): kaynak dosyayı günceller, CHANGELOG'a yazar, listeyi yeniden imzalar. */
async function registryCommand(cmd: string, args: string[]) {
  const p = resolve(REG, "tl-tr.source.json");
  const src = readJson(p);
  if (cmd === "list") {
    for (const l of summarize(src)) console.log(l);
    return;
  }
  const env: RegistryEnv = {
    now: new Date(),
    certExists: (ref) => existsSync(resolve(PKI, `${ref}.cert.pem`)),
    knownVcts: new Set(
      existsSync(SCHEMAS_INDEX) ? (readJson(SCHEMAS_INDEX) as Array<{ vct: string }>).map((x) => x.vct) : [],
    ),
  };
  const check = args.includes("--check");
  const VALUED = new Set(["--reason", "--invalidates-from"]); // değer alan bayraklar (değerleri konumsal sayılmaz)
  const pos = args.filter((a, k) => !a.startsWith("--") && !VALUED.has(args[k - 1] ?? ""));
  let next: Record<string, unknown>;
  let line: string;
  try {
    if (cmd === "register") {
      const [kind, file] = pos;
      if (!["issuer", "rp"].includes(kind ?? "") || !file)
        throw new RegistryError(["kullanım: register issuer|rp <başvuru.json> [--check]"]);
      const app = readJson(resolve(file));
      next = kind === "issuer" ? addIssuer(src, app, env) : addRelyingParty(src, app, env);
      line = kind === "issuer" ? `issuer ${app.slug}: registered` : `relying_party ${app.dns_name}: registered`;
    } else if (cmd === "scope") {
      const [clientId, file] = pos;
      if (!clientId || !file) throw new RegistryError(["kullanım: scope <dns_name> <kullanım.json> [--check]"]);
      const scope = readJson(resolve(file));
      next = addScope(src, clientId, scope, env);
      line = `relying_party ${clientId}: scope ${scope.scope_id} added`;
    } else if (cmd === "status") {
      const [slug, st] = pos;
      if (!slug || !st)
        throw new RegistryError([
          "kullanım: status <slug> <ACTIVE|SUSPENDED|REVOKED|RETIRED> [--reason r] [--invalidates-from <iso>|valid_from]",
        ]);
      const reason = arg("reason", "operator");
      let inv = arg("invalidates-from");
      if (inv === "valid_from")
        inv = (src.issuers as Array<{ slug: string; valid_from: string }>).find((x) => x.slug === slug)?.valid_from;
      next = setIssuerStatus(src, slug, st, { reason, invalidatesFrom: inv }, env);
      line = `issuer ${slug}: ${st} (${reason}${inv ? `; credentials issued from ${inv} invalid` : ""}) — history kept (status_history)`;
    } else if (cmd === "rp-status") {
      const [dns, st] = pos;
      if (!dns || !st)
        throw new RegistryError(["kullanım: rp-status <dns_name> <ACTIVE|SUSPENDED|REVOKED|RETIRED> [--reason r]"]);
      const reason = arg("reason", "operator");
      next = setRpStatus(src, dns, st, { reason }, env);
      line = `relying_party ${dns}: ${st} (${reason}) — history kept (status_history)`;
    } else if (cmd === "end-use") {
      const [dns, id] = pos;
      if (!dns || !id) throw new RegistryError(["kullanım: end-use <dns_name> <scope_id|group_id>"]);
      next = endRpUse(src, dns, id, env);
      line = `relying_party ${dns}: ${id} ended (valid_until) — record kept`;
    } else {
      const [slug, vct] = pos;
      if (!slug || !vct) throw new RegistryError(["kullanım: authorize <slug> <vct> [--revoke]"]);
      const revoke = args.includes("--revoke");
      next = setAuthorization(src, slug, vct, !revoke, env);
      line = `issuer ${slug}: ${revoke ? "authorization ended" : "authorized"} for ${vct}`;
    }
  } catch (e) {
    if (e instanceof RegistryError) {
      console.error(e.message);
      process.exit(2);
    }
    throw e;
  }
  if (check) {
    console.log(`geçerli (yazılmadı): ${line}`);
    return;
  }
  writeFileSync(p, JSON.stringify(next, null, 2) + "\n");
  changelog(line);
  await build();
  console.log(`tamam: ${line} — liste yeniden imzalandı`);
}

async function verify() {
  const full = process.argv.includes("--full"); // TL10: arşivlerle birlikte seq 0'dan tam zincir
  const nationalListJws: Record<string, string> = {};
  for (const f of readdirSync(DIST)) {
    const m = /^tl-([a-z]{2})\.jws$/.exec(f);
    if (m) nationalListJws[m[1].toUpperCase()] = readFileSync(resolve(DIST, f), "utf8");
  }
  const rootFps = (
    readJson(resolve(DIST, "keys", "root-fingerprints.json")).lotl_signing_keys as Array<{ fingerprint_sha256: string }>
  ).map((k) => k.fingerprint_sha256);
  const anchors = full
    ? fullAnchorsJsonl()
    : { jsonl: existsSync(ANCHORS_FILE()) ? readFileSync(ANCHORS_FILE(), "utf8") : "", archives: [] };
  const { store, report } = await loadTrustSet({
    lotlJws: readFileSync(resolve(DIST, "lotl.jws"), "utf8"),
    nationalListJws,
    anchorsJsonl: anchors.jsonl,
    rootFingerprints: rootFps,
    environment: ENVIRONMENT,
  });
  console.log(
    JSON.stringify(
      { report, full: full ? { archives: anchors.archives } : undefined, store: store.summary() },
      null,
      2,
    ),
  );
  if (!report.healthy) process.exitCode = 2;
}

/** ADR-0036 FD4: kayıt kaynağındaki dış listeleri doğrular (biçim + onay kaydı + yer tutucu yok). */
function externalListsFrom(src: unknown[]) {
  return src.map((x) => {
    if (JSON.stringify(x).includes("[DOLDURULACAK]"))
      throw new Error("external list contains [DOLDURULACAK] — not published");
    const p = ExternalListPointer.parse(x);
    if (!p.approval.ref.trim()) throw new Error(`external list ${p.list_id}: approval reference missing (FD4)`);
    return p;
  });
}

/**
 * ADR-0036: dış listelerin kopyası — özgün adresten çeker, LOTL'daki sabit imzacıya karşı doğrular, okunabilir LoTE olduğunu
 * denetler ve dist/external/<list_id>.jws olarak yazar. Hata olursa eski kopya korunur (uyarı); Tamga listeleri etkilenmez.
 */
async function externalFetch() {
  const lotlSrc = readJson(resolve(REG, "lotl.source.json"));
  const lists = externalListsFrom(lotlSrc.external_lists ?? []);
  if (!lists.length) return console.log("external: kayıtlı dış liste yok");
  mkdirSync(resolve(DIST, "external"), { recursive: true });
  for (const p of lists) {
    if (p.status !== "ACTIVE" || p.format !== "etsi-lote-json") {
      console.log(`external ${p.list_id}: atlandı (${p.status} / ${p.format})`);
      continue;
    }
    try {
      const r = await fetch(p.list_url, { signal: AbortSignal.timeout(15_000) });
      if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
      const jws = (await r.text()).trim();
      const fps = new Set(p.signing_keys.filter((k) => k.status === "ACTIVE").map((k) => k.fingerprint_sha256));
      const v = await verifyJws(jws, fps, { typ: null });
      const lote = parseLote(v.payload);
      writeFileSync(resolve(DIST, "external", `${p.list_id}.jws`), jws + "\n");
      console.log(
        `external ${p.list_id}: #${lote.sequence}, ${lote.entities.length} kurum, NextUpdate ${lote.nextUpdate.toISOString()}`,
      );
    } catch (e) {
      console.warn(`external ${p.list_id}: ${(e as Error).message} — eski kopya korunuyor`);
    }
  }
}

const cmd = process.argv[2];
(async () => {
  if (cmd === "build") await build();
  else if (cmd === "heartbeat") {
    const a = await appendAnchor({ kind: "heartbeat" });
    console.log(JSON.stringify(a));
  } else if (cmd === "anchor") {
    const a = await appendAnchor({
      kind: "status_list",
      list_id: arg("list-id")!,
      issuer_id: arg("issuer-id")!,
      list_uri: arg("list-uri")!,
      content_hash: arg("content-hash")!,
      list_version: Number(arg("list-version")),
      published_at: arg("published-at", iso(new Date()))!,
    });
    console.log(JSON.stringify(a));
  } else if (cmd === "verify") await verify();
  else if (cmd === "external-fetch") await externalFetch();
  else if (cmd === "archive") {
    // TL12: operatör komutu — günlüğü şimdi arşivle (otomatik eşik: TAMGA_ANCHORS_MAX_LINES, varsayılan 500)
    const cp = await withAnchorLock(rotateAnchorsLocked);
    console.log(cp ? JSON.stringify(cp) : "anchors: arşivlenecek satır yok");
  } else if (["register", "scope", "authorize", "list", "status", "rp-status", "end-use"].includes(cmd ?? "")) {
    await registryCommand(cmd!, process.argv.slice(3));
  } else {
    console.error(
      "kullanım: cli.ts build | anchor ... | heartbeat | verify [--full] | archive | external-fetch | status <slug> <STATUS> | rp-status <dns_name> <STATUS> | end-use <dns_name> <id> | register issuer|rp <dosya> | scope <dns_name> <dosya> | authorize <slug> <vct> [--revoke] | list",
    );
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
