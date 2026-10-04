/**
 * S-12 (DER ile SAN / SPKI) ve S-13 (imzalı güven listesi) — gerçek dev PKI ve trust-publisher dist'i ile.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { X509Certificate, createHash } from "node:crypto";
import { certSanDnsNames, certP256Point } from "./asn1.js";
import { certHasDnsName, fetchRpRecord } from "./oid4vp.js";
import { fetchVerifiedTrust, resetTrustSeen, type TrustPins } from "./trustlist.js";
import { fetchIssuerDirectory } from "./directory.js";
import type { Http } from "./http.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test"); // test listesi (test/fixtures/registry; npm run setup)
const ready = existsSync(resolve(DIST, "lotl.jws")) && existsSync(resolve(PKI, "rp-verify.cert.pem"));
const BASE = "https://trust.test";
// ADR-0034: doğrulayıcının listedeki client_id'si x509_hash (erişim sertifikasından)
const VERIFY_CID = () =>
  `x509_hash:${Buffer.from(createHash("sha256").update(derOf("rp-verify")).digest()).toString("base64url")}`;

const derOf = (name: string) => {
  const pem = readFileSync(resolve(PKI, `${name}.cert.pem`), "utf8");
  return new Uint8Array(Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64"));
};
const pins = (): TrustPins => ({
  lotlSigners: (
    JSON.parse(readFileSync(resolve(DIST, "keys/root-fingerprints.json"), "utf8")) as {
      lotl_signing_keys: Array<{ fingerprint_sha256: string }>;
    }
  ).lotl_signing_keys.map((k) => k.fingerprint_sha256),
});
/** dist'i sunan sahte HTTP; `override` ile belirli bir dosyanın içeriği değiştirilebilir. */
const httpFor =
  (override: Record<string, string> = {}): Http =>
  async (url) => {
    const f = url.slice(BASE.length + 1);
    if (f in override) return { status: 200, text: async () => override[f] };
    const p = resolve(DIST, f);
    if (!existsSync(p)) return { status: 404, text: async () => "" };
    return { status: 200, text: async () => readFileSync(p, "utf8") };
  };

describe.skipIf(!ready)("S-12: DER ile X.509 ayrıştırma", () => {
  it("SAN dNSName yalnızca SubjectAltName uzantısından okunur; SAN'sız sertifikada boş", () => {
    expect(certSanDnsNames(derOf("rp-verify"))).toEqual(["verify.tamga.network"]);
    expect(certSanDnsNames(derOf("issuer-bilgi"))).toEqual([]);
    expect(certHasDnsName(derOf("rp-verify"), "VERIFY.tamga.network")).toBe(true); // DNS büyük/küçük harf duyarsız
    expect(certHasDnsName(derOf("rp-verify"), "evil.example")).toBe(false);
    expect(certHasDnsName(new Uint8Array([0x30, 0x03, 0x02, 0x01]), "x")).toBe(false); // bozuk DER → eşleşme yok
  });

  it("P-256 SPKI noktası Node'un kendi ayrıştırdığı anahtarla aynı", () => {
    for (const name of ["rp-verify", "issuer-bilgi", "issuer-id"]) {
      const der = derOf(name);
      const jwk = new X509Certificate(der).publicKey.export({ format: "jwk" }) as { x: string; y: string };
      const expected = Uint8Array.from([0x04, ...Buffer.from(jwk.x, "base64url"), ...Buffer.from(jwk.y, "base64url")]);
      expect(certP256Point(der)).toEqual(expected);
    }
  });
});

describe.skipIf(!ready)("S-13: imzalı güven listesi (cüzdan)", () => {
  beforeEach(() => resetTrustSeen());

  it("sabitlenmiş LOTL imzacısıyla doğrulanır; RP kaydı ve kurum dizini imzalı listeden gelir", async () => {
    const v = await fetchVerifiedTrust(BASE, httpFor(), { pins: pins() });
    expect(v.tl.state_code).toBe("TR");
    const rp = await fetchRpRecord(BASE, VERIFY_CID(), httpFor(), pins());
    expect(rp?.legal_name).toContain("Verification");
    expect(rp?.dns_name).toBe("verify.tamga.network");
    const dir = await fetchIssuerDirectory(BASE, httpFor(), pins());
    expect(dir.map((d) => d.slug)).toContain("bilgi");
  });

  it("yanlış pin → reddedilir; RP kaydı null (onay ekranı 'bulunamadı' uyarısı verir)", async () => {
    const bad = { lotlSigners: ["00".repeat(32)] };
    await expect(fetchVerifiedTrust(BASE, httpFor(), { pins: bad })).rejects.toThrow(/pinned/);
    expect(await fetchRpRecord(BASE, VERIFY_CID(), httpFor(), bad)).toBeNull();
    await expect(fetchVerifiedTrust(BASE, httpFor(), { pins: { lotlSigners: [] } })).rejects.toThrow(/pin/);
  });

  it("kurcalanmış ulusal liste (sahte RP eklenmiş) → imza geçersiz", async () => {
    const jws = readFileSync(resolve(DIST, "tl-tr.jws"), "utf8").trim();
    const [h, p, sgn] = jws.split(".");
    const payload = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    payload.relying_parties.push({
      client_id: `x509_hash:${"E".repeat(43)}`,
      dns_name: "evil.example",
      legal_name: "Sahte",
      status: "ACTIVE",
      scopes: [],
    });
    const forged = [h, Buffer.from(JSON.stringify(payload)).toString("base64url"), sgn].join(".");
    await expect(fetchVerifiedTrust(BASE, httpFor({ "tl-tr.jws": forged }), { pins: pins() })).rejects.toThrow(
      /signature/,
    );
    expect(
      await fetchRpRecord(BASE, `x509_hash:${"E".repeat(43)}`, httpFor({ "tl-tr.jws": forged }), pins()),
    ).toBeNull();
  });

  it("bayat liste (next_update geçmiş) → reddedilir", async () => {
    await expect(
      fetchVerifiedTrust(BASE, httpFor(), { pins: pins(), now: Date.now() + 400 * 86400_000 }),
    ).rejects.toThrow(/stale/);
  });

  it("geri sarma: güncel sürüm görüldükten sonra arşivdeki eski (imzası geçerli) sürüm reddedilir", async () => {
    await fetchVerifiedTrust(BASE, httpFor(), { pins: pins() });
    // en az iki liste sürümü gerekir (CI listeyi iki kez derler: geri sarma denetimi için eski ama imzası geçerli sürüm)
    const olds = readdirSync(resolve(DIST, "archive"))
      .filter((f) => /^tl-tr\.v\d+\.jws$/.test(f))
      .sort();
    const current = JSON.parse(readFileSync(resolve(DIST, "tl-tr.json"), "utf8")).version as number;
    const ver = (f: string) => Number(f.match(/v(\d+)/)![1]);
    const older = olds.filter((f) => ver(f) < current).sort((a, b) => ver(b) - ver(a))[0];
    expect(older).toBeTruthy();
    const oldJws = readFileSync(resolve(DIST, "archive", older!), "utf8");
    await expect(fetchVerifiedTrust(BASE, httpFor({ "tl-tr.jws": oldJws }), { pins: pins() })).rejects.toThrow(
      /rollback|stale|older than/,
    );
  });
});
