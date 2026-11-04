/**
 * `tamga-onboard node` — devletin / işletmecinin Besu düğümü için katılım adımları (ADR-0052, ARCH-0002 §6 ve §10). Zincire, izin
 * listesine ve ağa YAZMAZ; düğüme yalnız okuyan JSON-RPC çağrıları gönderir.
 *
 *   init     düğüm anahtarı (secp256k1, Besu `key` biçimi: `0x` + 64 onaltılık) BU bilgisayarda üretilir; özel anahtar dosyası
 *            keys komutunun korumalarıyla yazılır (yalnız sahibi; Windows'ta icacls; bulut eşitleme klasörü reddi; üzerine yazmama).
 *            enode açık anahtarı ve validator adresi (Keccak-256 → son 20 bayt) türetilir; Besu yapılandırma şablonu (izinli kip,
 *            RPC yalnız loopback, P2P yalnız belirli iç arayüz — 0.0.0.0 değil) ve genesis yönergesi yazılır.
 *   declare  `tamga-node-declaration/1` bildirimi (network/permissions şeması; kişisel veri yok, iletişim kurumun görev adresi).
 *   check    kurumun KENDİ düğümüne karşı salt-okur denetimler (operatörün düğüm denetim listesinin dışarıdan / yerelden
 *            yapılabilenleri). Hiçbir durum değiştiren yöntem çağrılmaz (oy, izin yükleme, eş ekleme, işlem yok).
 * Uç adresleri yalnız kullanıcının verdiği adreslerdir (dosyadan adres okunmaz; besu.toml'dan yalnız loopback RPC portu türetilir).
 */
import { createECDH } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import type { LookupAddress } from "node:dns";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { clean, isPrivateAddress, type Row } from "./checks.js";
import { syncedFolder, writePrivateKey } from "./keys.js";
import { realResolve, within } from "./paths.js";

// ───────────────────────────── anahtar ─────────────────────────────

export const NODE_DECLARATION_FORMAT = "tamga-node-declaration/1";
export type NodeRole = "validator" | "rpc";

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

/** secp256k1 özel anahtarından (32 bayt) enode açık anahtarı (128 onaltılık, 04 öneki yok) ve adres (0x + 40 onaltılık). */
export function nodeIdentity(privateKey: Uint8Array): { publicKey: string; address: string } {
  if (privateKey.length !== 32) throw new Error("düğüm anahtarı 32 bayt olmalı");
  const e = createECDH("secp256k1");
  e.setPrivateKey(Buffer.from(privateKey)); // aralık dışı (0 ya da ≥ n) → hata
  const pub = e.getPublicKey(); // 65 bayt, 04 || x || y
  return { publicKey: hex(pub.subarray(1)), address: nodeAddressOf(hex(pub.subarray(1))) };
}

/** Açık anahtardan düğüm adresi (QBFT doğrulayıcı adresi = düğüm anahtarının adresi; ADR-0052 K2 eşleşme kuralı). */
export function nodeAddressOf(publicKeyHex: string): string {
  const k = normalizePublicKey(publicKeyHex);
  if (!k) throw new Error("açık anahtar 128 onaltılık karakter olmalı");
  return "0x" + hex(keccak_256(Buffer.from(k, "hex")).subarray(12));
}

/** `0x`, `04` öneki ve büyük harf kabul edilir; şemanın biçimine (128 küçük onaltılık) çevrilir. Geçersizse null. */
export function normalizePublicKey(s: string): string | null {
  let k = String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/^0x/, "");
  if (k.length === 130 && k.startsWith("04")) k = k.slice(2);
  return /^[0-9a-f]{128}$/.test(k) ? k : null;
}

/** Yeni düğüm anahtarı: 32 rastgele bayt (Node'un CSPRNG'si), Besu `key` dosyası biçimi. */
export function generateNodeKey(): { keyFile: string; publicKey: string; address: string } {
  const e = createECDH("secp256k1");
  e.generateKeys();
  const d = Buffer.alloc(32);
  const raw = e.getPrivateKey();
  raw.copy(d, 32 - raw.length);
  const id = nodeIdentity(d);
  const keyFile = "0x" + d.toString("hex");
  d.fill(0);
  return { keyFile, ...id };
}

/** Besu enode URL'si (IPv6 köşeli parantezde). */
export const enodeOf = (publicKey: string, ip: string, port: number) =>
  `enode://${publicKey}@${ip.includes(":") ? `[${ip.toLowerCase()}]` : ip}:${port}`;

/** `0x7099…79c8` — raporda adres kısaltılır. */
export const shortAddr = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

// ───────────────────────────── adres kuralları ─────────────────────────────

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;
/** Bildirim şemasıyla aynı: IPv4 değişmezi ya da (noktasız) IPv6 değişmezi. */
export const ipLiteralOk = (ip: string) =>
  typeof ip === "string" && (IPV4.test(ip) || (ip.includes(":") && IPV6.test(ip) && isIP(ip) === 6));
const UNSPECIFIED = (ip: string) => ip === "0.0.0.0" || /^(0*:)*:?0*$/.test(ip) || ip === "::";
/** Yerel / özel ağ adresi — belgeleme aralıkları (192.0.2/24, 198.51.100/24, 203.0.113/24, 2001:db8::/32; örneklerde) hariç. */
const unreachable = (ip: string) =>
  isPrivateAddress(ip) && !/^(192\.0\.2|198\.51\.100|203\.0\.113)\./.test(ip) && !/^2001:0?db8:/i.test(ip);
export const isLoopback = (ip: string) =>
  /^127\./.test(ip) || ip === "::1" || /^::ffff:127\./i.test(ip) || ip.toLowerCase() === "localhost";
const portOk = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 65535;
export const STATE_RE = /^[A-Z]{2}$/;
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;

// ───────────────────────────── init ─────────────────────────────

/** Düğüm klasörünün yerel dosyası (`node.json`; operatöre gönderilmez, kamuya açık bilgiler — özel anahtar yok). */
export interface NodeProfile {
  state: string;
  role: NodeRole;
  node_public_key: string;
  address: string;
  /** İlan edilen P2P adresi (bildirimdeki IP; `p2p-host`) */
  ip: string;
  /** Dinlenen iç arayüz (`p2p-interface`) — hiçbir zaman 0.0.0.0 / :: */
  interface: string;
  p2p_port: number;
  rpc_port: number;
}
const PROFILE_KEYS = ["state", "role", "node_public_key", "address", "ip", "interface", "p2p_port", "rpc_port"];

export interface NodeInitInput {
  state: string;
  role: NodeRole;
  ip: string;
  /** varsayılan `ip` */
  interface?: string;
  p2pPort?: number;
  rpcPort?: number;
}

