/**
 * @tamga-network/zk (ADR-0032 Aşama 2). Birim testleri her ortamda; uçtan uca test masaüstü ispatçısı varsa (`npm run zk:build -w
 * @tamga-network/zk` → bin/): deneme kök CA → kurum → Tamga kimlik belgesi (sahte kişi) → cüzdanın olağan cihaz imzalı yanıtı →
 * BU PAKETLE ispat → ağın doğrulayıcısı (`@tamga-network/verifier/zk`, WASM) kabul eder; doğrulayıcı doğum tarihini görmez.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { randomBytes, webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { computeIssuerId, computeSchemaId } from "@tamga-network/core";
import {
  buildDeviceResponse,
  deviceSign,
  issueMdoc,
  oid4vpSessionTranscript,
  p256,
  parseZkDeviceResponse,
} from "@tamga-network/mdoc";
import type { TrustSource, ZkCircuit } from "@tamga-network/trust";
import { WasmZkBackend, verifyMdocZkFormat } from "@tamga-network/verifier/zk";
import {
  ZkError,
  encodeProveBuffer,
  httpCircuitSource,
  loadCircuit,
  memoryCircuitSource,
  presentZk,
  selectCircuit,
  unavailableProver,
  zkQueryFromDcql,
  type ZkCircuitEntry,
} from "./index.js";
import { NodeProcessProver, defaultProverBin, fileCircuitSource } from "./node.js";

const CIRCUIT_ID = "5a8938159603876eb537a117cfe9e2eaec5a01a042b316a8e57e52e4bb3c9291";
const CIRCUIT: ZkCircuitEntry = {
  circuit_id: CIRCUIT_ID,
  system: "longfellow-libzk-v1",
  version: 8,
  attributes: 1,
  sha256: "f44ab1a415f284251ea6ad5451d2588c1e7011eb9ba46091116e8caa4c8e0d83",
  status: "ACTIVE",
};
const CIRCUIT_DIR = fileURLToPath(new URL("../../verifier/src/zk/circuits/", import.meta.url));
const DOC_TYPE = "urn:tamga:id:IdentityAttestation:1";
const NS = "tamga.id.1";
const AGE_QUERY = {
  id: "age",
  format: "mso_mdoc_zk",
  meta: { doctype_value: DOC_TYPE },
  claims: [{ path: [NS, "age_over_18"], values: [true] }],
};

describe("zk — DCQL isteği", () => {
  it("mso_mdoc_zk sorgusu → belge türü ve sabit değerli öğe", () => {
    expect(zkQueryFromDcql(AGE_QUERY)).toEqual({
      queryId: "age",
      docType: DOC_TYPE,
      claims: [{ namespace: NS, element: "age_over_18", value: true }],
    });
  });
  it("değeri belirtilmemiş öğe ZK ile istenemez (ispat açıklama değildir)", () => {
    expect(() => zkQueryFromDcql({ ...AGE_QUERY, claims: [{ path: [NS, "birth_date"] }] })).toThrow(ZkError);
  });
  it("başka biçim, eksik docType, iki ad alanı reddedilir", () => {
    expect(() => zkQueryFromDcql({ ...AGE_QUERY, format: "mso_mdoc" })).toThrow(/not a mso_mdoc_zk/);
    expect(() => zkQueryFromDcql({ ...AGE_QUERY, meta: {} })).toThrow(/doctype_value/);
    expect(() =>
      zkQueryFromDcql({
        ...AGE_QUERY,
        claims: [
          { path: [NS, "age_over_18"], values: [true] },
          { path: ["other.ns", "nationality"], values: ["TR"] },
        ],
      }),
    ).toThrow(/one namespace/);
  });
});

describe("zk — devre (ZK2)", () => {
  it("etkin, Longfellow, sürüm ve öğe sayısı eşleşen devre seçilir; yoksa no_circuit", () => {
    expect(selectCircuit([CIRCUIT], 1, 8)).toBe(CIRCUIT);
    expect(() => selectCircuit([CIRCUIT], 2, 8)).toThrow(expect.objectContaining({ code: "no_circuit" }));
    expect(() => selectCircuit([CIRCUIT], 1, 9)).toThrow(expect.objectContaining({ code: "no_circuit" }));
    expect(() => selectCircuit([{ ...CIRCUIT, status: "REVOKED" }], 1, 8)).toThrow(ZkError);
    expect(() => selectCircuit(undefined, 1, 8)).toThrow(ZkError);
  });
  it("listedeki özetle eşleşmeyen devre kullanılmaz", async () => {
    await expect(
      loadCircuit(memoryCircuitSource({ [CIRCUIT_ID]: new Uint8Array([1, 2, 3]) }), CIRCUIT),
    ).rejects.toMatchObject({
      code: "circuit_mismatch",
    });
    await expect(loadCircuit(memoryCircuitSource({}), CIRCUIT)).rejects.toMatchObject({ code: "no_circuit" });
    const ok = await loadCircuit(fileCircuitSource(CIRCUIT_DIR), CIRCUIT);
    expect(ok.length).toBeGreaterThan(100_000);
  });
});

describe("zk — arka uç tamponu ve olağan yol (ZK5)", () => {
  it("tampon: alanlar u32 LE uzunlukla, kurum anahtarı 0x onaltılık koordinat", () => {
    const key = p256.getPublicKey(p256.utils.randomSecretKey(), false);
    const buf = encodeProveBuffer({
      circuitId: CIRCUIT_ID,
      circuit: new Uint8Array([9]),
      deviceResponse: new Uint8Array([8, 8]),
      transcript: new Uint8Array([7]),
      docType: DOC_TYPE,
      claims: [{ namespace: NS, element: "age_over_18", value: true }],
      now: "2026-10-06T10:00:00Z",
      issuerKey: key,
    });
    const dv = new DataView(buf.buffer);
    expect(dv.getUint32(0, true)).toBe(32); // combined_hash
    expect(dv.getUint32(36, true)).toBe(1); // devre
    expect(buf.at(-1)).toBe(0xf5); // son alan: true'nun CBOR'u
    expect(() =>
      encodeProveBuffer({
        circuitId: CIRCUIT_ID,
        circuit: new Uint8Array(),
        deviceResponse: new Uint8Array(),
        transcript: new Uint8Array(),
        docType: DOC_TYPE,
        claims: [],
        now: "",
        issuerKey: new Uint8Array(33),
      }),
    ).toThrow(/uncompressed P-256/);
  });
  it("ispatçı yoksa (Expo Go, eski telefon) unavailable — cüzdan olağan sunuma döner", async () => {
    await expect(
      presentZk({
        prover: unavailableProver,
        circuits: memoryCircuitSource({}),
        trustedCircuits: [CIRCUIT],
        query: zkQueryFromDcql(AGE_QUERY),
        deviceResponse: new Uint8Array(),
        transcript: new Uint8Array(),
        issuerX5chain: [],
        issuerKey: new Uint8Array(65),
      }),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
});

describe("zk — devre kaynakları ve doğrulayıcının kabul ettiği devreler", () => {
  const good = new Uint8Array(readFileSync(`${CIRCUIT_DIR}${CIRCUIT_ID}.zst`));
  const fakeFetch = (body: Uint8Array, headers: Record<string, string> = {}) =>
    (async () => new Response(body.slice().buffer as ArrayBuffer, { status: 200, headers })) as unknown as typeof fetch;
  const memCache = () => {
    const m = new Map<string, Uint8Array>();
    return { m, get: async (id: string) => m.get(id), set: async (id: string, b: Uint8Array) => void m.set(id, b) };
  };
  it("httpCircuitSource: önbelleğe yalnız listedeki özetle tutan dosya yazılır; boyut sınırı", async () => {
    const c1 = memCache();
    const ok = httpCircuitSource("https://x", { fetch: fakeFetch(good), cache: c1, trustedCircuits: [CIRCUIT] });
    expect((await ok.get(CIRCUIT_ID))?.length).toBe(good.length);
    expect(c1.m.has(CIRCUIT_ID)).toBe(true);
    const c2 = memCache();
    const bad = httpCircuitSource("https://x", {
      fetch: fakeFetch(new Uint8Array([1, 2])),
      cache: c2,
      trustedCircuits: [CIRCUIT],
    });
    expect(await bad.get(CIRCUIT_ID)).toBeUndefined();
    expect(c2.m.size).toBe(0);
    const c3 = memCache();
    const noList = httpCircuitSource("https://x", { fetch: fakeFetch(good), cache: c3 });
    expect(await noList.get(CIRCUIT_ID)).toBeDefined();
    expect(c3.m.size).toBe(0); // liste yoksa önbelleğe yazılmaz
    const big = httpCircuitSource("https://x", { fetch: fakeFetch(good), maxBytes: 1000 });
    expect(await big.get(CIRCUIT_ID)).toBeUndefined();
  });
  it("presentZk: doğrulayıcının kabul etmediği devre kullanılmaz (acceptedCircuits)", async () => {
    const prover = {
      name: "t",
      available: async () => true,
      circuitVersion: async () => 8,
      prove: async () => new Uint8Array([1]),
    };
    await expect(
      presentZk({
        prover,
        circuits: memoryCircuitSource({ [CIRCUIT_ID]: good }),
        trustedCircuits: [CIRCUIT],
        acceptedCircuits: ["0".repeat(64)],
        query: zkQueryFromDcql(AGE_QUERY),
        deviceResponse: new Uint8Array(),
        transcript: new Uint8Array(),
        issuerX5chain: [],
        issuerKey: new Uint8Array(65),
      }),
    ).rejects.toMatchObject({ code: "no_circuit" });
  });
});

const BIN = defaultProverBin();
describe.skipIf(!existsSync(BIN))("zk — uçtan uca: masaüstü ispatçı → ağın doğrulayıcısı", () => {
  it("18 yaş üstü ispatı üretilir ve doğrulanır; doğrulayıcı yalnız age_over_18 = true görür", async () => {
    cryptoProvider.set(webcrypto as unknown as Crypto);
    const subtle = webcrypto.subtle;
    const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
    const nowSec = Math.floor(Date.now() / 1000);
    const notBefore = new Date((nowSec - 86400) * 1000);
    const notAfter = new Date((nowSec + 365 * 86400) * 1000);
    const rootKeys = (await subtle.generateKey(ALG, false, ["sign", "verify"])) as CryptoKeyPair;
    const rootName = "CN=Tamga ZK Prover Test Root,O=Tamga Network Test,C=TR";
    const root = await X509CertificateGenerator.createSelfSigned({
      serialNumber: "01",
      name: rootName,
      notBefore,
      notAfter,
      keys: rootKeys,
      signingAlgorithm: ALG,
    });
    const issuerSk = p256.utils.randomSecretKey();
    const issuerKey = p256.getPublicKey(issuerSk, false);
    const issuer = await X509CertificateGenerator.create({
      serialNumber: "02",
      subject: "CN=Tamga ZK Prover Test Issuer,O=Tamga Network Test,C=TR",
      issuer: rootName,
      notBefore,
      notAfter,
      publicKey: await subtle.importKey("raw", issuerKey, ALG, true, ["verify"]),
      signingKey: rootKeys.privateKey,
      signingAlgorithm: ALG,
    });
    const issuerDer = new Uint8Array(issuer.rawData);

    // Kurumun verdiği belge (sahte kişi) ve cüzdanın bu oturum için olağan, cihaz imzalı yanıtı
    const deviceSk = p256.utils.randomSecretKey();
    const issued = issueMdoc({
      docType: DOC_TYPE,
      namespaces: {
        [NS]: {
          given_name: "Ayşe",
          family_name: "Deneme",
          birth_date: "2000-01-01",
          nationality: "TR",
          age_over_18: true,
        },
      },
      deviceKeyRaw: p256.getPublicKey(deviceSk, false),
      issuerSk,
      x5chain: [issuerDer],
      signed: nowSec - 120,
      validFrom: nowSec - 120,
      validUntil: nowSec + 30 * 86400,
      randomBytes: (n) => new Uint8Array(randomBytes(n)),
      status: { idx: 4711, uri: "https://status.tamga.network/0123456789abcdef" },
    });
    const session = {
      clientId: "x509_san_dns:verify.tamga.network",
      nonce: "n-" + randomBytes(8).toString("hex"),
      responseUri: "https://verify.tamga.network/vp/response",
    };
    const transcript = oid4vpSessionTranscript(session.clientId, session.nonce, session.responseUri);
    const deviceResponse = buildDeviceResponse({
      docType: DOC_TYPE,
      issuerSigned: issued.issuerSigned,
      deviceSignature: deviceSign(transcript, DOC_TYPE, deviceSk),
    });

    // Bu paket: ispat + ZK DeviceResponse
    const zk = await presentZk({
      prover: new NodeProcessProver(BIN),
      circuits: fileCircuitSource(CIRCUIT_DIR),
      trustedCircuits: [CIRCUIT],
      query: zkQueryFromDcql(AGE_QUERY),
      deviceResponse,
      transcript,
      issuerX5chain: [issuerDer],
      issuerKey,
      now: new Date(nowSec * 1000),
    });
    const parsed = parseZkDeviceResponse(zk);
    expect(parsed.disclosed).toEqual({ namespace: NS, elements: { age_over_18: true } });
    expect(JSON.stringify(parsed.disclosed)).not.toContain("2000-01-01");

    // Ağın doğrulayıcısı
    const issuerId = computeIssuerId("TR", issuerDer);
    const schemaId = computeSchemaId(DOC_TYPE);
    const trust = {
      isCredentialAcceptable: (id: string) => (id === issuerId ? "YES" : "NO"),
      isCredentialSchemaAcceptable: (id: string, sid: string) => (id === issuerId && sid === schemaId ? "YES" : "NO"),
      isRecognizedBy: () => "YES",
      issuer: (id: string) =>
        id === issuerId
          ? { issuer_id: issuerId, legal_name: "Test", category: "IDENTITY", assurance: "I2", class: "EAA" }
          : null,
      schema: (sid: string) => (sid === schemaId ? { schema_id: schemaId, vct: DOC_TYPE, status: "ACTIVE" } : null),
      zkCircuit: (id: string) => (id === CIRCUIT_ID ? (CIRCUIT as ZkCircuit) : null),
      zkCircuits: () => [CIRCUIT as ZkCircuit],
      isWalletProviderKey: () => "NO",
      freshness: () => ({ source: "list", version: 1, ageSec: 0, healthy: true }),
    } as unknown as TrustSource;
    const r = await verifyMdocZkFormat(Buffer.from(zk).toString("base64url"), {
      ...session,
      stateCode: "TR",
      now: nowSec,
      rootCertsDer: [new Uint8Array(root.rawData)],
      expectedDocTypes: [DOC_TYPE],
      requestedElements: ["age_over_18"],
      namespace: NS,
      trust,
      maxSkewSec: 120,
      backend: new WasmZkBackend(),
    });
    expect(r.ok, r.ok ? "" : `${r.failedStep}: ${r.reason}`).toBe(true);
    if (r.ok) expect(r.claims).toEqual({ age_over_18: true });
  }, 120_000);
});
