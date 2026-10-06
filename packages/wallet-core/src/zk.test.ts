/**
 * ADR-0032 Aşama 2c — cüzdan çekirdeğinde sıfır bilgi ispatı bağlantısı: DCQL `mso_mdoc_zk` eşleşmesi, ispatçı yokken klasik
 * seçeneğe dönüş (ZK5), ispatçıya giden girdi (olağan cihaz imzalı yanıt + oturum özeti + kurum anahtarı) ve vp_token'a giren
 * ispat. Çekirdek ispatçıya bağımlı değildir: burada ispatçı sahte bir işlevdir (gerçek ispat `packages/zk` testinde).
 */
import { describe, expect, it } from "vitest";
import { randomBytes, webcrypto } from "node:crypto";
import { X509CertificateGenerator } from "@peculiar/x509";
import { dcApiSessionTranscript, decode, issueMdoc, p256 } from "@tamga-network/mdoc";
import {
  MemoryKeyStore,
  SoftwareKeyProvider,
  WalletError,
  b64u,
  b64uDecode,
  checkDcqlShape,
  jwkThumbprint,
  jwkToPoint,
  matchDcql,
  respond,
  selectDcql,
  type DcqlQuery,
  type StoredCredential,
  type VpRequest,
  type ZkProveRequest,
} from "./index.js";

const DOC_TYPE = "urn:tamga:id:IdentityAttestation:1";
const NS = "tamga.id.1";
const CIRCUIT = "5a8938159603876eb537a117cfe9e2eaec5a01a042b316a8e57e52e4bb3c9291";
const zkQuery = (values: unknown[] = [true]) => ({
  id: "age_zk",
  format: "mso_mdoc_zk",
  meta: {
    doctype_value: DOC_TYPE,
    zk_system_type: [{ zkSystemId: CIRCUIT, system: "longfellow-libzk-v1", params: { circuit_hash: CIRCUIT } }],
  },
  claims: [{ path: [NS, "age_over_18"], values }],
});
const mdocQuery = {
  id: "age_mdoc",
  format: "mso_mdoc",
  meta: { doctype_value: DOC_TYPE },
  claims: [{ path: [NS, "age_over_18"], values: [true] }],
};
const cred = (claims: Record<string, unknown>, mdoc?: string): StoredCredential => ({
  id: "id1",
  vct: DOC_TYPE,
  typeName: "Kimlik",
  issuer: "i",
  issuerId: "0x1",
  leafFingerprint: "f",
  iat: 1,
  claims,
  disclosureNames: Object.keys(claims),
  copies: [
    { keyRef: "k1", cnf: { kty: "EC", crv: "P-256", x: "", y: "" }, combined: "", usedBy: [], mdoc: mdoc ?? "x" },
  ],
  receivedAt: 1,
});