export function validateNodeInit(i: NodeInitInput): { problems: string[]; warnings: string[] } {
  const p: string[] = [];
  const w: string[] = [];
  if (typeof i.state !== "string" || !STATE_RE.test(i.state))
    p.push("state: iki büyük harf (Governance üye kodu, ör. TR)");
  if (i.role !== "validator" && i.role !== "rpc") p.push("role: validator | rpc");
  if (!ipLiteralOk(i.ip)) p.push("ip: ilan edilen P2P adresi, IPv4 ya da IPv6 değişmezi (DNS adı değil)");
  else if (UNSPECIFIED(i.ip)) p.push("ip: 0.0.0.0 / :: ilan edilemez — eşlerin bağlanacağı gerçek adres");
  else if (unreachable(i.ip))
    w.push(
      `ip ${i.ip} yerel / özel ağ adresi: yalnız yerel denemede ya da işletmecilerin ortak özel ağında çalışır; başka işletmecinin düğümü bu adrese ulaşamayabilir`,
    );
  const itf = i.interface ?? i.ip;
  if (!ipLiteralOk(itf)) p.push("interface: P2P'nin dinleyeceği iç arayüzün adresi (IPv4 / IPv6 değişmezi)");
  else if (UNSPECIFIED(itf))
    p.push(
      "interface: 0.0.0.0 / :: kabul edilmez — P2P bütün arayüzlerde dinlemez; yalnız eşlerin geldiği iç arayüzün adresi (p2p-interface)",
    );
  for (const [n, v] of [
    ["p2p-port", i.p2pPort ?? 30303],
    ["rpc-port", i.rpcPort ?? 8545],
  ] as const)
    if (!portOk(v)) p.push(`${n}: 1–65535`);
  if ((i.p2pPort ?? 30303) === (i.rpcPort ?? 8545)) p.push("p2p-port ile rpc-port aynı olamaz");
  return { problems: p, warnings: w };
}

/**
 * Besu yapılandırma şablonu. Ağa bağlanma bilgisi (static-nodes, genesis, izin listesi) işletmecilerden gelir; yollar düğüm
 * klasörüne göredir (TOML'da ileri eğik çizgi). Kesin kurallar: RPC yalnız 127.0.0.1 (LP5; dışarıya network/rpc-proxy mTLS +
 * eth/net/web3 süzgeci), P2P yalnız belirli iç arayüzde (0.0.0.0 değil — `p2p-host` yalnız ilan edilen adrestir, dinlenen arayüzü
 * `p2p-interface` belirler; ikisi ayrı ayarlanmazsa Besu bütün arayüzlerde dinler), keşif kapalı (statik eşler), iki izin bayrağı
 * açık (LP1), WebSocket / GraphQL kapalı.
 */
export function besuTomlTemplate(dir: string, p: NodeProfile): string {
  const f = (name: string) => `${realResolve(dir).replace(/\\/g, "/")}/${name}`;
  return `# Tamga Network — Besu düğüm yapılandırması (şablon: tamga-onboard node init). ${p.state} · ${p.role}
# Kontrol: tamga-onboard node check --config besu.toml. Ayrıntı: ARCH-0002 §6, ADR-0052.
# genesis.json, static-nodes.json ve permissions_config.toml bu araçla üretilmez (aşağıdaki yorumlar).

data-path="${f("data")}"
# genesis.json: ağın işletmecilerinden alınır, sha256 özeti en az iki işletmeciyle bant dışı karşılaştırılır
genesis-file="${f("genesis.json")}"
# özel anahtar: yalnız bu makinede, yalnız sahibine okunur; yedeği şifreli ve çevrimdışı
node-private-key-file="${f("key")}"

# P2P — ilan edilen adres (bildirimdeki ip) ve DİNLENEN arayüz ayrı ayrı. p2p-interface 0.0.0.0 OLMAZ: yalnız eşlerin geldiği
# iç arayüz. Güvenlik duvarında P2P portu yalnız izin listesindeki eşlerin IP'lerine açık.
p2p-host="${p.ip}"
p2p-interface="${p.interface}"
p2p-port=${p.p2p_port}
discovery-enabled=false
# static-nodes.json: işletmecilerin verdiği validator enode'ları (enode://<anahtar>@<ip>:<port>)
static-nodes-file="${f("static-nodes.json")}"

# JSON-RPC — YALNIZ 127.0.0.1. QBFT / PERM / ADMIN yalnız bu makineden (oy, izin listesi yükleme). Dışarıya yalnız ETH, NET, WEB3:
# nginx (TLS 1.3 + zorunlu istemci sertifikası) → yöntem süzgeci (network/rpc-proxy/filter.mjs) → bu uç.
rpc-http-enabled=true
rpc-http-host="127.0.0.1"
rpc-http-port=${p.rpc_port}
rpc-http-api=["ETH","NET","WEB3","QBFT","PERM","ADMIN"]
host-allowlist=["localhost","127.0.0.1"]
rpc-ws-enabled=false
graphql-http-enabled=false
min-gas-price=0

# Yerel izinlendirme (ADR-0052 K1): iki liste de açık, aynı dosya. Dosya ELLE YAZILMAZ — zincirden üretilir:
#   npm run trust:chain-permissions -- render --operator ${p.state} --out permissions_config.rendered.toml
# sonra kopyalanır ve perm_reloadPermissionsFromFile (yalnız 127.0.0.1) ile yüklenir; trust:chain-permissions check denetler.
permissions-nodes-config-file-enabled=true
permissions-nodes-config-file="${f("permissions_config.toml")}"
permissions-accounts-config-file-enabled=true
permissions-accounts-config-file="${f("permissions_config.toml")}"
`;
}

/** `node init` sonrasında yapılacaklar (genesis yönergesi dahil). */
export function nodeNextSteps(p: NodeProfile): string[] {
  return [
    "Genesis bu araçla üretilmez ve indirilmez: ağın genesis.json dosyasını katılım yazışmasında bildirilen kanaldan, ağın işletmecilerinden alın; sha256 özetini en az iki ayrı işletmeciyle başka bir kanaldan karşılaştırın — özet aynı değilse düğümü başlatmayın. Düğüm çalışınca `node check --chain-rpc <işletmecinin ucu>` genesis blok özetini de karşılaştırır.",
    "Gerçek Tamga zinciri bugün kurulu değildir (ikinci bağımsız işletmeci ve eşik olmadan kurulmaz); bu adımlar hazırlık ve yerel deneme içindir.",
    `Bildirim: tamga-onboard node declare <klasör> --contact <kurumun görev adresi> → operatöre gönderin (özel anahtar ASLA gönderilmez).${p.role === "validator" ? ` Governance'a bildirilecek validator adresi: ${p.address}.` : ""}`,
    "static-nodes.json: işletmecilerin verdiği validator enode'larıyla yazın (keşif kapalıdır).",
    `İzin listesi: trust:chain-permissions render --operator ${p.state} ile zincirden üretilir; elle yazılmaz.`,
    "RPC'yi dışarı açmayın; dış okuma gerekiyorsa network/rpc-proxy (nginx mTLS + eth/net/web3 süzgeci).",
    "Düğüm başlayınca: tamga-onboard node check <klasör> [--chain-rpc <ağdaki bir uç>] [--public-rpc <dış uç>] [--permissions-file <çizim>]",
    p.role === "validator"
      ? "Validator olmak: önce tam düğüm olarak eşleşip senkron olun; ekleme oyunu mevcut validator'lar kendi düğümlerinde verir (bu araç oy vermez)."
      : "RPC düğümü yalnız sizin izin listenize girer (render --operator); öteki işletmecilerin listesine girmez.",
  ];
}

