/**
 * Taahhüt testleri (ARCH-0005 T1–T8 uyarlaması, tamga-beta 08-BACKLOG D1):
 *  T1 imzalı set yüklenir, sorgular YES
 *  T2 bayat lotl (next_update geçmiş) → UNKNOWN (BT5/CMP4)
 *  T3 bilinmeyen list_format_version → yükleyici DURUR (CMP2)
 *  T4 kurcalanmış payload → imza hatası
 *  T5 kayıtsız imzacı → red
 *  T6 hash zinciri kırık anchors → DUR
 *  T7 iat-zamanlı: SUSPENDED sonrası ihraç NO, öncesi YES (D-BC-3 / GV1)
 *  T8 şema yetkisi penceresi ve allowlist varsayılanı false (I1/I3/D9)
 *  SB2 sandbox listesi gerçek ağ istemcisinde DURUR; sandbox istemcisi kabul eder (ADR-0038)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider, KeyUsageFlags, KeyUsagesExtension } from "@peculiar/x509";
import { CompactSign, importPKCS8 } from "jose";
import {
  loadTrustSet,
  ListTrustSource,
  computeCaId,
  computeIssuerId,
  computeSchemaId,
  sha256Tag,
  utf8,
  TL_TYP,
  certFingerprintSha256Hex,
} from "./index.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;

async function mkCert(cn: string) {
  const keys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: `CN=${cn}`,
    notBefore: new Date(Date.now() - 1000),
    notAfter: new Date(Date.now() + 86400_000 * 365),
    signingAlgorithm: ALG,
    keys,
    extensions: [new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true)],
  });
  const der = new Uint8Array(cert.rawData);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keys.privateKey));
  const pem = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString("base64")}\n-----END PRIVATE KEY-----`;
  const key = await importPKCS8(pem, "ES256");
  const b64 = Buffer.from(der).toString("base64");
  const sign = (obj: unknown, typ = TL_TYP) =>
    new CompactSign(utf8(JSON.stringify(obj))).setProtectedHeader({ alg: "ES256", typ, x5c: [b64] }).sign(key);
  return { der, fp: certFingerprintSha256Hex(der), sign };
}

const T0 = "2026-01-01T00:00:00Z";
const SUSP = "2026-06-01T00:00:00Z";
const sec = (s: string) => Math.floor(new Date(s).getTime() / 1000);
const VCT_D = "urn:tamga:edu:DiplomaCredential:1",
  VCT_S = "urn:tamga:edu:StudentCredential:1";

let ctx: Awaited<ReturnType<typeof makeSet>>;
async function makeSet(
  opts: {
    staleLotl?: boolean;
    badFormat?: boolean;
    tamper?: boolean;
    wrongSigner?: boolean;
    breakChain?: boolean;
    /**
     * TL12: a0 arşivde; günlük [kontrol noktası, a1]. "bad" → yabancı anahtar; "seq" → seq tutarsız; "nostate" → anlık durum yok.
     * Kontrol noktası durumu, arşivde kalan 0xold listesinin çapasını taşır (yükleyici bunu arşivi okumadan bilmeli).
     */
    checkpoint?: "ok" | "bad" | "seq" | "nostate";
    /** ADR-0038: listeler bu ağı taşır (yoksa alan yazılmaz = gerçek ağ). */
    environment?: "sandbox" | "production";
  } = {},
) {
  const tlSigner = await mkCert("TL Signer");
  const root = await mkCert("Root");
  const issuer = await mkCert("Bilgi");
  const other = await mkCert("Other");
  const caId = computeCaId("TR", root.der),
    issuerId = computeIssuerId("TR", issuer.der);
  const now = new Date("2026-09-24T12:00:00Z");
  const next = opts.staleLotl ? "2026-09-01T00:00:00Z" : "2026-12-24T00:00:00Z";
  const tl = {
    ...(opts.environment ? { environment: opts.environment } : {}),
    list_format_version: "1.0",
    list_type: "trusted_list",
    state_code: "TR",
    version: 1,
    issued_at: T0,
    next_update: next,
    previous_version_hash: null,
    operator: { name: "Tamga", status: "provisional" },
    root_cas: [
      {
        ca_id: caId,
        legal_name: "TR Root",
        cert_fingerprint_sha256: root.fp,
        service_type: "NationalRootCA-QC",
        operator: { name: "Tamga", status: "provisional" },
        status: "ACTIVE",
        valid_from: T0,
        valid_until: "2036-01-01T00:00:00Z",
        successor_ca_id: null,
        status_history: [{ status: "ACTIVE", since: T0 }],
      },
    ],
    issuers: [
      {
        issuer_id: issuerId,
        slug: "bilgi",
        legal_name: "Bilgi",
        category: "EDUCATION",
        assurance: "I2",
        class: "EAA",
        parent_ca_id: caId,
        cert_fingerprint_sha256: issuer.fp,
        issuer_url: "https://issuer.bilgi.tamga.network",
        status_list_base: "https://status.bilgi.tamga.network/",
        status: "SUSPENDED",
        valid_from: T0,
        valid_until: "2028-01-01T00:00:00Z",
        successor_id: null,
        status_history: [
          { status: "ACTIVE", since: T0 },
          { status: "SUSPENDED", since: SUSP },
        ],
        schema_authorizations: [
          { schema_id: computeSchemaId(VCT_D), allowed: true, valid_from: T0, valid_until: "2026-03-01T00:00:00Z" },
        ],
      },
    ],
    relying_parties: [],
    national_schemas: [],
  };
  const lotl = {
    ...(opts.environment ? { environment: opts.environment } : {}),
    list_format_version: opts.badFormat ? "9.9" : "1.0",
    list_type: "lotl",
    version: 1,
    issued_at: T0,
    next_update: next,
    previous_version_hash: null,
    operator: { name: "Tamga", status: "provisional" },
    anchor_signing_keys: [{ fingerprint_sha256: tlSigner.fp, status: "ACTIVE" }],
    national_lists: [
      {
        state_code: "TR",
        status: "ACTIVE",
        list_url: "https://trust.tamga.network/tl-tr.jws",
        signing_keys: [{ fingerprint_sha256: tlSigner.fp, status: "ACTIVE" }],
        recognition: { mode: "unilateral", recognizes: ["TR"] },
      },
      { state_code: "AZ", status: "RESERVED" },
    ],
    schemas: [VCT_D, VCT_S].map((v) => ({
      schema_id: computeSchemaId(v),
      vct: v,
      metadata_url: `https://schemas.tamga.network/v1/x/${v}/metadata.json`,
      content_hash: "sha256-AAAA",
      layer: "NETWORK",
      status: "ACTIVE",
      registered_at: T0,
      status_history: [{ status: "ACTIVE", since: T0 }],
    })),
    wallet_providers: [],
    pid_providers: [],
    zk_circuits: [
      {
        circuit_id: "5a8938159603876eb537a117cfe9e2eaec5a01a042b316a8e57e52e4bb3c9291",
        system: "longfellow-libzk-v1",
        version: 8,
        attributes: 1,
        sha256: "f44ab1a415f284251ea6ad5451d2588c1e7011eb9ba46091116e8caa4c8e0d83",
        status: "ACTIVE",
      },
      {
        circuit_id: "ea4c66add149cbc8fcbf3546bc3e7da1c8ddf28a330881871e28b3edbc971ca4",
        system: "longfellow-libzk-v1",
        version: 8,
        attributes: 2,
        sha256: "0".repeat(64),
        status: "SUSPENDED",
      },
    ],
  };
  const lotlJws = await (opts.wrongSigner ? other : tlSigner).sign(lotl);
  let tlJws = await tlSigner.sign(tl);
  if (opts.tamper) {
    const [h, p, s] = tlJws.split(".");
    const pj = JSON.parse(Buffer.from(p, "base64url").toString());
    pj.issuers[0].assurance = "I3";
    tlJws = [h, Buffer.from(JSON.stringify(pj)).toString("base64url"), s].join(".");
  }
  const a0 = await tlSigner.sign({ seq: 0, previous_hash: null, ts: "2026-09-24T11:30:00Z", kind: "heartbeat" });
  // TL12 kontrol noktası: a0 arşivlendi; cp seq 1, previous_hash = hash(a0); a1 seq 2, previous_hash = hash(cp)
  const cp = opts.checkpoint
    ? await (opts.checkpoint === "bad" ? other : tlSigner).sign({
        seq: opts.checkpoint === "seq" ? 5 : 1,
        previous_hash: sha256Tag(utf8(a0)),
        ts: "2026-09-24T11:40:00Z",
        kind: "checkpoint",
        archive: {
          file: "archive/anchors-0000000-0000000.jsonl",
          sha256: sha256Tag(utf8(a0 + "\n")),
          seq_from: 0,
          seq_to: 0,
          lines: 1,
        },
        ...(opts.checkpoint === "nostate"
          ? {}
          : {
              state: {
                status_lists: [
                  {
                    list_id: "0xold",
                    issuer_id: issuerId,
                    list_uri: "https://status.bilgi.tamga.network/opaque-old",
                    content_hash: "sha256:00",
                    list_version: 3,
                    published_at: "2026-09-24T11:20:00Z",
                    seq: 0,
                  },
                ],
                schemas: [],
              },
            }),
      })
    : null;
  const a1 = await tlSigner.sign({
    seq: cp ? 2 : 1,
    previous_hash: opts.breakChain ? "sha256:00" : sha256Tag(utf8(cp ?? a0)),
    ts: "2026-09-24T11:50:00Z",
    kind: "status_list",
    list_id: "0xabc",
    issuer_id: issuerId,
    list_uri: "https://status.bilgi.tamga.network/opaque1",
    content_hash: "sha256:11",
    list_version: 7,
    published_at: "2026-09-24T11:49:00Z",
  });
  return {
    now,
    issuerId,
    caId,
    tlSigner,
    load: (environment?: "sandbox" | "production") =>
      loadTrustSet({
        environment,
        lotlJws,
        nationalListJws: { TR: tlJws },
        anchorsJsonl: cp ? `${cp}\n${a1}\n` : `${a0}\n${a1}\n`,
        rootFingerprints: [tlSigner.fp],
        now,
      }),
  };
}

