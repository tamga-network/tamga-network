/**
 * Cüzdan sağlayıcı iptal listesi denetleyicisi (WIA `client_status`, KA `key_storage_status`): CIR 2026/1731 Ek Ib — 10.000'den az
 * girişli liste `NONCOMPLIANT` (ret); `minEntries: 0` denetimi kapatır. Anahtarlar test içinde üretilir (kişisel veri yok).
 */
import { describe, it, expect } from "vitest";
import { webcrypto } from "node:crypto";
import { deflateSync } from "node:zlib";
import { SignJWT, importPKCS8 } from "jose";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { certFingerprintSha256Hex } from "@tamga-network/core";
import { WALLET_STATUS_MIN_ENTRIES, WalletStatusChecker, verifyKeyAttestation, KA_TYP } from "./key-attestation.js";
import { epochSeconds } from "@tamga-network/core";

cryptoProvider.set(webcrypto as unknown as Crypto);
const now = 1_800_000_000;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const URI = "https://wp.example.test/status/1";

async function provider() {
  const keys = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=Test Wallet Provider",
    notBefore: new Date((now - 86400) * 1000),
    notAfter: new Date((now + 86400) * 1000),
    signingAlgorithm: ALG,
    keys,
  });
  const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", keys.privateKey)).toString("base64");
  const key = await importPKCS8(`-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----`, "ES256");
  const der = new Uint8Array(cert.rawData);
  return { key, der, fp: certFingerprintSha256Hex(der) };
}

/** `entries` girişli (2 bit) liste; `revoked` indeksleri 1 (iptal). Token Status List biçimi (LSB önce). */
async function statusToken(
  p: Awaited<ReturnType<typeof provider>>,
  entries: number,
  revoked: number[] = [],
  bits: 1 | 2 | 4 | 8 = 2,
) {
  const perByte = 8 / bits;
  const raw = new Uint8Array(Math.ceil(entries / perByte));
  for (const i of revoked) raw[Math.floor(i / perByte)] |= 1 << ((i % perByte) * bits);
  const lst = Buffer.from(deflateSync(raw)).toString("base64url");
  return new SignJWT({ sub: URI, status_list: { bits, lst } })
    .setProtectedHeader({ alg: "ES256", typ: "statuslist+jwt", x5c: [Buffer.from(p.der).toString("base64")] })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(p.key);
}

/** Güven kaynağının iki işlevi (ADR-0056 K6a): `keys` kayıttaki anahtarlar (parmak izi → sağlayıcı kimliği). */
function providersOf(...ps: Array<{ fp: string }>) {
  return providersMap(Object.fromEntries(ps.map((x) => [x.fp, "wp-1"])));
}
function providersMap(keys: Record<string, string | null>) {
  return {
    isWalletProviderKey: (fp: string) => (fp in keys ? ("YES" as const) : ("NO" as const)),
    walletProviderOfKey: (fp: string) => keys[fp] ?? null,
  };
}

describe("WalletStatusChecker — en az giriş sayısı (CIR 2026/1731 Ek Ib)", () => {
  it("varsayılan 10.000: küçük liste NONCOMPLIANT, yeterli liste VALID", async () => {
    expect(WALLET_STATUS_MIN_ENTRIES).toBe(10_000);
    const p = await provider();
    const isKey = providersOf(p);
    const small = await statusToken(p, 4_000);
    const big = await statusToken(p, 10_000);
    const smallChecker = new WalletStatusChecker(async () => small, isKey);
    expect(await smallChecker.statusOf({ idx: 1, uri: URI }, epochSeconds(now), p.fp)).toBe("NONCOMPLIANT");
    const bigChecker = new WalletStatusChecker(async () => big, isKey);
    expect(await bigChecker.statusOf({ idx: 1, uri: URI }, epochSeconds(now), p.fp)).toBe("VALID");
  });

  it("0.5.2: bit önce okunur — küçük listede iptal edilmiş giriş INVALID, iptal edilmemiş giriş NONCOMPLIANT", async () => {
    const p = await provider();
    const isKey = providersOf(p);
    const small = await statusToken(p, 4_000, [5]);
    const c = new WalletStatusChecker(async () => small, isKey);
    expect(await c.statusOf({ idx: 5, uri: URI }, epochSeconds(now), p.fp)).toBe("INVALID");
    expect(await c.statusOf({ idx: 6, uri: URI }, epochSeconds(now), p.fp)).toBe("NONCOMPLIANT");
    expect(await c.statusOf({ idx: 999_999, uri: URI }, epochSeconds(now), p.fp)).toBe("NONCOMPLIANT"); // listenin dışı, küçük liste
    const big = await statusToken(p, 10_000, [5]);
    const b = new WalletStatusChecker(async () => big, isKey);
    expect(await b.statusOf({ idx: 5, uri: URI }, epochSeconds(now), p.fp)).toBe("INVALID");
    expect(await b.statusOf({ idx: 6, uri: URI }, epochSeconds(now), p.fp)).toBe("VALID");
    expect(await b.statusOf({ idx: 999_999, uri: URI }, epochSeconds(now), p.fp)).toBe("UNKNOWN"); // listenin dışı
  });

  it("0.8.3: giriş sayısı bit sayısına göre (bayt × 8 / bit) — 1 bitlik yeterli liste VALID, 4 / 8 bitlik küçük liste NONCOMPLIANT", async () => {
    const p = await provider();
    const isKey = providersOf(p);
    const at = epochSeconds(now);
    const check = async (entries: number, bits: 1 | 2 | 4 | 8) =>
      new WalletStatusChecker(async () => statusToken(p, entries, [], bits), isKey).statusOf(
        { idx: 1, uri: URI },
        at,
        p.fp,
      );
    // 1 bit: 10.000 giriş = 1.250 bayt (eski "bayt × 4" bunu 5.000 sayıp reddediyordu)
    expect(await check(10_000, 1)).toBe("VALID");
    expect(await check(9_992, 1)).toBe("NONCOMPLIANT");
    // 4 bit: 5.000 giriş = 2.500 bayt (eski hesap 10.000 sayıp kabul ediyordu); 8 bit: 2.500 giriş = 2.500 bayt
    expect(await check(5_000, 4)).toBe("NONCOMPLIANT");
    expect(await check(10_000, 4)).toBe("VALID");
    expect(await check(2_500, 8)).toBe("NONCOMPLIANT");
    expect(await check(10_000, 8)).toBe("VALID");
  });

  it("minEntries: 0 denetimi kapatır (geliştirme/test)", async () => {
    const p = await provider();
    const isKey = providersOf(p);
    const small = await statusToken(p, 400);
    const c = new WalletStatusChecker(async () => small, isKey, 300, { minEntries: 0 });
    expect(await c.statusOf({ idx: 1, uri: URI }, epochSeconds(now), p.fp)).toBe("VALID");
  });

  it("KA'nın listesi küçükse KA reddedilir (geçici hata değil)", async () => {
    const p = await provider();
    const isProviderKey = (fp: string) => (fp === p.fp ? ("YES" as const) : ("NO" as const));
    const small = await statusToken(p, 4_000);
    const checker = new WalletStatusChecker(async () => small, providersOf(p));
    const holder = await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
    const jwk = await webcrypto.subtle.exportKey("jwk", (holder as CryptoKeyPair).publicKey);
    const ka = await new SignJWT({
      attested_keys: [{ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }],
      key_storage: ["iso_18045_moderate"],
      user_authentication: ["iso_18045_moderate"],
      key_storage_status: { status: { status_list: { idx: 7, uri: URI } } },
    })
      .setProtectedHeader({ alg: "ES256", typ: KA_TYP, x5c: [Buffer.from(p.der).toString("base64")] })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(p.key);
    const r = await verifyKeyAttestation(ka, { now: epochSeconds(now), isProviderKey, statusOf: checker.statusOf });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/profile/);
      expect(r.indeterminate).toBeFalsy();
    }
  });
});