describe("ADR-0032: mso_mdoc_zk eşleşmesi", () => {
  const adult = cred({ age_over_18: true, birth_date: "2000-01-01" });

  it("ispatçı varsa ZK sorgusu mdoc gibi eşleşir; ispatlanacak öğe ve devreler eşleşmede", () => {
    const r = matchDcql({ credentials: [zkQuery()] }, [adult], { zk: true });
    expect(r.unmatched).toEqual([]);
    expect(r.matches[0]).toMatchObject({
      queryId: "age_zk",
      format: "mso_mdoc_zk",
      namespace: NS,
      requested: ["age_over_18"],
      zk: { claims: [{ namespace: NS, element: "age_over_18", value: true }], circuits: [CIRCUIT] },
    });
  });

  it("ispatçı yoksa (varsayılan) önerilmez: neden zk_unavailable; değer tutmuyorsa values; mdoc yoksa no_credential", () => {
    const off = matchDcql({ credentials: [zkQuery()] }, [adult]);
    expect(off.matches).toEqual([]);
    expect(off.gaps[0]).toMatchObject({ queryId: "age_zk", reason: "zk_unavailable", claims: ["age_over_18"] });
    const minor = matchDcql({ credentials: [zkQuery()] }, [cred({ age_over_18: false })], { zk: true });
    expect(minor.gaps[0]).toMatchObject({ reason: "values", claims: ["age_over_18"] });
    const noMdoc = { ...adult, copies: [{ ...adult.copies[0], mdoc: undefined }] };
    expect(matchDcql({ credentials: [zkQuery()] }, [noMdoc], { zk: true }).gaps[0].reason).toBe("no_credential");
  });

  it("credential_sets [ZK] ya da [klasik]: ispatçı yoksa klasik seçenek, varsa doğrulayıcının sırası (ZK) seçilir", () => {
    const dcql: DcqlQuery = {
      credentials: [zkQuery(), mdocQuery],
      credential_sets: [{ options: [["age_zk"], ["age_mdoc"]] }],
    };
    const off = selectDcql(dcql, matchDcql(dcql, [adult]).matches);
    expect(off).toMatchObject({ ok: true, queryIds: ["age_mdoc"] });
    const on = selectDcql(dcql, matchDcql(dcql, [adult], { zk: true }).matches);
    expect(on).toMatchObject({ ok: true, queryIds: ["age_zk"] });
    // yalnız ZK isteyen istek ispatçı yokken karşılanamaz; neden açık (belge yok değil)
    const only = { credentials: [zkQuery()] };
    const m = matchDcql(only, [adult]);
    expect(selectDcql(only, m.matches)).toMatchObject({ ok: false, missing: ["age_zk"] });
    expect(m.gaps[0].reason).toBe("zk_unavailable");
  });

  it("checkDcqlShape: ZK öğesi tek sabit değer ister; yol [namespace, element]", () => {
    expect(() => checkDcqlShape({ credentials: [zkQuery()] })).not.toThrow();
    expect(() => checkDcqlShape({ credentials: [zkQuery([])] })).toThrow(/exactly one expected value/);
    expect(() => checkDcqlShape({ credentials: [zkQuery([true, false])] })).toThrow(/exactly one expected value/);
    expect(() => checkDcqlShape({ credentials: [{ ...zkQuery(), claims: [{ path: ["age_over_18"] }] }] })).toThrow(
      /mso_mdoc_zk claim path/,
    );
  });
});