beforeAll(async () => {
  ctx = await makeSet();
});

describe("TrustSource(list) taahhüt testleri", () => {
  it("T1: imzalı set yüklenir; iat ACTIVE dönemindeyse YES", async () => {
    const { store, report } = await ctx.load();
    expect(report.healthy).toBe(true);
    const ts = new ListTrustSource(store, () => ctx.now);
    expect(ts.isCredentialAcceptable(ctx.issuerId, sec("2026-02-01T00:00:00Z"))).toBe("YES");
    expect(ts.isRecognizedBy("TR", ctx.issuerId)).toBe("YES");
    expect(ts.isRecognizedBy("AZ", ctx.issuerId)).toBe("NO");
    expect(ts.statusAnchor("0xabc")?.version).toBe(7);
    expect(ts.freshness().healthy).toBe(true);
  });
  it("ADR-0032 ZK2: imzalı listedeki yalnız ETKİN ZK devreleri; bilinmeyen/askıdaki → null", async () => {
    const { store } = await ctx.load();
    const ts = new ListTrustSource(store, () => ctx.now);
    expect(ts.zkCircuits().map((c) => c.attributes)).toEqual([1]);
    expect(ts.zkCircuit("5a8938159603876eb537a117cfe9e2eaec5a01a042b316a8e57e52e4bb3c9291")?.version).toBe(8);
    expect(ts.zkCircuit("ea4c66add149cbc8fcbf3546bc3e7da1c8ddf28a330881871e28b3edbc971ca4")).toBeNull();
    expect(ts.zkCircuit("0".repeat(64))).toBeNull();
  });
  it("T7: SUSPENDED sonrası ihraç NO, öncesi YES (D-BC-3, GV1)", async () => {
    const { store } = await ctx.load();
    const ts = new ListTrustSource(store, () => ctx.now);
    expect(ts.isCredentialAcceptable(ctx.issuerId, sec("2026-07-01T00:00:00Z"))).toBe("NO");
    expect(ts.isCredentialAcceptable(ctx.issuerId, sec("2026-05-01T00:00:00Z"))).toBe("YES");
    expect(ts.isCredentialAcceptable("0x" + "0".repeat(64), sec("2026-02-01T00:00:00Z"))).toBe("NO");
  });
  it("T8: şema yetkisi zaman pencereli; allowlist varsayılanı false", async () => {
    const { store } = await ctx.load();
    const ts = new ListTrustSource(store, () => ctx.now);
    const D = computeSchemaId(VCT_D),
      S = computeSchemaId(VCT_S);
    expect(ts.isCredentialSchemaAcceptable(ctx.issuerId, D, sec("2026-02-01T00:00:00Z"))).toBe("YES");
    expect(ts.isCredentialSchemaAcceptable(ctx.issuerId, D, sec("2026-04-01T00:00:00Z"))).toBe("NO"); // pencere bitti
    expect(ts.isCredentialSchemaAcceptable(ctx.issuerId, S, sec("2026-02-01T00:00:00Z"))).toBe("NO"); // yetki yok (D9)
  });
  it("T2: bayat lotl → healthy=false → UNKNOWN", async () => {
    const c = await makeSet({ staleLotl: true });
    const { store, report } = await c.load();
    expect(report.healthy).toBe(false);
    const ts = new ListTrustSource(store, () => c.now);
    expect(ts.isCredentialAcceptable(c.issuerId, sec("2026-02-01T00:00:00Z"))).toBe("UNKNOWN");
  });
  it("T2b: yüklemede taze liste, zaman geçip next_update ya da çapa yaşı aşılınca UNKNOWN (saat donmaz)", async () => {
    const { store } = await ctx.load();
    let clock = ctx.now;
    const ts = new ListTrustSource(store, () => clock);
    expect(ts.isCredentialAcceptable(ctx.issuerId, sec("2026-02-01T00:00:00Z"))).toBe("YES");
    clock = new Date(ctx.now.getTime() + 400 * 86400_000); // next_update (≤ 90 gün) çoktan geçti
    expect(ts.isCredentialAcceptable(ctx.issuerId, sec("2026-02-01T00:00:00Z"))).toBe("UNKNOWN");
    expect(ts.freshness().healthy).toBe(false);
  });
  it("T3: bilinmeyen list_format_version → DUR (CMP2)", async () => {
    const c = await makeSet({ badFormat: true });
    await expect(c.load()).rejects.toThrow(/CMP2/);
  });
  it("SB2: sandbox listesi gerçek ağ istemcisinde DURUR, sandbox istemcisinde yüklenir", async () => {
    const c = await makeSet({ environment: "sandbox" });
    await expect(c.load()).rejects.toThrow(/SB2/);
    const { report } = await c.load("sandbox");
    expect(report.lotlVersion).toBe(1);
    await expect(ctx.load("sandbox")).rejects.toThrow(/SB2/); // gerçek ağ listesi sandbox istemcisinde de DURUR
  });
  it("T4: kurcalanmış payload → imza doğrulaması başarısız", async () => {
    const c = await makeSet({ tamper: true });
    await expect(c.load()).rejects.toThrow();
  });
  it("T5: kayıtlı olmayan imzacı → red", async () => {
    const c = await makeSet({ wrongSigner: true });
    await expect(c.load()).rejects.toThrow(/fingerprint not registered/);
  });
  it("T9 (TL12): kontrol noktasıyla başlayan günlük yüklenir; yabancı imzalı ya da seq tutarsız kontrol noktası → DUR", async () => {
    const ok = await (await makeSet({ checkpoint: "ok" })).load();
    expect(ok.report.healthy).toBe(true);
    expect(ok.report.anchorsSeq).toBe(2);
    expect(ok.report.checkpoint?.seq_to).toBe(0);
    expect(new ListTrustSource(ok.store, () => ctx.now).statusAnchor("0xabc")?.version).toBe(7);
    // arşivde kalan listenin çapası kontrol noktasının anlık durumundan geri kuruldu (arşiv okunmadı)
    expect(new ListTrustSource(ok.store, () => ctx.now).statusAnchor("0xold")?.version).toBe(3);
    await expect((await makeSet({ checkpoint: "nostate" })).load()).rejects.toThrow(/state snapshot/);
    await expect((await makeSet({ checkpoint: "bad" })).load()).rejects.toThrow();
    await expect((await makeSet({ checkpoint: "seq" })).load()).rejects.toThrow(/checkpoint seq/);
  });
  it("T6: kırık hash zinciri → DUR", async () => {
    const c = await makeSet({ breakChain: true });
    await expect(c.load()).rejects.toThrow(/hash chain broken/);
  });
});