export interface NodeInitOptions {
  /** Bulut eşitleme klasörüne açık onay (`--allow-synced`; MCP'de yok) */
  allowSynced?: boolean;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
}

export interface NodeInitResult {
  dir: string;
  key: string;
  files: string[];
  profile: NodeProfile;
  enode: string;
  warnings: string[];
}

/**
 * Düğüm klasörünü yazar: `key` (özel anahtar; yalnız sahibi), `key.pub`, `node.json`, `besu.toml`, `.gitignore`. Dosyalardan biri
 * bile varsa hiçbiri yazılmaz. Bulut eşitleme klasöründe (OneDrive vb.) yalnız `allowSynced` ile. Ağa bağlanmaz.
 */
export function initNode(dir: string, i: NodeInitInput, o: NodeInitOptions = {}): NodeInitResult {
  const v = validateNodeInit(i);
  if (v.problems.length) throw new Error(v.problems.join("; "));
  const synced = syncedFolder(dir, o.env);
  if (synced && !o.allowSynced)
    throw new Error(
      `düğüm klasörü bulut eşitleme klasöründe (${synced}): düğüm anahtarı kurum dışındaki bir sunucuya kopyalanır — eşitlenmeyen bir klasör seçin (ya da bilerek --allow-synced)`,
    );
  const names = ["key", "key.pub", "node.json", "besu.toml"];
  const clash = names.filter((f) => existsSync(within(dir, f)));
  if (clash.length)
    throw new Error(
      `zaten var (üzerine yazılmaz; yeni anahtar gerekiyorsa eski dosyaları kendiniz taşıyın): ${clash.join(", ")}`,
    );
  mkdirSync(dir, { recursive: true });
  within(dir, "key"); // oluşturulduktan sonra da (bağ yarışı) klasörün içinde mi
  const k = generateNodeKey();
  const profile: NodeProfile = {
    state: i.state,
    role: i.role,
    node_public_key: k.publicKey,
    address: k.address,
    ip: i.ip,
    interface: i.interface ?? i.ip,
    p2p_port: i.p2pPort ?? 30303,
    rpc_port: i.rpcPort ?? 8545,
  };
  const keyPath = within(dir, "key");
  writePrivateKey(keyPath, k.keyFile, { platform: o.platform });
  const w = (f: string, s: string) => writeFileSync(within(dir, f), s, { flag: "wx" });
  w("key.pub", `0x${k.publicKey}\n`);
  w("node.json", JSON.stringify(profile, null, 2) + "\n");
  w("besu.toml", besuTomlTemplate(dir, profile));
  const gi = within(dir, ".gitignore");
  if (!existsSync(gi)) writeFileSync(gi, "# düğüm anahtarı ve zincir verisi depoya girmez\nkey\ndata/\n");
  const warnings = [...v.warnings];
  warnings.push(
    "düğüm anahtarı yazılım anahtarıdır (Besu düğüm anahtarı dosyası parolayla şifrelenemez): dosya yalnız sahibine okunur — yedeği şifreli ve çevrimdışı tutun; kimseyle paylaşmayın",
  );
  if (synced) warnings.push(`anahtar bulut eşitleme klasöründe (${synced}) — açık onayla yazıldı; eşitlemeyi kapatın`);
  return {
    dir,
    key: keyPath,
    files: names,
    profile,
    enode: enodeOf(profile.node_public_key, profile.ip, profile.p2p_port),
    warnings,
  };
}

/** Düğüm klasörünü okur (`node.json`; bilinmeyen alan ya da bozuk değer → hata). Özel anahtar okunmaz. */
export function readNodeDir(dir: string): { profile: NodeProfile; config?: TomlTable; configPath?: string } {
  const pf = within(dir, "node.json");
  if (!existsSync(pf)) throw new Error(`${pf} yok — önce: tamga-onboard node init`);
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readFileSync(pf, "utf8"));
  } catch {
    throw new Error("node.json okunamadı (JSON değil)");
  }
  const bad = Object.keys(raw ?? {}).filter((k) => !PROFILE_KEYS.includes(k));
  if (bad.length) throw new Error(`node.json: bilinmeyen alan: ${bad.map(clean).join(", ")}`);
  const v = validateNodeInit({
    state: raw.state as string,
    role: raw.role as NodeRole,
    ip: raw.ip as string,
    interface: raw.interface as string,
    p2pPort: raw.p2p_port as number,
    rpcPort: raw.rpc_port as number,
  });
  const pk = normalizePublicKey(raw.node_public_key as string);
  if (!pk) v.problems.push("node_public_key geçersiz");
  else if (nodeAddressOf(pk) !== String(raw.address).toLowerCase())
    v.problems.push("address açık anahtarla eşleşmiyor");
  if (v.problems.length) throw new Error(`node.json geçersiz: ${v.problems.join("; ")}`);
  const profile = { ...(raw as unknown as NodeProfile), node_public_key: pk! };
  const cp = within(dir, "besu.toml");
  if (!existsSync(cp)) return { profile };
  return { profile, config: readToml(cp), configPath: cp };
}

// ───────────────────────────── declare ─────────────────────────────

export interface NodeDeclaration {
  format: typeof NODE_DECLARATION_FORMAT;
  state: string;
  role: NodeRole;
  node_public_key: string;
  ip: string;
  p2p_port: number;
  contact: string;
}
const DECL_KEYS = ["$schema", "format", "state", "role", "node_public_key", "ip", "p2p_port", "contact"];
const CONTACT = /^(mailto:)?[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$|^https:\/\/[^\s]+$/i;
/** Kurumların görev posta kutularında sık görülen yerel bölümler (bunlar dışındaki e-postada uyarı: kişi adı olmasın) */
const ROLE_MAILBOX =
  /^(noc|soc|ops|operations?|operator|it|bt|bilgi-?islem|bidb|support|destek|help|helpdesk|info|bilgi|security|guvenlik|cert|csirt|sysadmin|admin|network|ag|blockchain|zincir|tamga|node|nodes|validator|contact|iletisim|kep|infra|altyapi)([._+-][a-z0-9]+)*$/i;

/**
 * `tamga-node-declaration/1` doğrulaması — `network/permissions/schema/node-declaration.schema.json` ile aynı kurallar (test ikisini
 * birlikte dener). Hata listesi boşsa geçerli.
 */
export function validateNodeDeclaration(x: unknown): string[] {
  const errs: string[] = [];
  if (typeof x !== "object" || x === null || Array.isArray(x)) return ["nesne değil"];
  const o = x as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!DECL_KEYS.includes(k)) errs.push(`bilinmeyen alan: ${clean(k)}`);
  if (o.format !== NODE_DECLARATION_FORMAT) errs.push(`format "${NODE_DECLARATION_FORMAT}" olmalı`);
  if (typeof o.state !== "string" || !STATE_RE.test(o.state)) errs.push("state: iki büyük harf (ISO 3166-1)");
  if (o.role !== "validator" && o.role !== "rpc") errs.push("role: validator | rpc");
  if (typeof o.node_public_key !== "string" || !/^[0-9a-f]{128}$/.test(o.node_public_key))
    errs.push("node_public_key: 128 küçük onaltılık karakter (04 öneki ve 0x olmadan)");
  if (typeof o.ip !== "string" || !ipLiteralOk(o.ip)) errs.push("ip: IPv4 ya da IPv6 değişmezi");
  if (!portOk(o.p2p_port)) errs.push("p2p_port: 1–65535");
  if (typeof o.contact !== "string" || o.contact.length > 254 || !CONTACT.test(o.contact))
    errs.push("contact: kurumun görev e-postası ya da https adresi");
  return errs;
}

