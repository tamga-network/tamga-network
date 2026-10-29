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
 *   sandbox-institution add                       (yalnız sandbox; ADR-0041) stdin'den test kurumu isteği (JSON): ara makamla yaprak
 *                                                 sertifikalar, TAMGA_SANDBOX_SELF_DIR'e kayıt, liste imzalanır · sandbox-institution list
 *   wallet-provider list|show|activate|suspend|revoke  cüzdan sağlayıcı kaydı (ADR-0042), gerçek + sandbox kayıt defteri; liste
 *                                                 imzalanmaz (dağıtımda) — ayrıntı walletProviderCommand
 *   wrprc-status                                  (ADR-0068) kayıt sertifikalarının durum listesi girdileri
 *   wrprc-revoke <wrprc/…jwt> --reason r          (ADR-0068) kayıt sertifikasını elle iptal eder; içerik değişene kadar yeniden
 *                                                 verilmez; durum listesi yeniden imzalanır
 *   chain-submit [--dry-run] · chain-check <jws>  zincir projeksiyonu (ADR-0051): liste sürümü + çapa günlüğü başı ÖZETLERİ
 *                                                 zincire; bayrak TAMGA_CHAIN_ENABLED=0 iken yazma yok — src/chain/
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
import { createHash, createPrivateKey, sign as nodeSign, X509Certificate } from "node:crypto";
import { signWrprcCwt } from "@tamga-network/mdoc";
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
  readTrustedListXml,
  ExternalListPointer,
  Anchor as AnchorSchema,
  type Anchor,
} from "@tamga-network/trust";

import { buildLote, contactFromRegistration, jadesHeader, type LoteContact, type LoteInput } from "./lote.js";
import {
  buildTrustedListXml,
  signTrustedListXml,
  tl119612Enabled,
  tlSignerProblems,
  trustedListFromTamga,
} from "./tl119612.js";
import { chainCommand } from "./chain/cli.js";
import { checkRegistrations, issuerEntitlements } from "./registration.js";
import { buildWrprcPayloads, wrprcHeader } from "./wrprc.js";
import {
  assignWrprcStatus,
  emptyState,
  revokeWrprc,
  signWrprcStatusList,
  statusListFile,
  withPolicyAndStatus,
  wrprcConfigProblems,
  type WrprcPolicyConfig,
  type WrprcStatusState,
} from "./wrprc-status.js";
import {
  MAX_TEST_INSTITUTIONS,
  TEST_CA,
  issueLeaf,
  issuedByTestCa,
  nameProblems,
  reservedNamesOf,
  sb1Problem,
  sharedWalletProviderFps,
  subjects,
  testInstitutionSource,
  validateRequest,
  type TestInstitutionRequest,
} from "./sandbox-institutions.js";
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
import {
  activateWalletProvider,
  certSummary,
  inspectWalletProviderCert,
  providerOrgIdProblems,
  lineDiff,
  setWalletProviderStatus,
  summarizeWalletProviders,
  walletProviderCertName,
  type WpEnvironment,
} from "./wallet-provider-ops.js";
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
/** ADR-0041: sandbox test kurumlarının klasörü (anahtarlar `pki/`, kayıtlar `issuers.json`); yalnız sandbox kayıt defteriyle okunur. */
const SELF_DIR = process.env.TAMGA_SANDBOX_SELF_DIR ? resolve(process.env.TAMGA_SANDBOX_SELF_DIR) : null;
const SELF_FILE = () => (SELF_DIR ? resolve(SELF_DIR, "issuers.json") : null);
function selfIssuers(): Array<Record<string, unknown>> {
  const f = SELF_FILE();
  if (ENVIRONMENT !== "sandbox" || !f || !existsSync(f)) return [];
  return (readJson(f).issuers ?? []) as Array<Record<string, unknown>>;
}

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const iso = (d: Date) => d.toISOString();
const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);
/**
 * ADR-0042 uygulama notu (2026-10-07): ayrı cüzdan sandbox'ı yoktur — bir cüzdan sağlayıcı gerçek ve sandbox listesinde AYNI
 * kayıtla (aynı provider_id, aynı WUA sertifikası) yer alabilir. Bu yüzden sandbox listesinde gerçek sertifikaya (SB1 istisnası)
 * yalnız, gerçek kayıt defterinde de aynı provider_id ile kayıtlı bir cüzdan sağlayıcının, gerçek ağın yayınlanmış listesinde
 * de bulunan WUA sertifikası (parmak izi eşleşmesi) için izin verilir; gerçek ağda anahtarı yoksa izin yok.
 */
