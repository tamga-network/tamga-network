/**
 * Cihaz kanıtı (P4-2; ARF WIAM_04/08, WUA_16a; SPEC-WALLET-0001 WL3). Cüzdan sağlayıcı, birimin anahtar deposu seviyesini
 * cihazın beyanından DEĞİL, platformun imzalı kanıtından belirler:
 *  - Android anahtar kanıtı (key attestation): birim anahtarının sertifika zinciri Google donanım kanıtı köküne; uzantı
 *    1.3.6.1.4.1.11129.2.1.17 (KeyDescription): tek kullanımlık değer, güvenlik seviyesi (TEE / StrongBox), doğrulanmış açılış,
 *    uygulama paket adı. Kanıtlanan anahtar birim anahtarının kendisidir.
 *  - Apple App Attest: attestation nesnesi (CBOR) Apple App Attestation kökünden; nonce = SHA-256(authData ‖ clientDataHash)
 *    sertifika uzantısında (1.2.840.113635.100.8.2); rpIdHash = SHA-256(TeamID.BundleID); sayaç 0; anahtar kimliği.
 *    clientData birim anahtarının parmak izini içerdiğinden birim anahtarı gerçek uygulamanın ürettiği anahtara bağlanır.
 * Kökler: `roots/` (resmî kaynaklardan; testte kendi test kökü). Başarısızlık ayrıntısı kişisel veri içermez.
 * Başarısız kanıt kaydı DÜŞÜRMEZ: birim yazılım seviyesinde (S-9) kaydolur; `code` nedenin sınıfını söyler (app.ts `/units`).
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import { X509Certificate, cryptoProvider } from "@peculiar/x509";
import { AsnConvert, OctetString } from "@peculiar/asn1-schema";
import {
  AttestationApplicationId,
  NonStandardKeyDescription,
  SecurityLevel,
  VerifiedBootState,
  id_ce_keyDescription,
} from "@peculiar/asn1-android";
import { decode as cborDecode } from "@tamga-network/mdoc";
import type { KeyStorage } from "@tamga-network/issuer";

cryptoProvider.set(webcrypto as unknown as Crypto);

export type DeviceEvidence =
  | { platform: "android"; key_attestation: string[] }
  | { platform: "ios"; app_attest: { key_id: string; attestation: string } };

export interface DeviceCheck {
  ok: boolean;
  storage: KeyStorage;
  /** başarısızlık açıklaması (sabit metin; kişisel ya da cihaz verisi yok) */
  reason?: string;
  /**
   * Başarısızlık sınıfı (ADR-0025 K3 / S-9 düşüşü): `invalid` = kanıt doğrulanamadı — sahtecilik şüphesi, yalnız sayaç tutulur;
   * `unsupported` = cihaz durumu ya da ortam desteklenmiyor (kilidi açık cihaz, geliştirme ortamı, donanımsız anahtar) — olağan.
   */
  code?: "invalid" | "unsupported";
  /** bilgi: doğrulanmış açılış, uygulama kimliği vb. (kişisel veri yok) */
  details?: Record<string, unknown>;
}

const here = dirname(fileURLToPath(import.meta.url));
const ROOTS_DIR = resolve(here, "..", "roots");
export function officialRoots(): { android: X509Certificate[]; apple: X509Certificate[] } {
  const g = resolve(ROOTS_DIR, "google-attestation-roots.json");
  const a = resolve(ROOTS_DIR, "apple-app-attestation-root-ca.pem");
  return {
    android: existsSync(g) ? (JSON.parse(readFileSync(g, "utf8")) as string[]).map((p) => new X509Certificate(p)) : [],
    apple: existsSync(a) ? [new X509Certificate(readFileSync(a, "utf8"))] : [],
  };
}

const sha256 = (b: Uint8Array | string) => new Uint8Array(createHash("sha256").update(b).digest());
const eq = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);
const b64d = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
const fail = (reason: string, code: NonNullable<DeviceCheck["code"]> = "invalid"): DeviceCheck => ({
  ok: false,
  storage: "software",
  reason,
  code,
});