describe("WalletStatusChecker — liste imzacısı aynı sağlayıcı kaydında (ADR-0056 K6a)", () => {
  it("aynı kayıttaki başka anahtarın imzaladığı liste geçerli (anahtar geçişi)", async () => {
    const [a, b] = [await provider(), await provider()];
    const list = await statusToken(b, 10_000);
    const c = new WalletStatusChecker(async () => list, providersMap({ [a.fp]: "wp-1", [b.fp]: "wp-1" }));
    expect(await c.statusOf({ idx: 1, uri: URI }, epochSeconds(now), a.fp)).toBe("VALID");
  });

  it("başka sağlayıcının anahtarıyla imzalı liste kabul edilmez (UNKNOWN)", async () => {
    const [a, other] = [await provider(), await provider()];
    const list = await statusToken(other, 10_000, [1]);
    const c = new WalletStatusChecker(async () => list, providersMap({ [a.fp]: "wp-1", [other.fp]: "wp-2" }));
    expect(await c.statusOf({ idx: 1, uri: URI }, epochSeconds(now), a.fp)).toBe("UNKNOWN");
    expect(await c.statusOf({ idx: 2, uri: URI }, epochSeconds(now), a.fp)).toBe("UNKNOWN");
  });

  it("kayıt bulunamazsa (dış liste) yalnız aynı anahtar; imzacı verilmezse UNKNOWN", async () => {
    const [a, b] = [await provider(), await provider()];
    const listA = await statusToken(a, 10_000);
    const listB = await statusToken(b, 10_000);
    const ext = providersMap({ [a.fp]: null, [b.fp]: null });
    expect(
      await new WalletStatusChecker(async () => listA, ext).statusOf({ idx: 1, uri: URI }, epochSeconds(now), a.fp),
    ).toBe("VALID");
    expect(
      await new WalletStatusChecker(async () => listB, ext).statusOf({ idx: 1, uri: URI }, epochSeconds(now), a.fp),
    ).toBe("UNKNOWN");
    const call = new WalletStatusChecker(async () => listA, providersOf(a)).statusOf as unknown as (
      ...x: unknown[]
    ) => Promise<string>;
    expect(await call({ idx: 1, uri: URI }, epochSeconds(now))).toBe("UNKNOWN");
  });

  it("KA: listeyi başka sağlayıcı imzaladıysa KA kabul edilmez (belirsiz)", async () => {
    const [p, other] = [await provider(), await provider()];
    const provs = providersMap({ [p.fp]: "wp-1", [other.fp]: "wp-2" });
    const list = await statusToken(other, 10_000);
    const checker = new WalletStatusChecker(async () => list, provs);
    const holder = await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"]);
    const jwk = await webcrypto.subtle.exportKey("jwk", (holder as CryptoKeyPair).publicKey);
    const ka = await new SignJWT({
      attested_keys: [{ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }],
      key_storage: ["iso_18045_moderate"],
      user_authentication: ["iso_18045_moderate"],
      key_storage_status: { status: { status_list: { idx: 7, uri: URI } } },
    })
      .setProtectedHeader({ alg: "ES256", typ: KA_TYP, x5c: [Buffer.from(p.der).toString("base64")] })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(p.key);
    const r = await verifyKeyAttestation(ka, {
      now: epochSeconds(now),
      isProviderKey: provs.isWalletProviderKey,
      statusOf: checker.statusOf,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.indeterminate).toBe(true);
  });
});
