/**
 * `tamga-onboard keys` — kurumun anahtarlarını KENDİ bilgisayarında üretir ve operatöre gidecek sertifika isteklerini (CSR) yazar
 * (PM-GOV G1: kurum anahtarı kurumda kalır; operatöre yalnız CSR gider). openssl gerekmez (WebCrypto + @peculiar/x509).
 *
 *   belge veren   issuer-<slug>         belge imzası (ES256, P-256)
 *                 issuer-<slug>-status  iptal listesi imzası
 *   doğrulayıcı   rp-<ad>               erişim sertifikası (SAN: kayıttaki dns_name + destek adresi, ADR-0058 AC1)
 * Konu alanı: CN, O (resmî ad), C (ülke), organizationIdentifier 2.5.4.97 (VATTR-<VKN> / NTRTR-<MERSİS>; ADR-0050, ADR-0026 K3).
 * Özel anahtar PKCS#8 PEM, isteğe bağlı parolayla şifreli; dosya izni yalnız sahibine (POSIX 0600; Windows'ta icacls ile miras
 * kaldırılır). Var olan dosyanın üzerine yazılmaz. Üretimde önerilen: anahtar HSM'de / uzaktan imza hizmetinde üretilir — o zaman
 * bu komut yerine `keys --inspect <csr>` dışarıda üretilen CSR'ı denetler.
 */
import { createHash, createPrivateKey, createPublicKey, webcrypto } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import * as x509 from "@peculiar/x509";
import { within } from "./paths.js";
import { CERT_NAME_RE, organizationIdentifier } from "./rules.js";

x509.cryptoProvider.set(webcrypto as unknown as Crypto);
const subtle = webcrypto.subtle as unknown as SubtleCrypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const OID_ORG_ID = "2.5.4.97";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

export type KeyPurpose = "credential" | "status" | "access";

/** Bir anahtarın CSR'ında olması gerekenler (başvurudan türetilir; `inspectCsr` aynı beklentiyle denetler). */
export interface CsrExpectation {
  name: string;
  purpose: KeyPurpose;
  cn: string;
  o: string;
  c: string;
  orgId: string;
  /** Erişim sertifikası: kayıttaki dns_name */
  dns?: string;
  /** Erişim sertifikası: kayıttaki destek adresi (contact.support_uri) */
  contactUri?: string;
}

/** Başvuru dosyalarından her anahtarın CSR beklentisi. */
export function csrExpectations(
  keys: Array<{ name: string; purpose: KeyPurpose }>,
  apps: { issuer?: Rec; rp?: Rec },
): CsrExpectation[] {
  return keys.map((k) => {
    const app = k.purpose === "access" ? apps.rp : apps.issuer;
    if (!app) throw new Error(`${k.name}: ${k.purpose === "access" ? "doğrulayıcı" : "belge veren"} başvurusu yok`);
    const orgId = ((app.identifiers ?? []) as Rec[]).map((i) => organizationIdentifier(i)).find(Boolean);
    if (!orgId) throw new Error(`${k.name}: başvuruda geçerli TR-VKN / TR-MERSIS yok (ADR-0050)`);
    const c = String(app.postal_address?.country ?? "");
    return {
      name: k.name,
      purpose: k.purpose,
      cn: k.purpose === "access" ? String(app.dns_name) : String(app.legal_name),
      o: String(app.legal_name),
      c,
      orgId,
      ...(k.purpose === "access" ? { dns: String(app.dns_name), contactUri: app.contact?.support_uri } : {}),
    };
  });
}

const sha256Hex = (b: ArrayBuffer | Uint8Array) =>
  createHash("sha256")
    .update(b instanceof Uint8Array ? b : new Uint8Array(b))
    .digest("hex");
const toPem = (label: string, der: ArrayBuffer) =>
  `-----BEGIN ${label}-----\n${Buffer.from(der)
    .toString("base64")
    .match(/.{1,64}/g)!
    .join("\n")}\n-----END ${label}-----\n`;