export interface DeclarationInput {
  state: string;
  role: NodeRole;
  node_public_key: string;
  ip: string;
  p2p_port: number;
  contact: string;
}

/** Bildirimi kurar ve doğrular. Kişi adına benzeyen iletişim adresinde uyarı (görev adresi olmalı). */
export function buildNodeDeclaration(i: DeclarationInput): {
  declaration?: NodeDeclaration;
  address?: string;
  problems: string[];
  warnings: string[];
} {
  const pk = normalizePublicKey(i.node_public_key);
  const contact = String(i.contact ?? "").trim();
  const d = {
    format: NODE_DECLARATION_FORMAT,
    state: i.state,
    role: i.role,
    node_public_key: pk ?? String(i.node_public_key ?? ""),
    ip: typeof i.ip === "string" ? i.ip.toLowerCase() : i.ip,
    p2p_port: i.p2p_port,
    contact,
  };
  const problems = validateNodeDeclaration(d);
  const warnings: string[] = [];
  if (!problems.length) {
    if (UNSPECIFIED(d.ip)) problems.push("ip: 0.0.0.0 / :: ilan edilemez");
    else if (unreachable(d.ip))
      warnings.push(`ip ${d.ip} yerel / özel ağ adresi — yalnız yerel denemede ya da ortak özel ağda bağlanılabilir`);
    const mail = /^(mailto:)?([^@]+)@/i.exec(contact)?.[2];
    if (mail && !ROLE_MAILBOX.test(mail))
      warnings.push(
        `iletişim "${clean(contact)}" bir görev posta kutusu gibi görünmüyor: kişi adı yazılmaz — kurumun ortak adresini (ör. noc@, operations@) ya da https sayfasını kullanın`,
      );
  }
  if (problems.length) return { problems, warnings };
  return { declaration: d as NodeDeclaration, address: nodeAddressOf(d.node_public_key), problems, warnings };
}

/** Bildirim dosyası adı: `<cc>-<ad>.json` (network/permissions/nodes düzeni). */
export const declarationFileName = (state: string, name: string) => {
  if (!NAME_RE.test(name)) throw new Error("ad: küçük harf, rakam, tire (en çok 32)");
  return `${state.toLowerCase()}-${name}.json`;
};

// ───────────────────────────── TOML (yalnız düz anahtar = değer) ─────────────────────────────

export type TomlValue = string | number | boolean | string[];
export type TomlTable = Record<string, TomlValue>;

/**
 * Besu yapılandırması ve izin dosyası için küçük okuyucu: `anahtar=değer` (dize, sayı, mantıksal, dize dizisi; çok satırlı dizi),
 * `#` yorumları. Tablo başlığı (`[x]`) ve iç içe yapı desteklenmez → hata (yanlış okunmaktansa durmak).
 */
export function parseToml(text: string): TomlTable {
  const out: TomlTable = {};
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const strip = (l: string) => {
    let q = false;
    for (let i = 0; i < l.length; i++) {
      if (l[i] === '"' && l[i - 1] !== "\\") q = !q;
      else if (l[i] === "#" && !q) return l.slice(0, i);
    }
    return l;
  };
  const str = (s: string, n: number) => {
    const m = /^"((?:[^"\\]|\\.)*)"$/.exec(s.trim());
    if (!m) throw new Error(`TOML satır ${n}: dize bekleniyor`);
    return m[1].replace(/\\(.)/g, "$1");
  };
  for (let n = 0; n < lines.length; n++) {
    const l = strip(lines[n]).trim();
    if (!l) continue;
    const eq = l.indexOf("=");
    if (eq < 1) throw new Error(`TOML satır ${n + 1}: "anahtar=değer" bekleniyor`);
    const key = l.slice(0, eq).trim().replace(/^"|"$/g, "");
    if (!/^[A-Za-z0-9_.-]+$/.test(key)) throw new Error(`TOML satır ${n + 1}: anahtar geçersiz`);
    let v = l.slice(eq + 1).trim();
    if (v.startsWith("[")) {
      const start = n + 1;
      while (!v.includes("]")) {
        if (++n >= lines.length) throw new Error(`TOML satır ${start}: dizi kapanmadı`);
        v += " " + strip(lines[n]).trim();
      }
      const inner = v.slice(1, v.lastIndexOf("]")).trim();
      if (v.slice(v.lastIndexOf("]") + 1).trim()) throw new Error(`TOML satır ${n + 1}: dizi sonrası fazlalık`);
      out[key] = inner
        ? inner
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
            .map((x) => str(x, start))
        : [];
    } else if (v.startsWith('"')) out[key] = str(v, n + 1);
    else if (v === "true" || v === "false") out[key] = v === "true";
    else if (/^-?\d+$/.test(v)) out[key] = Number(v);
    else throw new Error(`TOML satır ${n + 1}: desteklenmeyen değer`);
  }
  return out;
}

/** Dosyadan TOML (en çok 1 MB). */
export function readToml(path: string): TomlTable {
  if (statSync(path).size > 1024 * 1024) throw new Error("TOML dosyası çok büyük (1 MB üstü)");
  return parseToml(readFileSync(path, "utf8"));
}

// ───────────────────────────── JSON-RPC (salt okur) ─────────────────────────────

export type RpcOutcome =
  | { kind: "result"; value: unknown }
  | { kind: "error"; status: number; code?: number; message: string }
  | { kind: "network"; message: string; tls?: boolean };
export type Rpc = (url: string, method: string, params?: unknown[]) => Promise<RpcOutcome>;

/** Bir uç adresine hangi ağ sınıflarına izin var. */
export interface RpcPolicy {
  /** 127.0.0.0/8, ::1 */
  loopback: boolean;
  /** öteki yerel / özel ağlar (RFC 1918, bağlantı-yerel 169.254 — bulut meta veri ucu —, CGNAT, ULA …) */
  private: boolean;
  /** dış (genel) adreste http (varsayılan yalnız https; LP5 — dış uç TLS'lidir) */
  publicHttp?: boolean;
}

export interface RpcOptions {
  /** Uç adresi başına politika (CLI: sabit; MCP: TAMGA_ önekli ortam değişkenindeki listeye göre) */
  policy: (u: URL) => RpcPolicy;
  timeoutMs?: number;
  /** mTLS istemci sertifikası (yalnız CLI; dosya içeriği, PEM) */
  tls?: { cert: string; key: string };
  resolveAll?: (host: string) => Promise<LookupAddress[]>;
}