/** Zincir: her sertifika bir sonrakiyle imzalı, geçerlilik içinde; son sertifika güvenilir köklerden birine eşit ya da onunla imzalı. */
async function verifyChain(chain: X509Certificate[], roots: X509Certificate[], now: Date): Promise<string | null> {
  if (!chain.length) return "empty chain";
  for (let i = 0; i < chain.length; i++) {
    const c = chain[i];
    if (c.notBefore > now || c.notAfter < now) return `certificate ${i} not valid now`;
    const issuer = chain[i + 1];
    if (issuer && !(await c.verify({ publicKey: issuer.publicKey, signatureOnly: true }))) return `signature ${i}`;
  }
  const last = chain[chain.length - 1];
  const lastRaw = new Uint8Array(last.rawData);
  for (const r of roots) {
    if (eq(new Uint8Array(r.rawData), lastRaw)) return null;
    if (await last.verify({ publicKey: r.publicKey, signatureOnly: true }).catch(() => false)) return null;
  }
  return "chain does not end at a trusted root";
}

/** Sertifikanın P-256 açık anahtarı (ham 65 bayt, 0x04‖X‖Y). */
async function p256Raw(cert: X509Certificate): Promise<Uint8Array> {
  const key = await cert.publicKey.export({ name: "ECDSA", namedCurve: "P-256" }, ["verify"], webcrypto as never);
  return new Uint8Array(await webcrypto.subtle.exportKey("raw", key as CryptoKey));
}

// ------------------------------------------------------------------ Android
export async function verifyAndroidKeyAttestation(
  chainB64: string[],
  p: {
    challenge: Uint8Array;
    packageName: string;
    /** kanıtlanan anahtar birim anahtarı olmalı (ham 65 bayt) */
    expectedKey: Uint8Array;
    roots: X509Certificate[];
    now?: Date;
    /** yalnız geliştirme: kilidi açık / doğrulanmamış açılışa izin (üretimde false) */
    allowUnlocked?: boolean;
  },
): Promise<DeviceCheck> {
  let chain: X509Certificate[];
  try {
    chain = chainB64.map((c) => new X509Certificate(b64d(c)));
  } catch {
    return fail("android: certificate parse");
  }
  const err = await verifyChain(chain, p.roots, p.now ?? new Date());
  if (err) return fail(`android: ${err}`);
  // Kanıt uzantısı zincirin ilk (yaprak) sertifikasındadır
  const ext = chain[0].extensions.find((e) => e.type === id_ce_keyDescription);
  if (!ext) return fail("android: no key attestation extension");
  let kd: NonStandardKeyDescription;
  try {
    kd = AsnConvert.parse(ext.value, NonStandardKeyDescription);
  } catch {
    return fail("android: KeyDescription parse");
  }
  if (
    !eq(
      new Uint8Array(
        kd.attestationChallenge instanceof ArrayBuffer ? kd.attestationChallenge : kd.attestationChallenge.buffer,
      ),
      p.challenge,
    )
  )
    return fail("android: challenge mismatch");
  if (!eq(await p256Raw(chain[0]), p.expectedKey)) return fail("android: attested key is not the unit key");
  const level = kd.attestationSecurityLevel;
  if (level !== SecurityLevel.trustedEnvironment && level !== SecurityLevel.strongBox)
    return fail("android: key not in secure hardware", "unsupported");
  const rot = kd.teeEnforced.findProperty("rootOfTrust");
  const booted = rot?.verifiedBootState === VerifiedBootState.verified && rot?.deviceLocked === true;
  if (!booted && !p.allowUnlocked) return fail("android: device not in verified boot state", "unsupported");
  const appIdOs =
    kd.softwareEnforced.findProperty("attestationApplicationId") ??
    kd.teeEnforced.findProperty("attestationApplicationId");
  if (!appIdOs) return fail("android: no application id");
  let appId: AttestationApplicationId;
  try {
    appId = AsnConvert.parse((appIdOs as OctetString).buffer, AttestationApplicationId);
  } catch {
    return fail("android: application id parse");
  }
  // ayrıştırıcı OCTET STRING alanını OctetString ya da düz ArrayBuffer olarak verebilir
  const bytesOf = (v: unknown) => new Uint8Array(v instanceof ArrayBuffer ? v : (v as OctetString).buffer);
  const names = appId.packageInfos.map((x) => Buffer.from(bytesOf(x.packageName)).toString("utf8"));
  if (!names.includes(p.packageName)) return fail("android: package name mismatch");
  return {
    ok: true,
    storage: level === SecurityLevel.strongBox ? "strongbox" : "tee",
    details: { verified_boot: booted, attestation_version: kd.attestationVersion },
  };
}

