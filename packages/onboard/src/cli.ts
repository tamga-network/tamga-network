#!/usr/bin/env node
/**
 * tamga-onboard — Tamga Network'e katılacak kurumun bilgi işlem ekibi için komut satırı aracı. Ağa ve listeye YAZMAZ; yalnız yerel
 * dosya üretir ve https ile okur. Komutlar: init · validate · keys · check · sandbox · node (init · declare · check: devlet /
 * işletmeci Besu düğümü) · mcp (aynı işlemler MCP sunucusu olarak).
 * Çıkış: 0 tamam · 1 denetim/doğrulama sorunu · 2 kullanım hatası.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { buildApplications, validateProfile, type Answers } from "./application.js";
import {
  defaultHttp,
  formatRows,
  installationChecks,
  listingChecks,
  localCertificates,
  readOnboardingDir,
  type Row,
} from "./checks.js";
import { csrExpectations, generateKeys, inspectCsr, writeReport } from "./keys.js";
import { NETWORKS, sandboxGuide, type Environment } from "./network.js";
import {
  buildNodeDeclaration,
  declarationFileName,
  defaultNodeRpc,
  defaultRpc,
  initNode,
  isLoopback,
  nodeChecks,
  nodeNextSteps,
  readNodeDir,
  readToml,
  validateNodeDeclaration,
  type NodeDeclaration,
  type NodeProfile,
  type NodeRole,
  type TomlTable,
} from "./node.js";
import { within } from "./paths.js";
import { applicationKind, validateApplication } from "./rules.js";

const VERSION = (() => {
  try {
    return (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string })
      .version;
  } catch {
    return "?";
  }
})();

const HELP = `tamga-onboard ${VERSION} — Tamga Network katılım aracı (kurum tarafı; ağa yazmaz)

  init [--from <yanıtlar.json>] [--out <klasör>]   başvuru dosyaları (etkileşimli ya da dosyadan)
  validate <dosya|klasör> …                       başvuru / yanıt dosyasını kayıt kurallarıyla denetle
  keys [klasör] [--passphrase-env <DEĞİŞKEN>]       iki anahtar + CSR (yalnız bu bilgisayarda; özel anahtar keys/)
        [--no-passphrase] [--allow-synced]         parolasız (Windows'ta açıkça) · bulut eşitleme klasörüne bilerek
  keys --inspect <csr.pem> [klasör]               dışarıda (HSM, uzaktan imza) üretilmiş CSR'ı denetle
  check [klasör] [--listing | --listing-only]      kurulum denetimi; --listing: güven listesinde görünüm de
        [--env production|sandbox] [--slug <ad>] [--rp <alan adı>] [--dns-txt <değer>] [--pin <hex>[,<hex>]]
        [--trust <adres>] [--passphrase-env <DEĞİŞKEN>] [--offline] [--json] [--report <dosya.json>]
        [--allow-http] [--allow-private]          yerel deneme: http ve yerel / özel ağ adresleri
  sandbox                                         sandbox'ta "Kurumunu dene" adresi ve adımları

  Devlet / işletmeci Besu düğümü (ağa ve zincire yazmaz):
  node init --state <CC> --role validator|rpc --ip <ilan edilen IP>   düğüm anahtarı (secp256k1) + besu.toml şablonu
        [--interface <iç arayüz IP>] [--p2p-port 30303] [--rpc-port 8545] [--out <klasör>] [--allow-synced]
  node declare [klasör] --contact <görev adresi>   tamga-node-declaration/1 bildirimi (operatöre gönderilir)
        [--name <ad>] [--out <dosya.json>] [--public-key <hex>] [--state] [--role] [--ip] [--p2p-port]
  node check [klasör] [--rpc <düğümün yerel ucu>]   kendi düğümünüzü salt-okur denetle (senkron, eşler, izin listesi,
        [--chain-rpc <ağdaki uç>] [--public-rpc <dış uç>]   validator kümesi, dış RPC yüzeyi, yapılandırma, saat)
        [--permissions-file <çizim.toml>] [--config <besu.toml>] [--declaration <bildirim.json>]
        [--client-cert <pem> --client-key <pem>] [--allow-private] [--json] [--report <dosya>]
                                                  loopback varsayılan açık; öteki yerel / özel ağ adresleri --allow-private ile
  mcp [--root <klasör>]                            aynı işlemler yerel MCP sunucusu (stdio) olarak

Kişi bilgisi sorulmaz ve dosyalara yazılmaz. Rehber: ${NETWORKS.production.docs}/packages/onboard`;

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i > 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
};
const VALUE_FLAGS = [
  "from",
  "out",
  "passphrase-env",
  "inspect",
  "env",
  "slug",
  "rp",
  "dns-txt",
  "pin",
  "trust",
  "report",
  "root",
  "state",
  "role",
  "ip",
  "interface",
  "p2p-port",
  "rpc-port",
  "contact",
  "name",
  "public-key",
  "rpc",
  "chain-rpc",
  "public-rpc",
  "permissions-file",
  "config",
  "declaration",
  "client-cert",
  "client-key",
];
const positional = argv
  .slice(1)
  .filter((a, i, all) => !a.startsWith("--") && !(i > 0 && VALUE_FLAGS.includes(all[i - 1].replace(/^--/, ""))));
const usage = (m: string): never => {
  console.error(`${m}\n\n${HELP}`);
  process.exit(2);
};
const readJson = (p: string) => JSON.parse(readFileSync(resolve(p), "utf8"));
const writeJson = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + "\n", { flag: "wx" });
const passphrase = () => {
  const v = opt("passphrase-env");
  if (!v) return undefined;
  const s = process.env[v];
  if (!s) usage(`--passphrase-env ${v}: ortam değişkeni boş`);
  return s;
};
const printFindings = (title: string, problems: string[], warnings: string[]) => {
  console.log(`${title}: ${problems.length ? "SORUNLU" : "geçerli"}`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  for (const w of warnings) console.log(`  ! ${w}`);
};

async function ask(): Promise<Answers> {
  if (!process.stdin.isTTY) usage("etkileşimli init için terminal gerekir; dosyadan: init --from <yanıtlar.json>");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const q = async (label: string, def?: string) => {
    const a = (await rl.question(`${label}${def ? ` [${def}]` : ""}: `)).trim();
    return a || def || "";
  };
  const list = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  console.log("Tamga Network katılım başvurusu — kişi bilgisi (ad, imza yetkilisi) sorulmaz.\n");
  const role = (await q("Rol (issuer = belge veren, verifier = doğrulayıcı)", "issuer")) as Answers["role"];
  const a: Answers = {
    role,
    environment: (await q("Ortam (production | sandbox)", "production")) as Environment,
    slug: await q("Kısa ad (3–32 küçük harf, rakam, tire; kamuya açık, operatörle seçilir)"),
    legal_name: await q("Resmî ad"),
    identifier: { scheme: "TR-VKN", value: "" },
    postal_address: { street_address: "", country: "TR" },
    contact: { support_uri: "" },
    domain: "",
  };
  a.trade_name = (await q("Ticari ad", a.legal_name)) || undefined;
  const scheme = (await q("Kimlik no türü (TR-VKN | TR-MERSIS)", "TR-VKN")) as "TR-VKN" | "TR-MERSIS";
  const digits = await q(scheme === "TR-VKN" ? "VKN (10 hane)" : "MERSİS (16 hane)");
  a.identifier = { scheme, value: `TR${digits.replace(/^TR/i, "")}` };
  a.postal_address = {
    street_address: await q("Adres (sokak, no)"),
    locality: (await q("İl / ilçe")) || undefined,
    postal_code: (await q("Posta kodu")) || undefined,
    country: await q("Ülke kodu", "TR"),
  };
  a.domain = await q("Kurumun alan adı (ör. example.edu.tr)");
  a.contact = {
    support_uri: await q("Destek sayfası (https; erişim sertifikasına da yazılır)", `https://${a.domain}/`),
    email: (await q("Kurumsal e-posta (ortak adres; kişisel değil)")) || undefined,
  };
  if (role === "issuer") {
    a.category = await q("Kategori (EDUCATION, EVENTS, GOVERNMENT, HEALTH, FINANCE, LOGISTICS, OTHER)", "EDUCATION");
    a.vcts = list(
      await q("Belge türleri (virgülle)", "urn:tamga:edu:StudentCredential:1,urn:tamga:edu:DiplomaCredential:1"),
    );
    a.hosting = (await q("Servis (hosted = Tamga'nın barındırılan servisi, own = kendi servisiniz)", "hosted")) as
      "hosted" | "own";
    if (a.hosting === "own") {
      a.issuer_url = await q("Belge verme servisinizin adresi (https)");
      a.status_list_base = await q("İptal listesi taban adresi (https)");
    } else {
      a.identity_matching = {
        dns_name: (await q("Kimlik eşleştirme alan adı", `tamga.${a.domain}`)) || undefined,
        privacy_policy_uri: await q("Kimlik eşleştirme gizlilik politikası (https)"),
      };
    }
    a.lookup_url = (await q("Sorgu ucu adresi (https; örnek 05; boş = sonra)")) || undefined;
    const isced = list(await q("Program ISCED-F kodları (virgülle; boş = atla)"));
    if (isced.length) a.isced_f_codes = isced;
  } else {
    a.dns_name = await q("İsteği gönderen sitenin alan adı (erişim sertifikası)", a.domain);
    a.service_description = {
      "en-US": await q("Hizmet açıklaması (İngilizce)"),
      "tr-TR": await q("Hizmet açıklaması (Türkçe)"),
    };
    a.is_public_sector_body = (await q("Kamu kurumu mu (evet/hayır)", "hayır")).toLowerCase().startsWith("e");
    a.scopes = [];
    do {
      const id = await q("Kullanım kimliği (ör. age-check-1)");
      a.scopes.push({
        scope_id: id,
        purpose: await q("Amaç (İngilizce)"),
        purpose_localized: { "tr-TR": await q("Amaç (Türkçe)") },
        vct: await q("Belge türü (vct)", "urn:tamga:id:IdentityAttestation:1"),
        claims: list(await q("İstenen en az alan (virgülle)", "age_over_18")),
        privacy_policy_uri: await q("Bu kullanımın gizlilik politikası (https)"),
      });
    } while ((await q("Başka kullanım var mı (evet/hayır)", "hayır")).toLowerCase().startsWith("e"));
  }
  rl.close();
  return a;
}

async function init() {
  const answers = opt("from") ? (readJson(opt("from")!) as Answers) : await ask();
  const b = buildApplications(answers);
  printFindings("başvuru", b.problems, b.warnings);
  if (b.problems.length || !b.profile) process.exit(1);
  const dir = resolve(opt("out") ?? join("tamga-onboarding", b.profile.slug));
  if (existsSync(join(dir, "onboarding.json"))) usage(`${dir} içinde zaten bir başvuru var (üzerine yazılmaz)`);
  mkdirSync(dir, { recursive: true });
  writeJson(join(dir, "onboarding.json"), b.profile);
  if (b.issuer) writeJson(join(dir, b.profile.applications.issuer!), b.issuer);
  if (b.rp) writeJson(join(dir, b.profile.applications.rp!), b.rp);
  console.log(`\nyazıldı: ${dir}`);
  for (const f of ["onboarding.json", b.profile.applications.issuer, b.profile.applications.rp].filter(Boolean))
    console.log(`  ${f}`);
  console.log(`\nsıradaki: tamga-onboard keys "${dir}"`);
}

async function validate() {
  if (!positional.length) usage("validate <dosya|klasör> …");
  let bad = false;
  for (const p of positional) {
    const abs = resolve(p);
    if (existsSync(abs) && statSync(abs).isDirectory()) {
      const { profile, issuer, rp } = readOnboardingDir(abs);
      const pe = validateProfile(profile as never);
      printFindings(`${p}/onboarding.json`, pe, []);
      bad ||= pe.length > 0;
      for (const [name, app] of [
        [profile.applications.issuer, issuer],
        [profile.applications.rp, rp],
      ] as const)
        if (app) {
          const f = validateApplication(app);
          printFindings(`${p}/${name}`, f.problems, f.warnings);
          bad ||= f.problems.length > 0;
        }
      continue;
    }
    const j = readJson(abs);
    if (j && typeof j === "object" && "role" in j && !applicationKind(j)) {
      const b = buildApplications(j as Answers);
      printFindings(`${p} (yanıtlar)`, b.problems, b.warnings);
      bad ||= b.problems.length > 0;
    } else {
      const f = validateApplication(j);
      printFindings(
        `${p}${f.kind ? ` (${f.kind === "issuer" ? "belge veren" : "doğrulayıcı"})` : ""}`,
        f.problems,
        f.warnings,
      );
      bad ||= f.problems.length > 0;
    }
  }
  process.exit(bad ? 1 : 0);
}

async function keys() {
  const dir = resolve(positional[0] ?? ".");
  const { profile, issuer, rp } = readOnboardingDir(dir);
  const inspect = opt("inspect");
  if (inspect) {
    const exps = csrExpectations(profile.keys, { issuer, rp });
    const csrPem = readFileSync(resolve(inspect), "utf8");
    // hangi anahtar: dosya adından, yoksa ilk beklenti
    const e = exps.filter((x) => inspect.includes(x.name)).sort((x, y) => y.name.length - x.name.length)[0] ?? exps[0];
    const r = await inspectCsr(csrPem, e);
    console.log(`CSR (${e.name} beklentisiyle): ${r.subject}`);
    printFindings("CSR", r.problems, []);
    process.exit(r.problems.length ? 1 : 0);
  }
  const r = await generateKeys(
    dir,
    profile,
    { issuer, rp },
    { passphrase: passphrase(), noPassphrase: flag("no-passphrase"), allowSynced: flag("allow-synced") },
  );
  for (const w of r.written) {
    console.log(`✓ ${w.name}`);
    console.log(`    özel anahtar  ${w.key}   (yalnız bu bilgisayarda; kimseyle paylaşmayın)`);
    console.log(`    CSR           ${w.csr}   (operatöre gönderin)`);
    console.log(`    açık anahtar  sha256 ${w.spki_sha256}`);
    console.log(`    konu          ${w.subject}`);
  }
  for (const w of r.warnings) console.log(`! ${w}`);
  if (profile.operator_keys?.length)
    console.log(
      `\nAnahtarını barındırılan servisin ürettiği kayıt: ${profile.operator_keys.join(", ")} (operatör üretir).`,
    );
  console.log(`\nOperatöre gidecekler: başvuru JSON'ları + keys/*.csr.pem (+ tamga-onboard check --report raporu).`);
}

async function check() {
  const listingOnly = flag("listing-only");
  const dir = positional[0]
    ? resolve(positional[0])
    : !listingOnly && existsSync("onboarding.json")
      ? resolve(".")
      : undefined;
  const http = defaultHttp({ allowHttp: flag("allow-http"), allowPrivate: flag("allow-private") });
  const rows: Row[] = [];
  let env = opt("env") as Environment | undefined;
  if (env && !["production", "sandbox"].includes(env)) usage("--env production | sandbox");
  let slug = opt("slug");
  let rp = opt("rp");
  let localCerts: Array<{ name: string; pem: string }> = [];
  if (dir) {
    const d = readOnboardingDir(dir);
    env ??= d.profile.environment;
    if (d.profile.role === "issuer") slug ??= d.profile.slug;
    rp ??= d.rp?.dns_name;
    localCerts = localCertificates(dir, d.profile);
    if (!listingOnly)
      rows.push(
        ...(await installationChecks(
          { dir, passphrase: passphrase(), dnsTxt: opt("dns-txt"), offline: flag("offline") },
          { http },
        )),
      );
  } else if (!listingOnly)
    usage("check <klasör> (init çıktısı) ya da check --listing-only --slug <ad> | --rp <alan adı>");
  if ((flag("listing") || listingOnly) && !flag("offline")) {
    if (!slug && !rp) usage("liste denetimi için --slug ya da --rp");
    rows.push(
      ...(await listingChecks(http, {
        environment: env ?? "production",
        slug,
        rp,
        trustBase: opt("trust"),
        pins: opt("pin")
          ?.split(",")
          .map((x) => x.trim())
          .filter((x) => /^[0-9a-fA-F]{64}$/.test(x)),
        localCerts,
      })),
    );
  }
  const report = {
    tool: `@tamga-network/onboard@${VERSION}`,
    generated_at: new Date().toISOString(),
    environment: env ?? "production",
    slug,
    rp,
    rows,
  };
  if (opt("report")) writeReport(resolve(opt("report")!), report);
  if (flag("json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Tamga Network katılım denetimi — ${slug ?? rp ?? dir} · ${env ?? "production"}\n`);
    console.log(formatRows(rows));
  }
  process.exit(rows.some((r) => r.result === "fail") ? 1 : 0);
}

function sandbox() {
  const g = sandboxGuide();
  console.log(`Sandbox — Kurumunu dene: ${g.url}\n`);
  g.steps.forEach((s, i) => console.log(`${i + 1}. ${s}`));
  console.log("");
  for (const n of g.notes) console.log(`- ${n}`);
}

const intOpt = (n: string) => {
  const v = opt(n);
  if (v === undefined) return undefined;
  if (!/^\d+$/.test(v)) usage(`--${n}: sayı`);
  return Number(v);
};
const nodePositional = positional.slice(1);

async function nodeInit() {
  const dir = resolve(opt("out") ?? "tamga-node");
  const r = initNode(
    dir,
    {
      state: opt("state") ?? usage("node init --state <CC> (Governance üye kodu)"),
      role: (opt("role") ?? usage("node init --role validator|rpc")) as NodeRole,
      ip: opt("ip") ?? usage("node init --ip <ilan edilen P2P adresi>"),
      interface: opt("interface"),
      p2pPort: intOpt("p2p-port"),
      rpcPort: intOpt("rpc-port"),
    },
    { allowSynced: flag("allow-synced") },
  );
  console.log(`✓ düğüm klasörü: ${r.dir}`);
  console.log(`    özel anahtar   ${r.key}   (yalnız bu makinede; kimseyle paylaşmayın)`);
  console.log(`    açık anahtar   ${r.profile.node_public_key}`);
  console.log(`    enode          ${r.enode}`);
  console.log(
    `    adres          ${r.profile.address}${r.profile.role === "validator" ? "   (validator adresi)" : ""}`,
  );
  console.log(`    yapılandırma   ${join(r.dir, "besu.toml")}`);
  for (const w of r.warnings) console.log(`! ${w}`);
  console.log("\nSıradakiler:");
  nodeNextSteps(r.profile).forEach((s, i) => console.log(`${i + 1}. ${s}`));
}

async function nodeDeclare() {
  const dir = nodePositional[0] ? resolve(nodePositional[0]) : existsSync("node.json") ? resolve(".") : undefined;
  const p: Partial<NodeProfile> = dir ? readNodeDir(dir).profile : {};
  const pk = opt("public-key") ?? p.node_public_key;
  const state = opt("state") ?? p.state;
  const role = (opt("role") ?? p.role) as NodeRole | undefined;
  const ip = opt("ip") ?? p.ip;
  const port = intOpt("p2p-port") ?? p.p2p_port;
  if (!pk || !state || !role || !ip || !port)
    return usage("node declare <düğüm klasörü> ya da --public-key --state --role --ip --p2p-port birlikte");
  const contact = opt("contact") ?? usage("node declare --contact <kurumun görev e-postası ya da https sayfası>");
  const b = buildNodeDeclaration({ state, role, node_public_key: pk, ip, p2p_port: port, contact });
  printFindings("bildirim", b.problems, b.warnings);
  if (!b.declaration) process.exit(1);
  const file = declarationFileName(state, opt("name") ?? role);
  const out = opt("out") ? resolve(opt("out")!) : dir ? within(dir, file) : resolve(file);
  if (!/\.json$/i.test(out)) usage("--out: .json dosyası");
  if (existsSync(out)) usage(`${out} zaten var (üzerine yazılmaz)`);
  writeJson(out, b.declaration);
  console.log(`\nyazıldı: ${out}`);
  console.log(
    `  adres ${b.address}${role === "validator" ? " — Governance'taki validator adresiyle aynı olmalı (ADR-0052 K2)" : ""}`,
  );
  console.log(
    `\nOperatöre gönderin; network/permissions/nodes/${file} olarak eklenir. Bildirim yetki vermez: validator, Governance kabulü ve QBFT oyuyla olur.`,
  );
}

async function nodeCheck() {
  const dir = nodePositional[0] ? resolve(nodePositional[0]) : existsSync("node.json") ? resolve(".") : undefined;
  let profile: NodeProfile | undefined;
  let config: TomlTable | undefined;
  if (dir) ({ profile, config } = readNodeDir(dir));
  if (opt("config")) config = readToml(resolve(opt("config")!));
  const permissions = opt("permissions-file") ? readToml(resolve(opt("permissions-file")!)) : undefined;
  let declaration: NodeDeclaration | undefined;
  if (opt("declaration")) {
    const d = readJson(opt("declaration")!);
    const errs = validateNodeDeclaration(d);
    if (errs.length) usage(`--declaration geçersiz: ${errs.join("; ")}`);
    declaration = d as NodeDeclaration;
  }
  const cert = opt("client-cert");
  const key = opt("client-key");
  if (!!cert !== !!key) usage("--client-cert ile --client-key birlikte");
  const allowPrivate = flag("allow-private");
  // Varsayılan: loopback açık — komutu düğümün kendi makinesinde çalıştıran kişi kendi yönetim ucunu (LP5 gereği 127.0.0.1)
  // sınar ve adresleri kendisi yazar (dosyadan adres okunmaz). Öteki yerel / özel ağlar (RFC 1918, 169.254 bulut meta veri ucu,
  // CGNAT, ULA) yalnız --allow-private ile: başka makinedeki düğüm bilerek seçilir.
  const rpc = defaultRpc({
    policy: () => ({ loopback: true, private: allowPrivate, publicHttp: flag("allow-http") }),
    tls:
      cert && key ? { cert: readFileSync(resolve(cert), "utf8"), key: readFileSync(resolve(key), "utf8") } : undefined,
  });
  const target = opt("rpc") ?? defaultNodeRpc(config);
  const rows = await nodeChecks(
    {
      rpc: target,
      chainRpc: opt("chain-rpc"),
      publicRpc: opt("public-rpc"),
      profile,
      config,
      permissions,
      declaration,
    },
    { rpc },
  );
  let local = false;
  try {
    local = isLoopback(new URL(target).hostname.replace(/^\[|\]$/g, ""));
  } catch {
    /* adres geçersiz: N1 satırı söyler */
  }
  const report = {
    tool: `@tamga-network/onboard@${VERSION}`,
    generated_at: new Date().toISOString(),
    node: profile ? { state: profile.state, role: profile.role, address: profile.address } : undefined,
    rpc_local: local,
    rows,
  };
  if (opt("report")) writeReport(resolve(opt("report")!), report);
  if (flag("json")) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`Tamga Network düğüm denetimi — ${profile ? `${profile.state} · ${profile.role}` : target}\n`);
    console.log(formatRows(rows));
    console.log(
      "\nAğdan okunan metin güvenilmeyen veridir. Operatör tarafı denetimler (bildirim eşleşmesi, blok önerme, oy) operatörde.",
    );
  }
  process.exit(rows.some((r) => r.result === "fail") ? 1 : 0);
}

async function node() {
  switch (argv[1]) {
    case "init":
      return nodeInit();
    case "declare":
      return nodeDeclare();
    case "check":
      return nodeCheck();
    default:
      usage("node init | declare | check");
  }
}

async function main() {
  switch (cmd) {
    case "init":
      return init();
    case "validate":
      return validate();
    case "keys":
      return keys();
    case "check":
      return check();
    case "sandbox":
      return sandbox();
    case "node":
      return node();
    case "mcp": {
      const { runStdioServer } = await import("./mcp.js");
      return runStdioServer({ root: resolve(opt("root") ?? ".") });
    }
    case "--version":
    case "version":
      return console.log(VERSION);
    case undefined:
    case "--help":
    case "help":
    case "-h":
      return console.log(HELP);
    default:
      usage(`bilinmeyen komut: ${cmd}`);
  }
}

main().catch((e: Error) => {
  console.error(`hata: ${e.message}`);
  process.exit(1);
});