/** Yalnız okuyan JSON-RPC yöntemleri — denetim hiçbir zaman bu kümenin dışında yöntem çağırmaz (oy, izin yükleme, işlem yok). */
export const READ_ONLY_METHODS = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_syncing",
  "eth_getBlockByNumber",
  "net_version",
  "net_peerCount",
  "admin_nodeInfo",
  "admin_peers",
  "perm_getNodesAllowlist",
  "perm_getAccountsAllowlist",
  "qbft_getValidatorsByBlockNumber",
  "debug_getBadBlocks",
  "txpool_besuStatistics",
  "eth_accounts",
  "web3_clientVersion",
]);

/**
 * Varsayılan JSON-RPC taşıyıcısı: POST, en çok 1 MB yanıt, zaman aşımı, yönlendirme İZLENMEZ, adreste kullanıcı bilgisi yok.
 * Alan adı bağlantı anında çözülür ve her adres politikaya göre denetlenir (DNS yeniden bağlama da yakalanır). http yalnız
 * loopback / özel ağ adresinde (izinliyse) ya da `publicHttp` ile.
 */
export function defaultRpc(o: RpcOptions): Rpc {
  const resolveAll =
    o.resolveAll ?? (async (h: string) => (await import("node:dns/promises")).lookup(h, { all: true, verbatim: true }));
  const classify = (ip: string) => (isLoopback(ip) ? "loopback" : isPrivateAddress(ip) ? "private" : "public");
  const verdict = (ip: string, u: URL, pol: RpcPolicy): string | null => {
    const c = classify(ip);
    if (c === "loopback" && !pol.loopback) return `yerel (loopback) adres izinli değil: ${u.host} → ${ip}`;
    if (c === "private" && !pol.private)
      return `yerel / özel ağ adresi izinli değil: ${u.host} → ${ip} (--allow-private)`;
    if (c === "public" && u.protocol === "http:" && !pol.publicHttp) return `dış adreste yalnız https (LP5): ${u.host}`;
    return null;
  };
  return async (url, method, params = []) => {
    if (!READ_ONLY_METHODS.has(method)) throw new Error(`salt-okur olmayan yöntem çağrılmaz: ${method}`);
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return { kind: "network", message: "adres geçersiz" };
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") return { kind: "network", message: "yalnız http(s)" };
    if (u.username || u.password) return { kind: "network", message: "adreste kullanıcı bilgisi kabul edilmez" };
    const pol = o.policy(u);
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host)) {
      const bad = verdict(host, u, pol);
      if (bad) return { kind: "network", message: bad };
    }
    const lookup = (h: string, opts: { all?: boolean }, cb: (...a: unknown[]) => void) => {
      resolveAll(h).then(
        (addrs) => {
          if (!addrs.length) return cb(Object.assign(new Error(`çözülemedi: ${h}`), { code: "ENOTFOUND" }), "");
          for (const a of addrs) {
            const bad = verdict(a.address, u, pol);
            if (bad) return cb(Object.assign(new Error(bad), { code: "EPOLICY" }), "");
          }
          if (opts?.all) return cb(null, addrs);
          cb(null, addrs[0]!.address, addrs[0]!.family);
        },
        (e: Error) => cb(e, ""),
      );
    };
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
    return new Promise<RpcOutcome>((ok) => {
      const req = (u.protocol === "https:" ? httpsRequest : httpRequest)(
        u,
        {
          method: "POST",
          headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) },
          timeout: o.timeoutMs ?? 10000,
          lookup: lookup as never,
          ...(u.protocol === "https:" && o.tls ? { cert: o.tls.cert, key: o.tls.key } : {}),
        },
        (res) => {
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (c: Buffer) => {
            size += c.length;
            if (size > 1024 * 1024) return req.destroy(new Error("yanıt çok büyük (1 MB üstü)"));
            chunks.push(c);
          });
          res.on("end", () => {
            const status = res.statusCode ?? 0;
            if (status >= 300 && status < 400)
              return ok({ kind: "error", status, message: "yönlendirme izlenmez (JSON-RPC ucu doğrudan verilmeli)" });
            let j: { result?: unknown; error?: { code?: number; message?: string } } | undefined;
            try {
              j = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            } catch {
              return ok({ kind: "error", status, message: `JSON-RPC yanıtı değil (HTTP ${status})` });
            }
            if (j && typeof j === "object" && "error" in j && j.error)
              return ok({ kind: "error", status, code: j.error.code, message: clean(j.error.message ?? "hata") });
            if (status !== 200 || !j || !("result" in j))
              return ok({ kind: "error", status, message: `HTTP ${status}` });
            ok({ kind: "result", value: j.result });
          });
          res.on("error", (e) => ok({ kind: "network", message: clean(e.message) }));
        },
      );
      req.on("timeout", () => req.destroy(new Error("zaman aşımı")));
      req.on("error", (e: NodeJS.ErrnoException) =>
        ok({
          kind: "network",
          message: clean(e.message),
          tls:
            u.protocol === "https:" &&
            (/certificate|handshake|alert|ssl|tls/i.test(e.message) || ["EPROTO", "ECONNRESET"].includes(e.code ?? "")),
        }),
      );
      req.end(body);
    });
  };
}

// ───────────────────────────── check ─────────────────────────────

export interface NodeCheckInput {
  /** Düğümün kendi JSON-RPC ucu (yönetim ucu; LP5 gereği 127.0.0.1) */
  rpc: string;
  /** Ağdaki başka bir uç (işletmecinin ucu ya da kendi öteki düğümünüz): senkron, aynı zincir, izin listesi karşılaştırması */
  chainRpc?: string;
  /** Düğümün dışarıya açılan ucu (vekil): yalnız eth/net/web3 mi */
  publicRpc?: string;
  /** node.json (init çıktısı) */
  profile?: NodeProfile;
  /** besu.toml (ayrıştırılmış) */
  config?: TomlTable;
  /** trust:chain-permissions render çıktısı (ayrıştırılmış) */
  permissions?: TomlTable;
  declaration?: NodeDeclaration;
  now?: Date;
}

const hexNum = (v: unknown) => (typeof v === "string" && /^0x[0-9a-f]+$/i.test(v) ? parseInt(v, 16) : NaN);
const normEnode = (e: string) => e.trim().toLowerCase().replace(/\?.*$/, "");
const setDiff = (a: string[], b: string[]) => {
  const sb = new Set(b);
  return a.filter((x) => !sb.has(x));
};
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return "";
  }
};

/** Dış uçta reddedilmesi gereken (salt-okur) yöntemler — her yasak ad alanından bir tane; durum değiştiren yöntem YOK. */
export const PROBE_DENIED = [
  "admin_nodeInfo",
  "perm_getNodesAllowlist",
  "qbft_getValidatorsByBlockNumber",
  "debug_getBadBlocks",
  "txpool_besuStatistics",
  "eth_accounts",
] as const;
export const PROBE_ALLOWED = ["eth_blockNumber", "net_version"] as const;