describe("ADR-0032: ZK sunumu (respond)", async () => {
  const subtle = webcrypto.subtle;
  const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
  const nowSec = Math.floor(Date.now() / 1000);
  const rootKeys = (await subtle.generateKey(ALG, false, ["sign", "verify"])) as CryptoKeyPair;
  const rootName = "CN=Tamga Wallet ZK Test Root,O=Tamga Network Test,C=TR";
  const issuerSk = p256.utils.randomSecretKey();
  const issuerKey = p256.getPublicKey(issuerSk, false);
  const issuerCert = await X509CertificateGenerator.create({
    serialNumber: "02",
    subject: "CN=Tamga Wallet ZK Test Issuer,O=Tamga Network Test,C=TR",
    issuer: rootName,
    notBefore: new Date((nowSec - 86400) * 1000),
    notAfter: new Date((nowSec + 365 * 86400) * 1000),
    publicKey: await subtle.importKey("raw", issuerKey, ALG, true, ["verify"]),
    signingKey: rootKeys.privateKey,
    signingAlgorithm: ALG,
  });
  const issuerDer = new Uint8Array(issuerCert.rawData);
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  const deviceJwk = await keys.generate("k1");
  const issued = issueMdoc({
    docType: DOC_TYPE,
    namespaces: { [NS]: { given_name: "Ayşe", birth_date: "2000-01-01", age_over_18: true } },
    deviceKeyRaw: jwkToPoint(deviceJwk),
    issuerSk,
    x5chain: [issuerDer],
    signed: nowSec - 60,
    validFrom: nowSec - 60,
    validUntil: nowSec + 86400,
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
  });
  const credential = cred(
    { given_name: "Ayşe", birth_date: "2000-01-01", age_over_18: true },
    b64u(issued.issuerSigned),
  );
  credential.copies[0].cnf = deviceJwk;
  const encKp = p256.utils.randomSecretKey();
  const encPub = p256.getPublicKey(encKp, false);
  const encJwk = {
    kty: "EC",
    crv: "P-256",
    x: b64u(encPub.subarray(1, 33)),
    y: b64u(encPub.subarray(33, 65)),
    use: "enc",
  } as VpRequest["encJwk"];
  const ORIGIN = "https://shop.example";
  const request = {
    clientId: "x509_hash:abc",
    clientIdPrefix: "x509_hash",
    clientIdValue: "abc",
    responseUri: "",
    nonce: "nonce-0123456789abcdef",
    dcql: { credentials: [zkQuery()] },
    encJwk,
    enc: "A128GCM",
    leafFingerprint: "f",
    leafDer: new Uint8Array(),
    payload: {},
    rpKey: "shop.example",
    origin: ORIGIN,
  } as VpRequest;
  const match = matchDcql(request.dcql, [credential], { zk: true }).matches[0];
  const input = { match, keyRef: "k1", combined: "", disclose: match.requested };
  const http = async () => {
    throw new Error("no network in a DC API response");
  };

  it("ispatçı olağan cihaz imzalı yanıtı, oturum özetini ve kurum anahtarını alır; dönen baytlar vp_token'a girer", async () => {
    const seen: ZkProveRequest[] = [];
    const proof = new Uint8Array([0xa3, 1, 2, 3]);
    const out = await respond({
      request,
      matches: [input],
      keys,
      http,
      zk: async (a) => {
        seen.push(a);
        return proof;
      },
    });
    expect(out.vpToken).toEqual({ age_zk: [b64u(proof)] });
    expect(out.dcApiResponse?.response.split(".")).toHaveLength(5);
    const a = seen[0];
    expect(a).toMatchObject({
      queryId: "age_zk",
      docType: DOC_TYPE,
      namespace: NS,
      claims: [{ namespace: NS, element: "age_over_18", value: true }],
      circuits: [CIRCUIT],
    });
    expect(a.transcript).toEqual(dcApiSessionTranscript(ORIGIN, request.nonce, jwkThumbprint(encJwk)));
    expect(a.issuerKey).toEqual(issuerKey);
    expect(a.issuerX5chain[0]).toEqual(issuerDer);
    // ispatçının girdisi olağan DeviceResponse: yalnız ispatlanan öğe açık, cihaz imzası var (WL11)
    const dr = decode(a.deviceResponse) as Map<string, unknown>;
    const doc = (dr.get("documents") as Map<string, unknown>[])[0];
    expect(doc.get("docType")).toBe(DOC_TYPE);
    const text = new TextDecoder("latin1").decode(a.deviceResponse);
    expect(text).toContain("age_over_18");
    expect(text).not.toContain("birth_date");
    expect(text).not.toContain("given_name");
    expect(b64uDecode(out.vpToken.age_zk[0])).toEqual(proof);
  });

  it("ispatçı yoksa ya da hata verirse belge gönderilmez: unsupported + detail.zk (ZK5)", async () => {
    const noHook = respond({ request, matches: [input], keys, http });
    await expect(noHook).rejects.toBeInstanceOf(WalletError);
    await expect(noHook).rejects.toMatchObject({ code: "unsupported", detail: { zk: "unavailable" } });
    const noCircuit = respond({
      request,
      matches: [input],
      keys,
      http,
      zk: async () => {
        throw Object.assign(new Error("no circuit"), { code: "no_circuit" });
      },
    });
    await expect(noCircuit).rejects.toMatchObject({ code: "unsupported", detail: { zk: "no_circuit" } });
    const crash = respond({
      request,
      matches: [input],
      keys,
      http,
      zk: async () => {
        throw new Error("boom");
      },
    });
    await expect(crash).rejects.toMatchObject({ code: "unsupported", detail: { zk: "prove_failed" } });
    const empty = respond({ request, matches: [input], keys, http, zk: async () => new Uint8Array() });
    await expect(empty).rejects.toMatchObject({ detail: { zk: "prove_failed" } });
  });
});