// ------------------------------------------------------------------ Apple App Attest
const OID_APPLE_NONCE = "1.2.840.113635.100.8.2";
const AAGUID_PROD = new Uint8Array([...Buffer.from("appattest"), 0, 0, 0, 0, 0, 0, 0]);
const AAGUID_DEV = new Uint8Array(Buffer.from("appattestdevelop"));

/** Apple nonce uzantısı: SEQUENCE { [1] EXPLICIT OCTET STRING nonce } → nonce (32 bayt) */
function appleNonce(extValue: ArrayBuffer): Uint8Array | null {
  const b = new Uint8Array(extValue);
  // 30 L A1 L 04 20 <32 bayt> — küçük ve sabit biçim; yapı doğrulanarak okunur
  if (b[0] !== 0x30 || b[2] !== 0xa1 || b[4] !== 0x04 || b[5] !== 0x20 || b.length < 38) return null;
  return b.subarray(6, 38);
}

export async function verifyAppAttest(p: {
  keyIdB64: string;
  attestationB64: string;
  /** istemci verisi (Tamga: meydan okuma + birim anahtarı parmak izi); SHA-256'sı clientDataHash */
  clientData: Uint8Array;
  /** "TEAMID.network.tamga.wallet" */
  appId: string;
  roots: X509Certificate[];
  now?: Date;
  /** geliştirme ortamı (appattestdevelop) kabul edilsin mi */
  allowDevelopment?: boolean;
}): Promise<DeviceCheck> {
  let obj: Map<unknown, unknown>;
  try {
    obj = cborDecode(b64d(p.attestationB64)) as Map<unknown, unknown>;
  } catch {
    return fail("ios: attestation is not CBOR");
  }
  if (obj.get("fmt") !== "apple-appattest") return fail("ios: fmt");
  const stmt = obj.get("attStmt") as Map<unknown, unknown> | undefined;
  const authData = obj.get("authData") as Uint8Array | undefined;
  const x5c = stmt?.get("x5c") as Uint8Array[] | undefined;
  if (!stmt || !authData || !x5c?.length) return fail("ios: attestation structure");
  let chain: X509Certificate[];
  try {
    chain = x5c.map((d) => new X509Certificate(new Uint8Array(d)));
  } catch {
    return fail("ios: certificate parse");
  }
  const err = await verifyChain(chain, p.roots, p.now ?? new Date());
  if (err) return fail(`ios: ${err}`);
  const nonce = sha256(new Uint8Array([...authData, ...sha256(p.clientData)]));
  const ext = chain[0].extensions.find((e) => e.type === OID_APPLE_NONCE);
  const certNonce = ext ? appleNonce(ext.value) : null;
  if (!certNonce || !eq(certNonce, nonce)) return fail("ios: nonce mismatch");
  const keyId = b64d(p.keyIdB64);
  if (!eq(sha256(await p256Raw(chain[0])), keyId)) return fail("ios: key id mismatch");
  // authData: rpIdHash(32) flags(1) signCount(4) aaguid(16) credIdLen(2) credId(n) …
  if (authData.length < 55) return fail("ios: authData too short");
  if (!eq(authData.subarray(0, 32), sha256(p.appId))) return fail("ios: app id mismatch");
  const counter = new DataView(authData.buffer, authData.byteOffset + 33, 4).getUint32(0);
  if (counter !== 0) return fail("ios: counter not zero");
  const aaguid = authData.subarray(37, 53);
  const dev = eq(aaguid, AAGUID_DEV);
  if (!eq(aaguid, AAGUID_PROD) && !(dev && p.allowDevelopment))
    return fail("ios: environment", dev ? "unsupported" : "invalid");
  const credLen = new DataView(authData.buffer, authData.byteOffset + 53, 2).getUint16(0);
  if (!eq(authData.subarray(55, 55 + credLen), keyId)) return fail("ios: credential id mismatch");
  return { ok: true, storage: "secure_enclave", details: { environment: dev ? "development" : "production" } };
}

/** İstemci verisi biçimi wallet-core ile ortak (tek tanım). */
export { unitClientData } from "@tamga-network/wallet-core";