/**
 * Düğüm denetimi (salt okur). Satır kimlikleri N1–N10. Ağdan okunan metin
 * `clean` ile temizlenir ve güvenilmeyen veridir. Operatör tarafı denetimler (bildirim eşleşmesi, blok önerme, oy,
 * hesap izni) bu araçta yoktur — yazma ya da Governance verisi gerektirir.
 */
export async function nodeChecks(input: NodeCheckInput, deps: { rpc: Rpc }): Promise<Row[]> {
  const rows: Row[] = [];
  const call = (m: string, p: unknown[] = []) => deps.rpc(input.rpc, m, p);
  const why = (r: RpcOutcome) => (r.kind === "result" ? "" : r.message);
  const now = input.now ?? new Date();

  // N1 — uç
  const cid = await call("eth_chainId");
  if (cid.kind !== "result") {
    rows.push({
      id: "N1",
      check: "Düğümün yerel RPC ucu",
      result: "fail",
      detail: `eth_chainId yanıtsız: ${why(cid)}`,
      fix: "düğüm çalışıyor mu (log), rpc-http-enabled ve rpc-http-port doğru mu; komutu düğümün kendi makinesinde --rpc http://127.0.0.1:<port> ile çalıştırın",
    });
    rows.push(...configRows(input));
    return rows;
  }
  const chainId = hexNum(cid.value);
  rows.push({ id: "N1", check: "Düğümün yerel RPC ucu", result: "pass", detail: `chainId ${chainId}` });

  // N2 — senkron
  const syncing = await call("eth_syncing");
  const bn = await call("eth_blockNumber");
  const height = bn.kind === "result" ? hexNum(bn.value) : NaN;
  let syncedNow = syncing.kind === "result" && syncing.value === false;
  if (input.chainRpc) {
    const rc = await deps.rpc(input.chainRpc, "eth_chainId");
    const rb = await deps.rpc(input.chainRpc, "eth_blockNumber");
    if (rc.kind !== "result" || rb.kind !== "result") {
      rows.push({
        id: "N2",
        check: "Senkron",
        result: "fail",
        detail: `karşılaştırma ucu yanıtsız: ${why(rc.kind !== "result" ? rc : rb)}`,
        fix: "--chain-rpc adresini ve erişimi (mTLS: --client-cert/--client-key) denetleyin",
      });
    } else {
      const ref = hexNum(rb.value);
      const diff = ref - height;
      const sameChain = hexNum(rc.value) === chainId;
      syncedNow &&= sameChain && Math.abs(diff) <= 2;
      rows.push({
        id: "N2",
        check: "Senkron",
        result: !sameChain
          ? "fail"
          : syncing.kind === "result" && syncing.value === false && Math.abs(diff) <= 2
            ? "pass"
            : "fail",
        detail: !sameChain
          ? `chainId farklı (düğüm ${chainId}, karşılaştırma ${hexNum(rc.value)})`
          : `blok ${height} · karşılaştırma ${ref} (fark ${diff}) · eth_syncing ${syncing.kind === "result" ? (syncing.value === false ? "false" : "sürüyor") : "yanıtsız"}`,
        fix:
          sameChain && Math.abs(diff) > 2
            ? "eşleşmeyi bekleyin; eş yoksa izin listesi ve static-nodes.json (N4, N6)"
            : !sameChain
              ? "genesis yanlış: işletmecilerden doğru genesis.json'ı alın, veriyi silip yeniden başlatın"
              : undefined,
      });
      // N3 — aynı zincir (genesis bloğu)
      const g1 = await call("eth_getBlockByNumber", ["0x0", false]);
      const g2 = await deps.rpc(input.chainRpc, "eth_getBlockByNumber", ["0x0", false]);
      const h = (r: RpcOutcome) =>
        r.kind === "result" && r.value && typeof r.value === "object"
          ? String((r.value as { hash?: unknown }).hash ?? "")
          : "";
      const a = h(g1);
      const b = h(g2);
      rows.push({
        id: "N3",
        check: "Aynı zincir (genesis bloğu)",
        result: a && b ? (a === b ? "pass" : "fail") : "warn",
        detail:
          a && b
            ? a === b
              ? `genesis ${shortAddr(a)}`
              : `genesis farklı: ${shortAddr(a)} / ${shortAddr(b)}`
            : "genesis bloğu okunamadı",
        fix: a && b && a !== b ? "yanlış genesis.json: işletmecilerden alıp özetini bant dışı doğrulayın" : undefined,
      });
    }
  } else
    rows.push({
      id: "N2",
      check: "Senkron",
      result: syncing.kind !== "result" ? "fail" : syncing.value === false ? "warn" : "fail",
      detail:
        syncing.kind !== "result"
          ? `eth_syncing yanıtsız: ${why(syncing)}`
          : `blok ${height} · eth_syncing ${syncing.value === false ? "false" : "sürüyor"} — karşılaştırma ucu verilmedi`,
      fix: "ağdaki bir uçla karşılaştırma: --chain-rpc <adres>",
    });

  // N4 — eşler
  const pc = await call("net_peerCount");
  const peers = pc.kind === "result" ? hexNum(pc.value) : NaN;
  rows.push({
    id: "N4",
    check: "Eşler",
    result: pc.kind !== "result" ? "fail" : peers >= 1 ? "pass" : "fail",
    detail: pc.kind !== "result" ? `net_peerCount yanıtsız: ${why(pc)}` : `${peers} eş`,
    fix:
      peers >= 1
        ? undefined
        : "eş yok: düğümünüzün bildirimi işletmecilerin izin listesinde mi (render + yükleme), static-nodes.json, güvenlik duvarında P2P portu; statik eş ~1 dk'da bağlanır",
  });

  // N5 — düğüm kimliği (anahtar ↔ node.json / bildirim)
  const ni = await call("admin_nodeInfo");
  const liveKey =
    ni.kind === "result" && ni.value && typeof ni.value === "object"
      ? normalizePublicKey(String((ni.value as { id?: unknown }).id ?? ""))
      : null;
  const liveAddr = liveKey ? nodeAddressOf(liveKey) : input.profile?.address;
  {
    const exp = input.profile?.node_public_key ?? input.declaration?.node_public_key;
    const problems: string[] = [];
    if (liveKey && input.profile && liveKey !== input.profile.node_public_key)
      problems.push("düğüm node.json'daki anahtarla çalışmıyor");
    if (liveKey && input.declaration && liveKey !== input.declaration.node_public_key)
      problems.push("düğüm bildirimdeki anahtarla çalışmıyor");
    const listen =
      ni.kind === "result" && ni.value && typeof ni.value === "object"
        ? (ni.value as { ports?: { listener?: unknown } }).ports?.listener
        : undefined;
    if (input.declaration && typeof listen === "number" && listen !== input.declaration.p2p_port)
      problems.push(`P2P portu ${listen}, bildirimde ${input.declaration.p2p_port}`);
    rows.push({
      id: "N5",
      check: "Düğüm kimliği (anahtar ↔ node.json / bildirim)",
      result: !liveKey ? "warn" : problems.length ? "fail" : exp ? "pass" : "warn",
      detail: !liveKey
        ? `admin_nodeInfo okunamadı (${clean(why(ni))}) — ADMIN ad alanı yalnız 127.0.0.1'de açık olmalı`
        : problems.length
          ? problems.join("; ")
          : `adres ${shortAddr(liveAddr!)}${exp ? " — beklenen anahtar" : " — karşılaştırılacak node.json / bildirim verilmedi"}`,
      fix: problems.length
        ? "besu.toml node-private-key-file doğru dosyayı mı gösteriyor; anahtar değiştiyse yeni bildirim (ve validator için Governance adresi) gerekir"
        : undefined,
    });
  }

  // N6 — izin listesi
  {
    const na = await call("perm_getNodesAllowlist");
    const aa = await call("perm_getAccountsAllowlist");
    if (na.kind !== "result" || aa.kind !== "result" || !Array.isArray(na.value) || !Array.isArray(aa.value))
      rows.push({
        id: "N6",
        check: "İzin listesi",
        result: "fail",
        detail: `perm_get* okunamadı (${clean(why(na.kind !== "result" ? na : aa))})`,
        fix: "yerel izinlendirme açık mı (iki permissions-*-config-file-enabled bayrağı) ve PERM ad alanı 127.0.0.1'de açık mı",
      });
    else {
      const nodes = (na.value as unknown[]).map((x) => normEnode(String(x)));
      const accts = (aa.value as unknown[]).map((x) => String(x).toLowerCase());
      const parts: string[] = [`düğüm ${nodes.length}, hesap ${accts.length}`];
      let result: Row["result"] = "pass";
      let fix: string | undefined;
      if (input.permissions) {
        const fn = ((input.permissions["nodes-allowlist"] ?? []) as string[]).map(normEnode);
        const fa = ((input.permissions["accounts-allowlist"] ?? []) as string[]).map((x) => x.toLowerCase());
        const d = [
          setDiff(fn, nodes).length,
          setDiff(nodes, fn).length,
          setDiff(fa, accts).length,
          setDiff(accts, fa).length,
        ];
        if (d.some(Boolean)) {
          result = "fail";
          parts.push(`çizimle fark: düğüm eksik ${d[0]} / fazla ${d[1]}, hesap eksik ${d[2]} / fazla ${d[3]}`);
          fix =
            "çizimi düğümün dosyasına kopyalayıp perm_reloadPermissionsFromFile (yalnız 127.0.0.1); sonra trust:chain-permissions check";
        } else parts.push("çizimle (trust:chain-permissions render) aynı");
      }
      if (input.chainRpc) {
        const ra = await deps.rpc(input.chainRpc, "perm_getAccountsAllowlist");
        const rn = await deps.rpc(input.chainRpc, "perm_getNodesAllowlist");
        if (ra.kind === "result" && Array.isArray(ra.value)) {
          const ref = (ra.value as unknown[]).map((x) => String(x).toLowerCase());
          const da = setDiff(ref, accts).length + setDiff(accts, ref).length;
          if (da) {
            result = "fail";
            parts.push(`hesap listesi karşılaştırma ucundan farklı (${da} fark; LP3)`);
            fix ??= "iki tarafta da aynı blokta render (--block) → yükle → check; fark işletme olayıdır";
          } else parts.push("hesap listesi karşılaştırma ucuyla aynı");
          if (rn.kind === "result" && Array.isArray(rn.value)) {
            const refN = (rn.value as unknown[]).map((x) => normEnode(String(x)));
            const dn = setDiff(refN, nodes).length + setDiff(nodes, refN).length;
            if (dn) {
              if (result === "pass") result = "warn";
              parts.push(`düğüm listesi farklı (${dn}) — işletmecinin kendi RPC düğümleri farkı açıklayabilir`);
            }
          }
        } else parts.push("karşılaştırma ucunda PERM kapalı (beklenen: dışarıya açılmaz)");
      }
      if (!input.permissions && !(input.chainRpc && result !== "pass")) {
        if (result === "pass") result = "warn";
        fix ??=
          "zincirle karşılaştırmak için: trust:chain-permissions render --operator <CC> → --permissions-file <çizim>";
      }
      if (liveKey && input.profile?.role === "validator" && !nodes.some((e) => e.includes(liveKey)))
        parts.push("kendi enode'unuz kendi listenizde yok (bildirim render'a girmemiş olabilir)");
      rows.push({ id: "N6", check: "İzin listesi", result, detail: parts.join(" · "), fix });
    }
  }

  // N7 — validator kümesi
  {
    const role = input.profile?.role ?? input.declaration?.role;
    if (role !== "validator")
      rows.push({
        id: "N7",
        check: "Validator kümesi",
        result: "skip",
        detail: role === "rpc" ? "RPC düğümü (validator değil)" : "rol bilinmiyor (node.json ya da bildirim verilmedi)",
      });
    else {
      const vs = await call("qbft_getValidatorsByBlockNumber", ["latest"]);
      const list =
        vs.kind === "result" && Array.isArray(vs.value)
          ? (vs.value as unknown[]).map((x) => String(x).toLowerCase())
          : null;
      const me = (liveAddr ?? input.profile?.address ?? "").toLowerCase();
      rows.push({
        id: "N7",
        check: "Validator kümesi",
        result: !list ? "warn" : list.includes(me) ? "pass" : "warn",
        detail: !list
          ? `qbft_getValidatorsByBlockNumber okunamadı (${clean(why(vs))})`
          : list.includes(me)
            ? `${shortAddr(me)} kümede (${list.length} validator)`
            : `${shortAddr(me)} henüz kümede değil (${list.length} validator)`,
        fix:
          list && !list.includes(me)
            ? "beklenen sıra: tam düğüm olarak senkron → mevcut validator'ların ekleme oyu (bu araç oy vermez); blok önermeyi operatör denetler"
            : undefined,
      });
    }
  }

  // N8 — dışarıya açılan yüzey
  {
    const own = hostOf(input.rpc);
    if (own && !isLoopback(own) && ni.kind === "result")
      rows.push({
        id: "N8",
        check: "RPC dışarıya kapalı",
        result: "fail",
        detail: `yönetim yöntemi (admin_nodeInfo) ${clean(own)} adresinden yanıt verdi — RPC yalnız 127.0.0.1'de dinlemeli`,
        fix: 'besu.toml: rpc-http-host="127.0.0.1"; dış erişim yalnız network/rpc-proxy (mTLS + eth/net/web3)',
      });
    if (input.publicRpc) {
      const answered: string[] = [];
      let tlsRefused = 0;
      let net = 0;
      for (const m of PROBE_DENIED) {
        const r = await deps.rpc(input.publicRpc, m, m === "qbft_getValidatorsByBlockNumber" ? ["latest"] : []);
        if (r.kind === "result") answered.push(m);
        else if (r.kind === "network") r.tls ? tlsRefused++ : net++;
      }
      const allowedOk: string[] = [];
      for (const m of PROBE_ALLOWED) if ((await deps.rpc(input.publicRpc, m)).kind === "result") allowedOk.push(m);
      rows.push({
        id: "N8",
        check: "Dış uçta yalnız eth/net/web3",
        result: answered.length
          ? "fail"
          : tlsRefused === PROBE_DENIED.length
            ? "warn"
            : net === PROBE_DENIED.length
              ? "fail"
              : allowedOk.length === PROBE_ALLOWED.length
                ? "pass"
                : "warn",
        detail: answered.length
          ? `yasak yöntem yanıt verdi: ${answered.join(", ")}`
          : tlsRefused === PROBE_DENIED.length
            ? "TLS el sıkışması istemci sertifikasız reddedildi (mTLS) — yöntem süzgeci sertifikayla denenmeli"
            : net === PROBE_DENIED.length
              ? "dış uca ulaşılamadı"
              : `admin/perm/qbft/debug/txpool/eth_accounts reddedildi; izinli: ${allowedOk.join(", ") || "yok"}`,
        fix: answered.length
          ? "dış uç yalnız network/rpc-proxy üzerinden (filter.mjs: eth/net/web3); Besu RPC'si dışarı açılmaz"
          : tlsRefused === PROBE_DENIED.length
            ? "--client-cert <pem> --client-key <pem> ile yeniden deneyin"
            : allowedOk.length < PROBE_ALLOWED.length
              ? "eth_blockNumber / net_version da reddedildi: vekilin yukarı akışı (Besu 127.0.0.1) çalışıyor mu"
              : undefined,
      });
    } else if (!rows.some((r) => r.id === "N8"))
      rows.push({
        id: "N8",
        check: "Dış uçta yalnız eth/net/web3",
        result: "skip",
        detail: "dış uç verilmedi",
        fix: "dışarıdan erişilen vekil varsa: --public-rpc <adres> (gerekiyorsa --client-cert/--client-key)",
      });
  }

  rows.push(...configRows(input));

  // N10 — saat
  if (!syncedNow)
    rows.push({
      id: "N10",
      check: "Saat",
      result: "skip",
      detail: "düğüm senkron değil / doğrulanamadı — son blok zamanı eski olabilir",
    });
  else {
    const lb = await call("eth_getBlockByNumber", ["latest", false]);
    const ts =
      lb.kind === "result" && lb.value && typeof lb.value === "object"
        ? hexNum((lb.value as { timestamp?: unknown }).timestamp)
        : NaN;
    const skew = Number.isFinite(ts) ? Math.round(now.getTime() / 1000 - ts) : NaN;
    rows.push({
      id: "N10",
      check: "Saat",
      result: !Number.isFinite(skew) ? "warn" : Math.abs(skew) <= 5 ? "pass" : Math.abs(skew) <= 30 ? "warn" : "fail",
      detail: Number.isFinite(skew)
        ? `son blok zamanı ile bu makinenin saati arasında ${skew} sn`
        : "son blok okunamadı",
      fix:
        Number.isFinite(skew) && Math.abs(skew) > 5
          ? "NTP: Linux timedatectl / chrony; Windows w32tm /resync — QBFT tur zaman aşımları saat kaymasına duyarlıdır"
          : undefined,
    });
  }
  return rows;
}