/** Gerçek ağın ve sandbox'ın kayıt defteri (cüzdan sağlayıcı komutu iki listeyi birlikte yazar; testler geçici klasör verir). */
const PROD_REG = resolve(process.env.TAMGA_TP_PROD_REGISTRY ?? resolve(app, "registry"));
const SANDBOX_REG = resolve(process.env.TAMGA_TP_SANDBOX_REGISTRY ?? resolve(app, "registry-sandbox"));
const SHARED_WALLET_PROVIDERS = (() => {
  const reg = resolve(PROD_REG, "lotl.source.json");
  const pub = resolve(process.env.TAMGA_TP_PROD_DIST ?? resolve(app, "dist"), "lotl.json");
  return sharedWalletProviderFps(
    existsSync(reg) ? JSON.parse(readFileSync(reg, "utf8")) : undefined,
    existsSync(pub) ? JSON.parse(readFileSync(pub, "utf8")) : undefined,
  );
})();
function cert(name: string, opts: { sharedWalletProvider?: string } = {}) {
  // ADR-0041: `self:<ad>` = sandbox test kurumu sertifikası (TAMGA_SANDBOX_SELF_DIR/pki); yalnız test kurumları ara makamınca
  // imzalanmışsa (TI1) ve yalnız sandbox kayıt defteriyle
  const self = name.startsWith("self:");
  if (self && (ENVIRONMENT !== "sandbox" || !SELF_DIR))
    throw new Error(`TI1: ${name} yalnız sandbox'ta (TAMGA_SANDBOX_SELF_DIR)`);
  const pem = readFileSync(
    self ? resolve(SELF_DIR!, "pki", `${name.slice(5)}.cert.pem`) : resolve(PKI, `${name}.cert.pem`),
    "utf8",
  );
  if (self && !issuedByTestCa(pem, readFileSync(resolve(PKI, `${TEST_CA}.cert.pem`), "utf8")))
    throw new Error(`TI1: ${name} test kurumları ara makamınca imzalanmamış`);
  const der = pemToDer(pem);
  // ADR-0038 SB1: test sertifikası gerçek listeye, gerçek sertifika sandbox listesine girmez (ADR-0042 istisnası: sb1Problem)
  const fp = certFingerprintSha256Hex(der);
  const problem = sb1Problem({
    name,
    isTest: /\(TEST\)/.test(new X509Certificate(der).subject),
    environment: ENVIRONMENT,
    fingerprint: fp,
    sharedWalletProvider: opts.sharedWalletProvider,
    shared: SHARED_WALLET_PROVIDERS,
  });
  if (problem) throw new Error(problem);
  return { pem, der, fp };
}
function keyEntry(name: string, opts: { sharedWalletProvider?: string } = {}) {
  const c = cert(name, opts);
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
            // ADR-0042 NW4: cüzdan adı ve adresi kod içinde sabit değil, kayıt verisinden (lote_service_name, lote_supply_point)
            .map((x) => ({
              role: "Issuance" as const,
              name: x.lote_service_name ?? `${w.legal_name} (${x.solution_id})`,
              certsDer: (w.wua_signing_certs as string[]).map(
                (n) => cert(n, { sharedWalletProvider: w.provider_id }).der,
              ),
              uniqueId: x.solution_id,
              ...(w.lote_supply_point ? { supplyPoint: w.lote_supply_point as string } : {}),
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
 * ETSI TS 119 612 XML görünümü (ADR-0066 taslağı): imzalanmış `tl` + `lotl` nesnelerinden (aynı sürüm) XAdES-B-B imzalı
 * `tl-<cc>.xml`, özet dosyası `tl-<cc>.sha2` (TS 119 612 §6.1) ve arşiv kopyası. İmzacı `TAMGA_TL119612_SIGNER` (PKI'daki
 * sertifika adı; varsayılan liste imzacısı). Gerçek ağda §5.7.1 imzacı profili ya da eksik yayın verisi yayını durdurur;
 * sandbox ve testte uyarıdır.
 */
function writeTl119612(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tl: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lotl: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tlSrc: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lotlSrc: any,
  sourceIssuers: Array<Record<string, unknown>>,
  cc: string,
  now: Date,
) {
  const byFp = new Map<string, Uint8Array>();
  const add = (name: unknown, opts: { sharedWalletProvider?: string } = {}) => {
    if (typeof name !== "string" || !name) return;
    const c = cert(name, opts);
    byFp.set(c.fp, c.der);
  };
  for (const r of tlSrc.root_cas as Array<{ cert: string }>) add(r.cert);
  for (const i of sourceIssuers) {
    add(i.cert);
    add(i.status_cert);
  }
  for (const w of lotlSrc.wallet_providers as Array<{ provider_id: string; wua_signing_certs?: string[] }>)
    for (const n of w.wua_signing_certs ?? []) add(n, { sharedWalletProvider: w.provider_id });
  const slot = (lotl.national_lists as Array<{ state_code: string; list_url?: string }>).find(
    (n) => n.state_code === cc,
  );
  const url = slot?.list_url
    ? slot.list_url.replace(/\.jws$/, ".xml")
    : `https://trust.tamga.network/tl-${cc.toLowerCase()}.xml`;
  const { input, problems } = trustedListFromTamga(tl, lotl, {
    certByFingerprint: (fp) => byFp.get(fp),
    distributionPoint: url,
    operatorContact: lotlSrc.operator?.lote_contact,
  });
  const signerName = process.env.TAMGA_TL119612_SIGNER ?? "tl-signer-1";
  const signerCert = cert(signerName);
  const prof = tlSignerProblems(signerCert.der, { territory: cc, operatorName: input.operatorName });
  const errors = [...problems, ...prof.errors.map((e) => `TS 119 612 §5.7.1 imzacı ${signerName}: ${e}`)];
  for (const w of prof.warnings) console.warn(`[uyarı] TS 119 612 imzacı ${signerName}: ${w}`);
  if (errors.length && ENVIRONMENT === "production")
    throw new Error(`TS 119 612 XML yayınlanmadı (ADR-0066 taslağı): ${errors.join("; ")}`);
  for (const e of errors) console.warn(`[uyarı] TS 119 612 XML: ${e}`);
  const xml = signTrustedListXml(
    buildTrustedListXml(input),
    { keyPem: readFileSync(resolve(PKI, `${signerName}.pkcs8.pem`), "utf8"), certDer: signerCert.der },
    now,
  );
  const file = `tl-${cc.toLowerCase()}`;
  mkdirSync(ARCHIVE, { recursive: true });
  writeAtomic(resolve(DIST, `${file}.xml`), xml);
  // §6.1: aynı yerde, ikili dosyanın SHA-256 özeti (.xml → .sha2); kimlik doğrulamaz, yalnız değişikliği gösterir
  writeAtomic(resolve(DIST, `${file}.sha2`), createHash("sha256").update(xml, "utf8").digest("hex") + "\n");
  writeFileSync(resolve(ARCHIVE, `${file}.v${String(tl.version).padStart(4, "0")}.xml`), xml);
  mkdirSync(resolve(DIST, "keys"), { recursive: true });
  writeFileSync(resolve(DIST, "keys", `${signerName}.cert.pem`), signerCert.pem);
  changelog(`build: ${file}.xml (ETSI TS 119 612, TSLSequenceNumber ${tl.version})`);
}

/** alan adı → erişim sertifikasının organizationIdentifier'ı (2.5.4.97; EN 319 412-1); build() doldurur */
const orgIdByDns = new Map<string, string | null>();
function certOrgIdentifier(der: Uint8Array): string | null {
  const line = new X509Certificate(der).subject
    .split("\n")
    .find((l) => /^(organizationIdentifier|2\.5\.4\.97)=/.test(l));
  return line ? line.slice(line.indexOf("=") + 1) : null;
}

/** ADR-0068: kayıt defterindeki WRPRC politika + durum listesi ayarı (`roles.registrar.wrprc`); yoksa null, hatalıysa yayın durur. */
function wrprcPolicy(
  lotlSrc: Record<string, unknown>,
  cc: string,
  nl?: Record<string, unknown>,
): WrprcPolicyConfig | null {
  const n =
    nl ?? (lotlSrc.national_lists as Array<Record<string, unknown>>).find((x) => x.state_code === cc) ?? undefined;
  const cfg = (n?.roles as Record<string, { wrprc?: unknown }> | undefined)?.registrar?.wrprc;
  if (cfg === undefined) return null;
  const base = new URL(String(n?.list_url ?? `https://trust.tamga.network/tl-${cc.toLowerCase()}.jws`)).origin;
  const problems = wrprcConfigProblems(cfg, base);
  if (problems.length) throw new Error(`ADR-0068: ${problems.join("; ")}`);
  return cfg as WrprcPolicyConfig;
}
const WRPRC_STATE_FILE = () => resolve(DIST, "wrprc-status.json");
function readWrprcState(pol: WrprcPolicyConfig): WrprcStatusState {
  const f = WRPRC_STATE_FILE();
  if (!existsSync(f)) return emptyState(pol.status_list_uri);
  const s = readJson(f) as WrprcStatusState;
  // adres değişirse yeni liste: eski indeksler eski listede kalır (yeni liste boş başlar)
  return s.list_uri === pol.status_list_uri ? s : emptyState(pol.status_list_uri);
}
/** Durumu ve imzalı durum listesini yazar (ADR-0068 K3; kayıt kurumu anahtarı, `statuslist+jwt`). */
async function publishWrprcStatus(
  state: WrprcStatusState,
  pol: WrprcPolicyConfig,
  regSigner: Awaited<ReturnType<typeof signer>>,
  now: Date,
) {
  const token = await signWrprcStatusList(state, regSigner, now, new URL(pol.status_list_uri).origin);
  const file = resolve(DIST, statusListFile(pol));
  mkdirSync(dirname(file), { recursive: true });
  writeAtomic(file, token);
  writeAtomic(WRPRC_STATE_FILE(), JSON.stringify(state, null, 2) + "\n");
}
/** Kayıt kurumu imzacısı (LOTL `roles.registrar.signing_certs[0]`); anahtar yoksa null. */
async function registrarSigner(lotlSrc: Record<string, unknown>, cc: string) {
  const nl = (lotlSrc.national_lists as Array<Record<string, unknown>>).find((n) => n.state_code === cc);
  const ref = (nl?.roles as Record<string, { signing_certs?: string[] }> | undefined)?.registrar?.signing_certs?.[0];
  return ref && existsSync(resolve(PKI, `${ref}.pkcs8.pem`)) ? signer(ref) : null;
}
/**
 * Heartbeat'te durum listesini yeniden imzalar (ADR-0068 K3: `exp` 24 saat, `ttl` 1 saat; durum değişmez). Ayar ya da anahtar
 * yoksa hiçbir şey yapmaz.
 */
async function refreshWrprcStatus(now = new Date()) {
  if (!existsSync(resolve(REG, "lotl.source.json")) || !existsSync(WRPRC_STATE_FILE())) return;
  const lotlSrc = readJson(resolve(REG, "lotl.source.json"));
  const cc = String(readJson(resolve(REG, "tl-tr.source.json")).state_code);
  const pol = wrprcPolicy(lotlSrc, cc);
  const s = pol ? await registrarSigner(lotlSrc, cc) : null;
  if (!pol || !s) return;
  await publishWrprcStatus(readWrprcState(pol), pol, s, now);
}
/** `wrprc-status` (liste) · `wrprc-revoke <yol> --reason r` (ADR-0068 K4; TS 119 475 REV-6.2.3.9-05/06). */
async function wrprcStatusCommand(cmd: string, args: string[]) {
  const lotlSrc = readJson(resolve(REG, "lotl.source.json"));
  const cc = String(readJson(resolve(REG, "tl-tr.source.json")).state_code);
  const pol = wrprcPolicy(lotlSrc, cc);
  if (!pol) throw new Error("ADR-0068: bu kayıt defterinde roles.registrar.wrprc ayarı yok");
  const state = readWrprcState(pol);
  if (cmd === "wrprc-status") {
    console.log(`${pol.status_list_uri} — ${state.entries.length} girdi`);
    for (const e of state.entries)
      console.log(`  ${String(e.idx).padStart(6)} ${e.status.padEnd(7)} ${e.path}${e.reason ? ` (${e.reason})` : ""}`);
    return;
  }
  const k = args.indexOf("--reason");
  const reason = k >= 0 ? (args[k + 1] ?? "") : "";
  const path = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--reason");
  if (!path) throw new Error("kullanım: wrprc-revoke <wrprc/rp/…/…jwt | wrprc/issuer/….jwt> --reason <gerekçe>");
  const s = await registrarSigner(lotlSrc, cc);
  if (!s) throw new Error("ADR-0068: kayıt kurumu anahtarı yok — iptal listesi imzalanamaz");
  const now = new Date();
  const r = revokeWrprc(state, path, reason, now);
  await publishWrprcStatus(r.state, pol, s, now);
  changelog(`wrprc-status: idx ${r.entry.idx} (${path}) REVOKED — ${r.entry.reason}`);
  console.log(`wrprc-revoke: ${path} idx ${r.entry.idx} iptal edildi; liste yeniden imzalandı`);
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
  // ADR-0026 K5 (0.6.0): yakın alan için aynı yükün CBOR biçimi (`rc-wrp+cwt`, ETSI TS 119 475 §5.2.3) — okuyucu
  // `requestInfo.euWrprc` ile gönderir
  const regKey = createPrivateKey(readFileSync(resolve(PKI, `${ref}.pkcs8.pem`), "utf8"));
  const regChain = [pemToDer(readFileSync(resolve(PKI, `${ref}.cert.pem`), "utf8"))];
  const { items, skipped } = buildWrprcPayloads(tl, {
    now,
    orgIdOf: (dns) => orgIdByDns.get(String(dns).toLowerCase()),
    registryUri: String(nl?.list_url ?? `https://trust.tamga.network/tl-${cc.toLowerCase()}.jws`),
  });
  for (const w of skipped) console.warn(`[uyarı] ADR-0026 kayıt sertifikası üretilmedi: ${w}`);
  // ADR-0068: politika kimliği + durum listesi girdisi (ayar yalnız kayıt defterinde varsa; yoksa alanlar eklenmez)
  const pol = wrprcPolicy(lotlSrc, cc, nl);
  if (pol) {
    for (const it of items)
      it.payload = { ...it.payload, policy_id: [...pol.policy_id], certificate_policy: pol.certificate_policy };
    const r = assignWrprcStatus(readWrprcState(pol), items, now);
    for (const p of r.blocked)
      console.warn(`[uyarı] ADR-0068: ${p} elle iptal edildi — içerik değişmeden yeniden verilmez`);
    for (const e of r.revoked) changelog(`wrprc-status: idx ${e.idx} (${e.path}) REVOKED — ${e.reason}`);
    const out = [];
    for (const it of items) {
      const idx = r.idxOf.get(it.path);
      if (idx === undefined) continue;
      it.payload = withPolicyAndStatus(it.payload, pol, idx);
      out.push(it);
    }
    items.splice(0, items.length, ...out);
    await publishWrprcStatus(r.state, pol, regSigner, now);
  }
  const index = [];
  for (const it of items) {
    const jwt = await signJson(regSigner, it.payload, wrprcHeader(now));
    mkdirSync(dirname(resolve(DIST, it.path)), { recursive: true });
    writeAtomic(resolve(DIST, it.path), jwt);
    const cwtPath = it.path.replace(/\.jwt$/, ".cwt");
    const cwt = await signWrprcCwt({
      payload: it.payload,
      x5chain: regChain,
      sign: (tbs) => new Uint8Array(nodeSign("sha256", tbs, { key: regKey, dsaEncoding: "ieee-p1363" })),
    });
    writeFileSync(resolve(DIST, cwtPath), cwt);
    const { payload, ...meta } = it;
    index.push({ ...meta, cwt_path: cwtPath, exp: new Date(payload.exp * 1000).toISOString() });
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
  // ADR-0041: sandbox'ta kendi kendine açılmış test kurumları kaynağa eklenir (gece sıfırlamasında klasörle birlikte silinir — TI5)
  const sourceIssuers: typeof tlSrc.issuers = [...tlSrc.issuers, ...selfIssuers()];
  const issuers = sourceIssuers.map((r: Record<string, unknown>) => {
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
  orgIdByDns.clear();
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
    // ADR-0058 AC1 (ETSI TS 119 411-8 GEN-6.6.1-07): etkin doğrulayıcının erişim sertifikası SAN'da iletişim bilgisi taşır
    if (ENVIRONMENT !== "sandbox" && r.status === "ACTIVE" && !/(^|,\s*)(URI|email):/.test(san))
      console.warn(
        `[uyarı] ADR-0058 AC1: ${dns} erişim sertifikasının SAN'ında iletişim bilgisi yok (pki-issue --contact-uri ile yeniden verin)`,
      );
    // ADR-0026 K3: kayıt sertifikası erişim sertifikasındaki kurum kimlik numarasına bağlanır (writeWrprcs denetler)
    orgIdByDns.set(dns, certOrgIdentifier(c.der));
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
  // ADR-0036 (yalnız sandbox kaynağında bulunur): kayıt defterinin kendi barındırdığı dış liste kaynakları (ör. OpenID uyum
  // öz-testi için test PID sağlayıcısının imzalı LoTE'si) yayına kopyalanır; `external-fetch` onları yayın adresinden çekip
  // LOTL'daki sabit imzacıya karşı doğrular (kopya doğrulanmadan kullanılmaz)
  const extSrc = resolve(REG, "external-src");
  if (existsSync(extSrc)) {
    mkdirSync(resolve(DIST, "external-src"), { recursive: true });
    for (const f of readdirSync(extSrc))
      if (/^[a-z0-9-]+\.(jws|xml)$/.test(f))
        writeAtomic(resolve(DIST, "external-src", f), readFileSync(resolve(extSrc, f), "utf8"));
  }

  // ---- lotl
  const lotlPrev = prevInfo("lotl");
  // Şema kayıt zamanı KALICIDIR: önceki lotl.json'dan, yoksa ilk şema çapasından (D8: çapa = kayıt anı); yeni şema → şimdi.
  // Aksi hâlde her build "since = now" üretir ve eski belgeler C2'de (iat < since) düşer — sahne 10'da bulundu.
  const prevLotlSchemas: Array<{ schema_id: string; registered_at: string; status_history: unknown[] }> = existsSync(
    resolve(DIST, "lotl.json"),
  )
    ? (readJson(resolve(DIST, "lotl.json")).schemas ?? [])
    : [];
  // TL9: ilk şema çapası arşive taşınmış olabilir → tam zincir (kontrol noktaları izlenir). Build başına bir kez okunur.
  const schemaAnchors: Array<{ schema_id: string; content_hash: string; ts: string }> = [];
  if (existsSync(ANCHORS_FILE()))
    for (const line of fullAnchorsJsonl().jsonl.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const pl = JSON.parse(Buffer.from(line.split(".")[1], "base64url").toString("utf8"));
        if (pl.kind === "schema") schemaAnchors.push(pl);
      } catch {
        /* atla */
      }
    }
  const firstSchemaAnchor = (schemaId: string): string | null =>
    schemaAnchors.find((a) => a.schema_id === schemaId)?.ts ?? null;
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
    if (signing_certs) out.signing_keys = signing_certs.map((n) => keyEntry(n));
    if (roles) {
      out.roles = Object.fromEntries(
        Object.entries(roles).map(([k, v]) => {
          if (v.cert) {
            const { cert: cref, ...rv } = v;
            return [k, { ...rv, ca_id: caIdByRef.get(cref as string) }];
          }
          // ADR-0026 K1: kayıt kurumu anahtarı (WRPRC imzası) parmak iziyle yayınlanır
          if (Array.isArray(v.signing_certs)) {
            // ADR-0068: `wrprc` (politika + durum listesi ayarı) yayıncının iç ayarıdır, LOTL'e girmez
            const { signing_certs: sc, wrprc: _w, ...rv } = v;
            return [k, { ...rv, signing_keys: (sc as string[]).map((n) => keyEntry(n)) }];
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
    anchor_signing_keys: (lotlSrc.anchor_signing_certs as string[]).map((n) => keyEntry(n)),
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
      // lote_supply_point / solutions[].lote_service_name yalnız LoTE çıktısı içindir; LoTL JSON'a girmez
      const {
        wua_signing_certs,
        lote_supply_point: _sp,
        ...rest
      } = w as Record<string, unknown> & {
        wua_signing_certs: string[];
      };
      const solutions = (rest.solutions as Array<Record<string, unknown>> | undefined)?.map(
        ({ lote_service_name: _n, ...s }) => s,
      );
      return {
        ...rest,
        ...(solutions ? { solutions } : {}),
        wua_signing_keys: wua_signing_certs.map((n) =>
          keyEntry(n, { sharedWalletProvider: rest.provider_id as string }),
        ),
      };
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
    lotl_signing_keys: (lotlSrc.anchor_signing_certs as string[]).map((n) => keyEntry(n)),
    national_root_cas: rootCas.map((r: { ca_id: string; legal_name: string; cert_fingerprint_sha256: string }) => ({
      ca_id: r.ca_id,
      legal_name: r.legal_name,
      cert_fingerprint_sha256: r.cert_fingerprint_sha256,
    })),
  };
  writeFileSync(resolve(DIST, "keys", "root-fingerprints.json"), JSON.stringify(rootFps, null, 2) + "\n");
  // Yalnız listenin gerçekten andığı sertifikalar ilan edilir (ADR-0042: gerçek ağda cüzdan sağlayıcı anahtarı yok — RESERVED
  // kayıt boş `wua_signing_certs`). Sandbox test cüzdan sağlayıcısı (TAMGA-SANDBOX-TEST-WP) `wallet-provider`'ı anar.
  const published = new Set<string>([
    ...(lotlSrc.anchor_signing_certs as string[]),
    ...(tlSrc.root_cas as Array<{ cert: string }>).map((r) => r.cert),
    ...(tlSrc.relying_parties as Array<{ access_cert: string }>).map((r) => r.access_cert),
    ...(lotlSrc.wallet_providers as Array<{ wua_signing_certs?: string[] }>).flatMap((w) => w.wua_signing_certs ?? []),
  ]);
  for (const f of readdirSync(resolve(DIST, "keys")))
    if (f.endsWith(".cert.pem") && !published.has(f.slice(0, -".cert.pem".length)))
      rmSync(resolve(DIST, "keys", f), { force: true });
  const wpOfCert = new Map<string, string>();
  for (const w of lotlSrc.wallet_providers as Array<{ provider_id: string; wua_signing_certs?: string[] }>)
    for (const n of w.wua_signing_certs ?? []) wpOfCert.set(n, w.provider_id);
  for (const n of published)
    writeFileSync(resolve(DIST, "keys", `${n}.cert.pem`), cert(n, { sharedWalletProvider: wpOfCert.get(n) }).pem);

  // ---- zk/ (ADR-0032): listedeki devre dosyaları `zk/<circuit_id>.zst` — cüzdanlar buradan indirir ve listedeki özetle
  // denetler. Kaynak: doğrulayıcı paketinin devreleri; özet tutmazsa yayın durur. Listede olmayan eski dosya silinir.
  {
    const circuitsDir = resolve(app, "..", "..", "packages", "verifier", "src", "zk", "circuits");
    const entries = (lotlSrc.zk_circuits ?? []) as Array<{ circuit_id: string; sha256: string }>;
    mkdirSync(resolve(DIST, "zk"), { recursive: true });
    const keep = new Set(entries.map((c) => `${c.circuit_id}.zst`));
    for (const f of readdirSync(resolve(DIST, "zk"))) if (!keep.has(f)) rmSync(resolve(DIST, "zk", f), { force: true });
    for (const c of entries) {
      if (!/^[0-9a-f]{64}$/.test(c.circuit_id)) throw new Error(`zk_circuits: geçersiz circuit_id ${c.circuit_id}`);
      const bytes = readFileSync(resolve(circuitsDir, `${c.circuit_id}.zst`));
      if (createHash("sha256").update(bytes).digest("hex") !== c.sha256)
        throw new Error(`zk_circuits: ${c.circuit_id} dosyasının özeti listedekiyle tutmuyor`);
      writeFileSync(resolve(DIST, "zk", `${c.circuit_id}.zst`), bytes);
    }
  }

  // ---- LoTE izdüşümü (ETSI TS 119 602; ARF OIA_15b) — kaynakta açıkken üretilir
  if (lotlSrc.lote?.enabled) await writeLotes(lotlSrc, tlSrc, cc, lotl.version, tl.version, now, s.certDer);

  // ---- ETSI TS 119 612 XML görünümü (ADR-0066 taslağı, Proposed) — varsayılan KAPALI: yalnız TAMGA_TL119612=1
  if (tl119612Enabled()) writeTl119612(tl, lotl, tlSrc, lotlSrc, sourceIssuers, cc, now);

  // Şema çapaları: her yayımlanmış sürüm özeti bir kez (D8 kayıt anı; ADR-0010 K4 yeni küçük sürüm = yeni çapa)
  {
    const anchored = new Set<string>(schemaAnchors.map((a) => `${a.schema_id}|${a.content_hash}`));
    for (const x of schemasIndex)
      for (const h of x.content_hashes ?? [x.content_hash])
        if (!anchored.has(`${x.schema_id}|${h}`))
          await appendAnchor({ kind: "schema", schema_id: x.schema_id, vct: x.vct, content_hash: h });
  }
  const wps = (lotlSrc.wallet_providers as Array<{ provider_id: string; status: string }>)
    .map((w) => (w.status === "ACTIVE" ? w.provider_id : `${w.provider_id}(${w.status})`))
    .join(",");
  changelog(
    `build: lotl v${lotl.version}, tl-${cc.toLowerCase()} v${tl.version}; issuers=${issuers.map((i: { slug: string; status: string }) => (i.status === "ACTIVE" ? i.slug : `${i.slug}(${i.status})`)).join(",")}; wallet_providers=${wps}; schemas=${schemasIndex.length}`,
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
  return withDirLock("anchors.lock", fn);
}
/** Aynı kilit düzeni, başka bir ad için (ADR-0041: test kurumu kaydı + liste imzası tek seferde bir süreç). */
async function withDirLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const lock = resolve(DIST, name);
  mkdirSync(DIST, { recursive: true }); // ilk derlemede (yeni klon) çıktı klasörü henüz yok
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
      if (Date.now() - t0 > 10_000) throw new Error(`${name}: kilit alınamadı (10 sn)`);
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
    // Ekleme tamamlandı; arşivleme ayrı adımdır. Arşivleme hatası eklenmiş çapayı geri almaz ve komutu düşürmez
    // (günlük geçerli kalır, bir sonraki eklemede ya da `trust:archive` ile yeniden denenir).
    if (lines.length + 1 > ANCHORS_MAX_LINES)
      try {
        await rotateAnchorsLocked();
      } catch (e) {
        console.warn(`[uyarı] anchors: arşivleme yapılamadı, sonra yeniden denenecek — ${(e as Error).message}`);
      }
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
  const bytes = lines.join("\n") + "\n";
  mkdirSync(ARCHIVE, { recursive: true });
  // Ad çakışması: aynı içerik = yarıda kalmış önceki arşivleme (dosya yazıldı, kontrol noktası yazılamadı) → aynı dosya
  // yeniden kullanılır. Farklı içerik = günlük sıfırlanmış (sandbox gece sıfırlaması, seq yeniden 0) → ada zaman eki konur;
  // eski arşiv ezilmez.
  let name = `anchors-${pad(first.seq)}-${pad(last.seq)}.jsonl`;
  const existing = resolve(ARCHIVE, name);
  const reuse = existsSync(existing) && readFileSync(existing, "utf8") === bytes;
  if (existsSync(existing) && !reuse) name = `anchors-${pad(first.seq)}-${pad(last.seq)}-${Date.now()}.jsonl`;
  const archivePath = resolve(ARCHIVE, name);
  if (!reuse && existsSync(archivePath)) throw new Error(`anchors: arşiv zaten var: ${name}`);
  const state = snapshotOf(lines); // arşive gidecek satırların ürettiği son durum (yazmadan ÖNCE hesapla)
  if (!reuse) writeAtomic(archivePath, bytes);
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

/** Kaynak JSON'u depodaki biçimle (prettier, .prettierrc) yazar; prettier yoksa düz JSON. */
async function formatJson(obj: unknown, filepath: string): Promise<string> {
  const raw = JSON.stringify(obj, null, 2) + "\n";
  try {
    const prettier = await import("prettier");
    return await prettier.format(raw, { ...((await prettier.resolveConfig(filepath)) ?? {}), filepath });
  } catch {
    return raw;
  }
}

/**
 * Cüzdan sağlayıcı kaydı (ADR-0042) — gerçek ve sandbox kayıt defterinde `wallet_providers[]`. Liste İMZALANMAZ: gerçek liste
 * ağ sunucusunda dağıtımda (`deploy.sh` → trust:build), sandbox listesi aynı dağıtımda `sandbox-setup.sh refresh` ile imzalanır.
 *   wallet-provider list|show [--id <provider_id>] [--registry registry|registry-sandbox|both]
 *   wallet-provider check --id <provider_id> --cert <pem> [--registry …]   sertifikayı denetler, hiçbir şey yazmaz (anahtar
 *                                                 yenilemede yeni sertifika için; ops/README.md "Cüzdan sağlayıcı imza sertifikasını yenileme")
 *   wallet-provider activate --id <provider_id> --cert <pem> [--registry …] [--prod-pki <dir>] [--sandbox-pki <dir>] [--dry-run]
 *   wallet-provider suspend|revoke --id <provider_id> [--reason r] [--registry …] [--dry-run]
 * Sertifika `<pki>/wallet-provider-<provider_id küçük harf>.cert.pem` olarak yazılır (yalnız sertifika). Gerçek ağın PKI klasörü
 * depo dışındadır: `--prod-pki` ya da `TAMGA_PROD_PKI_DIR` (zorunlu); sandbox `ops/pki-sandbox` (depoda izlenir).
 */
async function walletProviderCommand(sub: string | undefined, args: string[]) {
  const val = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const dry = args.includes("--dry-run");
  const which = val("registry") ?? "both";
  const usage =
    "kullanım: wallet-provider list|show [--id <provider_id>] | check|activate --id <provider_id> --cert <pem> | suspend|revoke --id <provider_id> [--reason r]; ortak: [--registry registry|registry-sandbox|both] [--dry-run]";
  if (!["registry", "registry-sandbox", "both"].includes(which))
    throw new RegistryError(["--registry: registry | registry-sandbox | both"]);
  const envs: WpEnvironment[] =
    which === "both" ? ["production", "sandbox"] : which === "registry" ? ["production"] : ["sandbox"];
  const regDir = (e: WpEnvironment) => (e === "production" ? PROD_REG : SANDBOX_REG);
  const srcFile = (e: WpEnvironment) => resolve(regDir(e), "lotl.source.json");
  const load = (e: WpEnvironment) => {
    const f = srcFile(e);
    if (!existsSync(f)) throw new RegistryError([`kayıt defteri yok: ${f}`]);
    const src = readJson(f);
    // ADR-0038: dosya ile hedef ortam karışmasın (sandbox kaynağı `environment: "sandbox"` taşır)
    if ((src.environment ?? "production") !== e)
      throw new RegistryError([`${f}: ortam ${src.environment ?? "production"}, beklenen ${e}`]);
    return src as Record<string, unknown>;
  };
  const label = (e: WpEnvironment) => (e === "production" ? "registry" : "registry-sandbox");
  const id = val("id");

  if (sub === "list" || sub === "show") {
    for (const e of envs) {
      const src = load(e);
      const all = (src.wallet_providers ?? []) as Array<Record<string, unknown>>;
      if (sub === "list") {
        console.log(`[${label(e)}]`);
        for (const l of summarizeWalletProviders(src)) console.log(`  ${l}`);
        continue;
      }
      if (!id) throw new RegistryError([usage]);
      const w = all.find((x) => x.provider_id === id);
      if (!w) throw new RegistryError([`${label(e)}: cüzdan sağlayıcı yok: ${id}`]);
      console.log(`[${label(e)}]\n${JSON.stringify(w, null, 2)}`);
      const pki = e === "production" ? (val("prod-pki") ?? process.env.TAMGA_PROD_PKI_DIR) : sandboxPki();
      for (const n of (w.wua_signing_certs ?? []) as string[]) {
        const f = pki ? resolve(pki, `${n}.cert.pem`) : null;
        if (!f || !existsSync(f)) {
          console.log(`  ${n}: sertifika dosyası ${f ? "yok" : "aranmadı (PKI klasörü verilmedi)"}`);
          continue;
        }
        const c = certSummary(readFileSync(f, "utf8"));
        console.log(
          `  ${n}: SHA-256 ${c.fingerprint} · ${c.subject} · geçerli ${c.notAfter.toISOString()} tarihine kadar`,
        );
      }
    }
    return;
  }
  if (sub === "check") {
    // Salt denetim: sertifika profili (ETSI TS 119 412-6 §5) + kayıttaki kimlik numarası; dosya yazmaz
    const certPath = val("cert");
    if (!id || !certPath) throw new RegistryError([usage]);
    const pemText = readFileSync(resolve(certPath), "utf8");
    const problems: string[] = [];
    for (const e of envs) {
      try {
        const info = inspectWalletProviderCert(pemText, { now: new Date(), environment: e });
        const w = ((load(e).wallet_providers ?? []) as Array<Record<string, unknown>>).find(
          (x) => x.provider_id === id,
        );
        if (!w) throw new RegistryError([`cüzdan sağlayıcı yok: ${id}`]);
        const orgProblems = info.profileRequired ? providerOrgIdProblems(w, info.organizationIdentifier) : [];
        // ADR-0042: gerçek kayıt defterinde de olan sağlayıcı sandbox'ta gerçek sertifikasını taşır — test sertifikası olmaz
        const inProd =
          e === "sandbox" &&
          existsSync(srcFile("production")) &&
          ((load("production").wallet_providers ?? []) as Array<Record<string, unknown>>).some(
            (x) => x.provider_id === id,
          );
        if (inProd && info.isTest)
          orgProblems.push(
            `${id} gerçek listede de kayıtlı: sandbox'ta da gerçek sertifikası olur, (TEST) sertifika olmaz (SB1)`,
          );
        if (orgProblems.length) throw new RegistryError(orgProblems);
        const listed = ((w.wua_signing_certs ?? []) as string[]).join(", ") || "-";
        console.log(
          `${label(e)}: ${id} uygun — SHA-256 ${info.fingerprint} · ${info.subject} · geçerli ${info.notAfter.toISOString()} tarihine kadar · kayıttaki sertifikalar: ${listed}`,
        );
        for (const w2 of info.warnings) console.log(`  [uyarı] ${w2}`);
      } catch (err) {
        if (!(err instanceof RegistryError)) throw err;
        problems.push(...err.problems.map((x) => `${label(e)}: ${x}`));
      }
    }
    if (problems.length) throw new RegistryError(problems);
    return;
  }
  if (!id || !["activate", "suspend", "revoke"].includes(sub ?? "")) throw new RegistryError([usage]);
  function sandboxPki() {
    return resolve(
      val("sandbox-pki") ?? process.env.TAMGA_TP_SANDBOX_PKI ?? resolve(app, "..", "..", "ops", "pki-sandbox"),
    );
  }

  const now = new Date();
  const reason = val("reason");
  // Önce her hedef için plan (hepsi denetlenir), sonra yazım — biri hatalıysa hiçbir dosya değişmez
  const plans: Array<{
    e: WpEnvironment;
    file: string;
    before: string;
    after: string;
    cert?: { path: string; pem: string };
  }> = [];
  const notes: string[] = [];
  if (sub === "activate") {
    const certPath = val("cert");
    if (!certPath) throw new RegistryError([usage]);
    const certName = walletProviderCertName(id);
    const pemText = readFileSync(resolve(certPath), "utf8");
    let production: Record<string, unknown> | undefined = existsSync(srcFile("production"))
      ? load("production")
      : undefined;
    const prodPkiDir = val("prod-pki") ?? process.env.TAMGA_PROD_PKI_DIR;
    for (const e of envs) {
      const info = inspectWalletProviderCert(pemText, { now, environment: e });
      notes.push(...info.warnings.map((w) => `[uyarı] ${w}`));
      const pki = e === "production" ? prodPkiDir : sandboxPki();
      if (!pki)
        throw new RegistryError([
          "gerçek ağın PKI klasörü verilmedi: --prod-pki <klasör> ya da TAMGA_PROD_PKI_DIR (depo dışındaki gizli klasör)",
        ]);
      if (!existsSync(pki)) throw new RegistryError([`PKI klasörü yok: ${pki}`]);
      // ADR-0038 SB1: klasörün kökü hedef ortamla uyuşmalı (sandbox kökü "(TEST)" taşır, gerçek kök taşımaz)
      const root = resolve(pki, "root-ca.cert.pem");
      if (
        existsSync(root) &&
        /\(TEST\)/.test(new X509Certificate(readFileSync(root, "utf8")).subject) !== (e === "sandbox")
      )
        throw new RegistryError([
          `${pki}: bu klasör ${e === "sandbox" ? "sandbox" : "gerçek ağın"} PKI'sı değil (SB1)`,
        ]);
      const target = resolve(pki, `${certName}.cert.pem`);
      let writeCert = true;
      if (existsSync(target)) {
        const have = certSummary(readFileSync(target, "utf8")).fingerprint;
        if (have !== info.fingerprint)
          throw new RegistryError([
            `${target} başka bir sertifika (SHA-256 ${have}) — üzerine yazılmaz; anahtar değişimi ayrı iştir`,
          ]);
        writeCert = false;
      }
      if (e === "sandbox" && prodPkiDir && existsSync(resolve(prodPkiDir, `${certName}.cert.pem`))) {
        const prodFp = certSummary(readFileSync(resolve(prodPkiDir, `${certName}.cert.pem`), "utf8")).fingerprint;
        if (prodFp !== info.fingerprint)
          throw new RegistryError([`sandbox sertifikası gerçek ağdakiyle aynı olmalı (ADR-0042): gerçek ${prodFp}`]);
      }
      const src = load(e);
      const { next, changed } = activateWalletProvider(src, id, {
        certName,
        now,
        environment: e,
        reason,
        production,
        organizationIdentifier: info.organizationIdentifier,
        profileRequired: info.profileRequired,
      });
      if (e === "production") production = next; // sandbox denetimi bu komutun yazacağı gerçek kayda bakar
      const before = readFileSync(srcFile(e), "utf8");
      const after = changed ? await formatJson(next, srcFile(e)) : before;
      plans.push({
        e,
        file: srcFile(e),
        before,
        after,
        ...(writeCert ? { cert: { path: target, pem: info.pem } } : {}),
      });
      notes.push(`${label(e)}: ${id} → ${certName} (SHA-256 ${info.fingerprint})`);
    }
  } else {
    const st = sub === "suspend" ? "SUSPENDED" : "REVOKED";
    for (const e of envs) {
      const src = load(e);
      const { next, changed } = setWalletProviderStatus(src, id, st, { now, reason });
      const before = readFileSync(srcFile(e), "utf8");
      plans.push({ e, file: srcFile(e), before, after: changed ? await formatJson(next, srcFile(e)) : before });
    }
  }

  const todo = plans.filter((p) => p.before !== p.after || p.cert);
  for (const n of notes) console.log(n);
  if (!todo.length) {
    console.log(`değişiklik yok: ${id} zaten istenen durumda (${plans.map((p) => label(p.e)).join(", ")})`);
    return;
  }
  for (const p of todo) {
    if (dry) {
      console.log(`--- ${p.file}`);
      if (p.before !== p.after) console.log(lineDiff(p.before, p.after));
      if (p.cert) console.log(`+ sertifika yazılacak: ${p.cert.path}`);
      continue;
    }
    if (p.cert) writeAtomic(p.cert.path, p.cert.pem);
    if (p.before !== p.after) writeAtomic(p.file, p.after);
    console.log(`yazıldı: ${p.file}${p.cert ? ` + ${p.cert.path}` : ""}`);
  }
  console.log(
    dry
      ? "deneme (--dry-run): hiçbir dosya yazılmadı"
      : "liste imzalanmadı: kaynak commit + push, sonra ağ sunucusunda dağıtım (gerçek liste önce, sandbox sonra; upload.ps1 -WithPki -WithSandboxPki)",
  );
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
 * ADR-0036: dış listelerin kopyası — özgün adresten çeker, LOTL'daki sabit imzacıya karşı doğrular, okunabilir olduğunu
 * denetler ve dist/external/<list_id>.jws (ETSI TS 119 602 LoTE) ya da .xml (ETSI TS 119 612 TL; özgün imzalı belge) olarak yazar.
 * Hata olursa eski kopya korunur (uyarı); Tamga listeleri etkilenmez.
 */
async function externalFetch() {
  const lotlSrc = readJson(resolve(REG, "lotl.source.json"));
  const lists = externalListsFrom(lotlSrc.external_lists ?? []);
  if (!lists.length) return console.log("external: kayıtlı dış liste yok");
  mkdirSync(resolve(DIST, "external"), { recursive: true });
  for (const p of lists) {
    if (p.status !== "ACTIVE" || (p.format !== "etsi-lote-json" && p.format !== "etsi-tl-xml")) {
      console.log(`external ${p.list_id}: atlandı (${p.status} / ${p.format})`);
      continue;
    }
    try {
      const r = await fetch(p.list_url, { signal: AbortSignal.timeout(15_000) });
      if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
      const body = (await r.text()).trim();
      const fps = new Set(p.signing_keys.filter((k) => k.status === "ACTIVE").map((k) => k.fingerprint_sha256));
      const lote =
        p.format === "etsi-tl-xml"
          ? readTrustedListXml(body, fps).list
          : parseLote((await verifyJws(body, fps, { typ: null })).payload);
      const ext = p.format === "etsi-tl-xml" ? "xml" : "jws";
      writeFileSync(resolve(DIST, "external", `${p.list_id}.${ext}`), body + "\n");
      console.log(
        `external ${p.list_id}: #${lote.sequence}, ${lote.entities.length} kurum, NextUpdate ${lote.nextUpdate.toISOString()}`,
      );
    } catch (e) {
      console.warn(`external ${p.list_id}: ${(e as Error).message} — eski kopya korunuyor`);
    }
  }
}

/**
 * ADR-0041: test kurumu kaydı (yalnız sandbox). İstek stdin'den JSON (`TestInstitutionRequest`). Ara makamla iki yaprak sertifika
 * üretir, kaydı `issuers.json`'a ekler ve listeyi imzalar; çıktı JSON: slug, issuer_id, sertifika adları. Kişisel veri yoktur.
 */
async function sandboxInstitution(sub: string | undefined) {
  if (ENVIRONMENT !== "sandbox" || !SELF_DIR)
    throw new Error("sandbox-institution: yalnız sandbox kayıt defteriyle ve TAMGA_SANDBOX_SELF_DIR ile (ADR-0041)");
  const file = SELF_FILE()!;
  if (sub === "list") return console.log(JSON.stringify({ issuers: selfIssuers().map((i) => i.slug) }));
  if (sub === "remove") {
    // ADR-0041 K7: dolu sınırda en eski BOŞ test kurumu yer açmak için kaldırılır (sandbox listesinde "kayıt silinmez" istisnası, TI5)
    const slug = process.argv[4] ?? "";
    if (!/^t-[a-z0-9]{6,12}$/.test(slug)) throw new RegistryError(["slug: t-<6–12 küçük harf/rakam>"]);
    await withDirLock("registry.lock", async () => {
      const cur = selfIssuers();
      if (!cur.some((i) => i.slug === slug)) throw new RegistryError([`test kurumu yok: ${slug}`]);
      writeAtomic(file, `${JSON.stringify({ issuers: cur.filter((i) => i.slug !== slug) }, null, 2)}\n`);
      for (const suffix of ["", "-status"])
        for (const ext of ["cert.pem", "pkcs8.pem"])
          rmSync(resolve(SELF_DIR!, "pki", `issuer-${slug}${suffix}.${ext}`), { force: true });
      await build();
      changelog(`test institution ${slug} removed from the sandbox list (ADR-0041 K7)`);
    });
    return console.log(JSON.stringify({ removed: slug }));
  }
  if (sub !== "add") throw new Error("kullanım: sandbox-institution add < istek.json | remove <slug> | list");
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  const req = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as TestInstitutionRequest;
  const problems = validateRequest(req);
  if (problems.length) throw new RegistryError(problems);
  const out = await withDirLock("registry.lock", async () => {
    const cur = selfIssuers();
    if (cur.length >= MAX_TEST_INSTITUTIONS)
      throw new RegistryError([`en çok ${MAX_TEST_INSTITUTIONS} test kurumu (K7)`]);
    const tl = readJson(resolve(REG, "tl-tr.source.json"));
    if ([...tl.issuers, ...cur].some((i: Record<string, unknown>) => i.slug === req.slug))
      throw new RegistryError([`slug zaten kayıtlı: ${req.slug}`]);
    // ADR-0041 K1: gerçek ve sandbox kayıt defterindeki ya da şu anki test kurumlarının adına benzeyen ad RED
    const prodSrc = resolve(app, "registry", "tl-tr.source.json");
    const nameIssues = nameProblems(
      req.name,
      reservedNamesOf(tl, existsSync(prodSrc) ? readJson(prodSrc) : undefined, { issuers: cur }),
    );
    if (nameIssues.length) throw new RegistryError(nameIssues);
    const ca = {
      certPem: readFileSync(resolve(PKI, `${TEST_CA}.cert.pem`), "utf8"),
      keyPem: readFileSync(resolve(PKI, `${TEST_CA}.pkcs8.pem`), "utf8"),
    };
    const now = new Date();
    const subj = subjects(req.name);
    const pkiDir = resolve(SELF_DIR!, "pki");
    mkdirSync(pkiDir, { recursive: true });
    for (const [suffix, subject] of [
      ["", subj.credential],
      ["-status", subj.status],
    ] as const) {
      const leaf = await issueLeaf(ca, subject, now);
      writeFileSync(resolve(pkiDir, `issuer-${req.slug}${suffix}.cert.pem`), leaf.certPem);
      writeFileSync(resolve(pkiDir, `issuer-${req.slug}${suffix}.pkcs8.pem`), leaf.keyPem, { mode: 0o600 });
    }
    const rec = testInstitutionSource(req, now);
    writeAtomic(file, `${JSON.stringify({ issuers: [...cur, rec] }, null, 2)}\n`);
    await build();
    changelog(`test institution ${req.slug} added to the sandbox list (ADR-0041)`);
    return { slug: req.slug, issuer_id: computeIssuerId(tl.state_code, cert(`self:issuer-${req.slug}`).der) };
  });
  console.log(JSON.stringify({ ...out, cert_ref: `issuer-${req.slug}`, status_cert_ref: `issuer-${req.slug}-status` }));
}

const cmd = process.argv[2];
(async () => {
  // build de kayıt kilidini alır: test kurumu kaydıyla (sandbox-institution) aynı anda liste imzalanmasın
  if (cmd === "build") await withDirLock("registry.lock", build);
  else if (cmd === "sandbox-institution") await sandboxInstitution(process.argv[3]);
  else if (cmd === "wallet-provider")
    await walletProviderCommand(process.argv[3], process.argv.slice(4)).catch((e) => {
      if (!(e instanceof RegistryError)) throw e;
      console.error(e.message);
      process.exit(2);
    });
  else if (cmd === "heartbeat") {
    const a = await appendAnchor({ kind: "heartbeat" });
    console.log(JSON.stringify(a));
    await refreshWrprcStatus(); // ADR-0068: kayıt sertifikası durum listesi her saat yeniden imzalanır
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
  } else if (cmd === "wrprc-status" || cmd === "wrprc-revoke") {
    await wrprcStatusCommand(cmd, process.argv.slice(3));
  } else if (cmd === "verify") await verify();
  else if (cmd === "external-fetch") await externalFetch();
  else if (cmd === "archive") {
    // TL12: operatör komutu — günlüğü şimdi arşivle (otomatik eşik: TAMGA_ANCHORS_MAX_LINES, varsayılan 500)
    const cp = await withAnchorLock(rotateAnchorsLocked);
    console.log(cp ? JSON.stringify(cp) : "anchors: arşivlenecek satır yok");
  } else if (["register", "scope", "authorize", "list", "status", "rp-status", "end-use"].includes(cmd ?? "")) {
    await registryCommand(cmd!, process.argv.slice(3));
  } else if (cmd === "chain-submit" || cmd === "chain-check") {
    // ADR-0051: zincir projeksiyonu — bayrak TAMGA_CHAIN_ENABLED=0 iken yazma yok (CH5)
    process.exitCode = await chainCommand(cmd, process.argv.slice(3), { dist: DIST, environment: ENVIRONMENT });
  } else {
    console.error(
      "kullanım: cli.ts build | anchor ... | heartbeat | verify [--full] | archive | external-fetch | status <slug> <STATUS> | rp-status <dns_name> <STATUS> | end-use <dns_name> <id> | register issuer|rp <dosya> | scope <dns_name> <dosya> | authorize <slug> <vct> [--revoke] | list | chain-submit [--dry-run] | chain-check <dosya.jws>",
    );
    process.exit(1);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