export interface GeneratedKey {
  name: string;
  /** PKCS#8 PEM (parola verildiyse şifreli) — yalnız yerel dosyaya yazılır, hiçbir yere gönderilmez */
  privateKeyPem: string;
  csrPem: string;
  /** Açık anahtarın (SPKI DER) SHA-256 özeti — operatör sertifikayı verirken aynı anahtar mı diye karşılaştırır */
  spkiSha256: string;
  subject: string;
}

/** P-256 anahtar + CSR. Parola verilirse özel anahtar PKCS#8 (AES-256-CBC, PBES2) ile şifrelenir. */
export async function generateKeyAndCsr(e: CsrExpectation, o: { passphrase?: string } = {}): Promise<GeneratedKey> {
  const keys = (await subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const name = [{ CN: [e.cn] }, { O: [e.o] }, { C: [e.c] }, { [OID_ORG_ID]: [e.orgId] }] as unknown as x509.JsonName;
  const san = [
    ...(e.dns ? [{ type: "dns" as const, value: e.dns }] : []),
    ...(e.contactUri ? [{ type: "url" as const, value: e.contactUri }] : []),
  ];
  const csr = await x509.Pkcs10CertificateRequestGenerator.create({
    name,
    keys,
    signingAlgorithm: ALG,
    extensions: san.length ? [new x509.SubjectAlternativeNameExtension(san)] : [],
  });
  const pkcs8 = await subtle.exportKey("pkcs8", keys.privateKey);
  let privateKeyPem = toPem("PRIVATE KEY", pkcs8);
  if (o.passphrase)
    privateKeyPem = createPrivateKey(privateKeyPem).export({
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase: o.passphrase,
    }) as string;
  return {
    name: e.name,
    privateKeyPem,
    csrPem: csr.toString("pem") + "\n",
    spkiSha256: sha256Hex(await subtle.exportKey("spki", keys.publicKey)),
    subject: csr.subject,
  };
}

/** CSR'ın açık anahtar özeti (SPKI SHA-256). */
export async function csrSpkiSha256(csrPem: string): Promise<string> {
  const csr = new x509.Pkcs10CertificateRequest(csrPem);
  return sha256Hex(csr.publicKey.rawData);
}

/** Özel anahtarın açık anahtar özeti (SPKI SHA-256); şifreliyse parola gerekir. */
export function privateKeySpkiSha256(pem: string, passphrase?: string): string {
  const k = createPrivateKey(passphrase ? { key: pem, passphrase } : pem);
  return sha256Hex(createPublicKey(k).export({ type: "spki", format: "der" }));
}

/**
 * Dışarıda (HSM, uzaktan imza hizmeti, openssl) ya da bu araçla üretilmiş bir CSR'ı denetler: imza geçerli, P-256, konu alanında
 * O, C ve organizationIdentifier başvuruyla aynı; erişim sertifikasında SAN'da dns_name ve destek adresi.
 */
export async function inspectCsr(
  csrPem: string,
  e: Partial<CsrExpectation>,
): Promise<{ problems: string[]; subject: string }> {
  const p: string[] = [];
  let csr: x509.Pkcs10CertificateRequest;
  try {
    csr = new x509.Pkcs10CertificateRequest(csrPem);
  } catch {
    return { problems: ["CSR okunamadı (PEM PKCS#10 bekleniyor)"], subject: "" };
  }
  if (!(await csr.verify())) p.push("CSR imzası geçersiz");
  const alg = csr.publicKey.algorithm as EcKeyAlgorithm;
  if (alg.name !== "ECDSA" || alg.namedCurve !== "P-256") p.push("yalnız P-256 (ES256) anahtar kabul edilir");
  const name = csr.subjectName;
  const field = (t: string) => name.getField(t);
  if (e.o !== undefined && !field("O").includes(e.o)) p.push(`konu alanında O (resmî ad) "${e.o}" olmalı`);
  if (e.c !== undefined && !field("C").includes(e.c)) p.push(`konu alanında C (ülke) "${e.c}" olmalı`);
  if (e.orgId !== undefined && !field(OID_ORG_ID).includes(e.orgId))
    p.push(`konu alanında organizationIdentifier (2.5.4.97) "${e.orgId}" olmalı (ADR-0050)`);
  if (e.purpose === "access") {
    const raw = csr.extensions.find((x) => x.type === "2.5.29.17");
    const names = raw ? new x509.SubjectAlternativeNameExtension(raw.rawData).names.toJSON() : [];
    if (e.dns && !names.some((n) => n.type === "dns" && n.value === e.dns))
      p.push(`SAN'da kayıttaki alan adı (${e.dns}) yok (ADR-0034 CI3)`);
    if (e.contactUri && !names.some((n) => n.type === "url" && n.value === e.contactUri))
      p.push(`SAN'da destek adresi (${e.contactUri}) yok (ADR-0058 AC1) — operatör sertifikaya yine yazar, uyarı`);
  }
  return { problems: p, subject: csr.subject };
}

/**
 * Bulut eşitleme klasörü mü (OneDrive, Dropbox, Google Drive, iCloud, macOS CloudStorage): özel anahtar oraya yazılmaz (O6) —
 * dosya kurumun dışındaki bir sunucuya kopyalanır. Eşleşen kök (ya da klasör adı) döner; değilse null.
 */
export function syncedFolder(path: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const abs = resolve(path);
  const norm = (p: string) => (process.platform === "win32" ? p.toLowerCase() : p);
  for (const v of ["OneDrive", "OneDriveCommercial", "OneDriveConsumer"]) {
    const root = env[v];
    if (!root) continue;
    const r = norm(resolve(root));
    const a = norm(abs);
    if (a === r || a.startsWith(r.endsWith(sep) ? r : r + sep)) return root;
  }
  const seg = abs
    .split(/[/\\]+/)
    .find((s) =>
      /^(OneDrive( - .+)?|Dropbox|Google Drive|GoogleDrive|My Drive|iCloudDrive|iCloud Drive|CloudStorage|Mobile Documents|Box|Box Sync|pCloud Drive|MEGA)$/i.test(
        s,
      ),
    );
  return seg ?? null;
}

/**
 * `icacls`'in TAM yolu (`%SystemRoot%\\System32\\icacls.exe`). Adıyla çağırmak aramayı PATH'e ve çalışma klasörüne bırakır: katılım
 * klasörüne ya da PATH'teki yazılabilir bir klasöre konmuş sahte `icacls.exe` özel anahtar yazılırken çalışırdı (kontrol 2026-11-10).
 */
export function icaclsPath(env: NodeJS.ProcessEnv = process.env): string {
  const root = env.SystemRoot ?? env.SYSTEMROOT ?? env.windir ?? "C:\\Windows";
  return join(root, "System32", "icacls.exe");
}

/** Hedef, bu aracın daha önce yazdığı bir rapor mu: sıradan dosya (sembolik bağ değil), `tool` + `rows` taşıyan JSON. */
function isOwnReport(path: string): boolean {
  try {
    const st = lstatSync(path);
    if (!st.isFile() || st.size > 16 * 1024 * 1024) return false;
    const j = JSON.parse(readFileSync(path, "utf8")) as { tool?: unknown; rows?: unknown } | null;
    return typeof j?.tool === "string" && j.tool.startsWith("@tamga-network/onboard@") && Array.isArray(j.rows);
  } catch {
    return false;
  }
}

/**
 * Rapor dosyası (`--report`) yazımı: hedef anahtar / sertifika gibi görünen bir dosya olamaz ve uzantı `.json` olmalıdır; var olan
 * BAŞKA bir dosyanın üzerine YAZILMAZ (yanlış yazılmış bir yol özel anahtarı, CSR'ı ya da başka bir JSON dosyasını rapor JSON'uyla
 * ezmesin — kontrol 2026-11-10). Tek istisna: hedef bu aracın önceki raporuysa yenilenir — aynı komutun ikinci çalıştırılması
 * hata vermesin (kod incelemesi 2026-11-11). Yenileme yanına yazıp ad değiştirerek yapılır: sembolik bağ izlenmez (bağ hedefi
 * rapor sayılmaz; ad değiştirme de bağın gösterdiği dosyaya değil, adın kendisine yazar) ve yarım rapor kalmaz.
 */
export function writeReport(path: string, report: unknown): void {
  const name = basename(path).toLowerCase();
  if (
    !name.endsWith(".json") ||
    /\.(pem|key|csr|crt|cer|der|p12|pfx|jks)\.json$/.test(name) ||
    /(^|[.-])key([.-]|$)/.test(name)
  )
    throw new Error(`rapor dosyası .json uzantılı olmalı ve anahtar / sertifika adı taşımamalı: ${basename(path)}`);
  const body = JSON.stringify(report, null, 2) + "\n";
  try {
    writeFileSync(path, body, { flag: "wx" });
    return;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  if (!isOwnReport(path))
    throw new Error(
      `rapor yazılmadı: ${path} zaten var ve bu aracın önceki raporu değil, üzerine yazılmaz — başka bir ad verin ya da eskisini kendiniz silin`,
    );
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, body, { flag: "wx" });
  try {
    renameSync(tmp, path);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

/**
 * Özel anahtar dosyasını yalnız sahibine okunur yazar; var olan dosyanın üzerine yazmaz. Windows'ta (O6) önce BOŞ dosya açılır,
 * izin icacls ile daraltılır (miras kaldırılır, yalnız geçerli kullanıcı), ancak ondan sonra içerik yazılır; icacls başarısızsa
 * dosya silinir ve hata verilir (anahtar hiçbir an geniş izinli dosyada durmaz).
 */
export function writePrivateKey(path: string, pem: string, o: { platform?: NodeJS.Platform } = {}): void {
  if ((o.platform ?? process.platform) !== "win32") {
    writeFileSync(path, pem, { mode: 0o600, flag: "wx" });
    return;
  }
  writeFileSync(path, "", { flag: "wx" });
  try {
    const user = process.env.USERNAME
      ? `${process.env.USERDOMAIN ? process.env.USERDOMAIN + "\\" : ""}${process.env.USERNAME}`
      : "";
    if (!user) throw new Error("USERNAME yok");
    execFileSync(icaclsPath(), [path, "/inheritance:r", "/grant:r", `${user}:F`], { stdio: "ignore" });
  } catch (e) {
    rmSync(path, { force: true });
    throw new Error(
      `Windows dosya izni daraltılamadı (icacls: ${(e as Error).message}) — anahtar yazılmadı; klasörü ve hesabı denetleyin`,
    );
  }
  writeFileSync(path, pem, { flag: "r+" });
}

/** Dosya izni yalnız sahibine mi (POSIX). Windows'ta bilinemez → `null`. */
export function privateKeyPermissionOk(path: string): boolean | null {
  if (process.platform === "win32") {
    // Windows: icacls çıktısında yalnız geçerli kullanıcı varsa (keys komutunun bıraktığı hâl) tamam; başka durumda bilinemez
    // (grup adları dile göre değişir — "Users"/"Kullanıcılar")
    try {
      const user = process.env.USERNAME?.toLowerCase();
      const out = execFileSync(icaclsPath(), [path], { encoding: "utf8" });
      const principals = out
        .split(/\r?\n/)
        .map((l) => l.replace(path, "").trim())
        .filter((l) => l.includes(":("))
        .map((l) => l.slice(0, l.indexOf(":(")).toLowerCase());
      const mine = (x: string) => x === user || x.endsWith(`\\${user}`);
      return user && principals.length && principals.every(mine) ? true : null;
    } catch {
      return null;
    }
  }
  return (statSync(path).mode & 0o077) === 0;
}

export interface KeysResult {
  dir: string;
  written: Array<{ name: string; key: string; csr: string; spki_sha256: string; subject: string }>;
  warnings: string[];
}

/**
 * Bir katılım klasörü için (init çıktısı) bütün anahtarları üretir: `<dir>/keys/<ad>.key.pem` + `<ad>.csr.pem` + `.gitignore`.
 * Herhangi bir dosya zaten varsa hiçbirini yazmaz (yarım üretim olmasın).
 */
export const MIN_PASSPHRASE = 12;

export interface GenerateKeysOptions {
  passphrase?: string;
  /** Parolasız üretim (Windows'ta açıkça istenmeli: `--no-passphrase`) */
  noPassphrase?: boolean;
  /** Bulut eşitleme klasörüne yazmaya açık onay (`--allow-synced`) */
  allowSynced?: boolean;
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
}

/**
 * Bir katılım klasörü için (init çıktısı) bütün anahtarları üretir: `<dir>/keys/<ad>.key.pem` + `<ad>.csr.pem` + `.gitignore`.
 * Herhangi bir dosya zaten varsa hiçbirini yazmaz (yarım üretim olmasın). O6: bulut eşitleme klasöründe (OneDrive vb.) yalnız
 * `allowSynced` ile; Windows'ta parolasız üretim yalnız `noPassphrase` ile; parola en az 12 karakter (D3).
 */
export async function generateKeys(
  dir: string,
  profile: { keys: Array<{ name: string; purpose: KeyPurpose }> },
  apps: { issuer?: Rec; rp?: Rec },
  o: GenerateKeysOptions = {},
): Promise<KeysResult> {
  const platform = o.platform ?? process.platform;
  if (o.passphrase !== undefined && o.passphrase.length < MIN_PASSPHRASE)
    throw new Error(`parola en az ${MIN_PASSPHRASE} karakter olmalı`);
  if (!o.passphrase && platform === "win32" && !o.noPassphrase)
    throw new Error(
      "Windows'ta özel anahtar parolasız üretilmez: --passphrase-env <DEĞİŞKEN> verin (ya da bilerek --no-passphrase)",
    );
  const kdir = within(dir, "keys");
  const synced = syncedFolder(kdir, o.env);
  if (synced && !o.allowSynced)
    throw new Error(
      `anahtar klasörü bulut eşitleme klasöründe (${synced}): özel anahtar kurum dışındaki bir sunucuya kopyalanır — katılım klasörünü eşitlenmeyen bir yere taşıyın (ya da bilerek --allow-synced)`,
    );
  const exp = csrExpectations(profile.keys, apps);
  for (const e of exp) if (!CERT_NAME_RE.test(e.name)) throw new Error(`anahtar adı geçersiz: ${e.name}`);
  const clash = exp.flatMap((e) =>
    [`${e.name}.key.pem`, `${e.name}.csr.pem`].filter((f) => existsSync(within(dir, "keys", f))),
  );
  if (clash.length)
    throw new Error(
      `zaten var (üzerine yazılmaz; yeni anahtar gerekiyorsa eski dosyaları kendiniz taşıyın): ${clash.join(", ")}`,
    );
  mkdirSync(kdir, { recursive: true });
  within(dir, "keys"); // oluşturulduktan sonra da (bağ yarışı) klasörün içinde mi
  const gi = within(dir, "keys", ".gitignore");
  if (!existsSync(gi)) writeFileSync(gi, "# özel anahtarlar depoya girmez\n*.key.pem\n");
  const warnings: string[] = [];
  const written: KeysResult["written"] = [];
  for (const e of exp) {
    const g = await generateKeyAndCsr(e, o);
    const keyPath = within(dir, "keys", `${e.name}.key.pem`);
    writePrivateKey(keyPath, g.privateKeyPem, { platform });
    const csrPath = within(dir, "keys", `${e.name}.csr.pem`);
    writeFileSync(csrPath, g.csrPem, { flag: "wx" });
    written.push({ name: e.name, key: keyPath, csr: csrPath, spki_sha256: g.spkiSha256, subject: g.subject });
  }
  if (!o.passphrase)
    warnings.push(
      "özel anahtarlar parolasız: gerçek ağda anahtarı HSM / uzaktan imza hizmetinde üretmek önerilir; dosyayı yedekleyin ve kimseyle paylaşmayın",
    );
  if (synced)
    warnings.push(
      `anahtarlar bulut eşitleme klasöründe (${synced}) — açık onayla yazıldı; eşitlemeyi bu klasör için kapatın`,
    );
  return { dir: kdir, written, warnings };
}

/** Yerel bir CSR dosyasını okur (yardımcı). */
export const readPem = (path: string) => readFileSync(path, "utf8");