/** N9 — besu.toml: arayüzler, ad alanları, izinlendirme bayrakları. */
function configRows(input: NodeCheckInput): Row[] {
  const c = input.config;
  if (!c)
    return [
      {
        id: "N9",
        check: "Yapılandırma: arayüzler ve izinlendirme",
        result: "skip",
        detail: "besu.toml verilmedi",
        fix: "--config <besu.toml> (ya da node init klasörü)",
      },
    ];
  const p: string[] = [];
  const w: string[] = [];
  const loop = (v: unknown) => typeof v === "string" && isLoopback(v);
  if (c["rpc-http-enabled"] === true && !loop(c["rpc-http-host"] ?? "127.0.0.1"))
    p.push(`rpc-http-host "${clean(c["rpc-http-host"])}" — yalnız 127.0.0.1 (LP5)`);
  for (const [en, h] of [
    ["rpc-ws-enabled", "rpc-ws-host"],
    ["graphql-http-enabled", "graphql-http-host"],
  ] as const)
    if (c[en] === true && !loop(c[h] ?? "127.0.0.1")) p.push(`${h} yalnız 127.0.0.1`);
  const itf = c["p2p-interface"];
  if (itf === undefined)
    p.push("p2p-interface yok — Besu varsayılanı 0.0.0.0 (bütün arayüzler); yalnız iç arayüzün adresi");
  else if (typeof itf !== "string" || UNSPECIFIED(itf))
    p.push(`p2p-interface "${clean(itf)}" — 0.0.0.0 / :: değil, yalnız iç arayüz`);
  if (c["permissions-nodes-config-file-enabled"] !== true)
    p.push("permissions-nodes-config-file-enabled=true olmalı (LP1)");
  if (c["permissions-accounts-config-file-enabled"] !== true)
    p.push("permissions-accounts-config-file-enabled=true olmalı (LP1)");
  const ha = c["host-allowlist"];
  if (Array.isArray(ha) && ha.includes("*")) p.push('host-allowlist "*" — yalnız localhost, 127.0.0.1');
  if (c["discovery-enabled"] !== false) w.push("discovery-enabled=false önerilir (statik eşler)");
  const api = Array.isArray(c["rpc-http-api"]) ? (c["rpc-http-api"] as string[]).map((x) => x.toUpperCase()) : [];
  if (api.some((x) => ["DEBUG", "TXPOOL", "TRACE", "MINER", "PLUGINS"].includes(x)))
    w.push(
      `rpc-http-api fazla ad alanı açıyor (${api.join(",")}) — yerelde gerekenler ETH, NET, WEB3, QBFT, PERM, ADMIN`,
    );
  if (input.profile) {
    if (typeof c["p2p-port"] === "number" && c["p2p-port"] !== input.profile.p2p_port)
      w.push(`p2p-port ${c["p2p-port"]}, node.json'da ${input.profile.p2p_port}`);
    if (typeof c["p2p-host"] === "string" && c["p2p-host"] !== input.profile.ip)
      w.push(`p2p-host ${clean(c["p2p-host"])}, bildirilen ip ${input.profile.ip}`);
  }
  return [
    {
      id: "N9",
      check: "Yapılandırma: arayüzler ve izinlendirme",
      result: p.length ? "fail" : w.length ? "warn" : "pass",
      detail:
        p.length || w.length ? [...p, ...w].join("; ") : "RPC 127.0.0.1, P2P yalnız iç arayüz, iki izin bayrağı açık",
      fix: p.length
        ? "tamga-onboard node init şablonuyla karşılaştırın (ARCH-0002 §6); değişiklikten sonra düğümü yeniden başlatın"
        : undefined,
    },
  ];
}

/** Düğüm adresi: CLI'da düğümün kendi makinesi varsayılır (besu.toml'daki RPC portu, yoksa 8545). */
export const defaultNodeRpc = (config?: TomlTable) =>
  `http://127.0.0.1:${typeof config?.["rpc-http-port"] === "number" ? config["rpc-http-port"] : 8545}`;
