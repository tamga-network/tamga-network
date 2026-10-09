/**
 * ADR-0032 Aşama 2c — cüzdan çekirdeğinde sıfır bilgi ispatı bağlantısı: DCQL `mso_mdoc_zk` eşleşmesi, ispatçı yokken klasik
 * seçeneğe dönüş (ZK5), ispatçıya giden girdi (olağan cihaz imzalı yanıt + oturum özeti + kurum anahtarı) ve vp_token'a giren
 * ispat. Çekirdek ispatçıya bağımlı değildir: burada ispatçı sahte bir işlevdir (gerçek ispat `packages/zk` testinde).
 * ADR-0044: ZK sunumu yalnız kimlik belgesinin kısa ömürlü ZK kopyasıyla (`ZK_COPY_VCT`, ≤ 24 sa) — ana belgenin mdoc'u ZK'da
 * kullanılmaz (ZC1).
 */
import { describe, expect, it } from "vitest";
import { randomBytes, webcrypto } from "node:crypto";
import { X509CertificateGenerator } from "@peculiar/x509";
import { dcApiSessionTranscript, decode, issueMdoc, p256, type CborValue } from "@tamga-network/mdoc";
import {
  MemoryKeyStore,
  SoftwareKeyProvider,
  WalletError,
  ZK_COPY_VCT,
  b64u,
  b64uDecode,
  checkDcqlShape,
  jwkThumbprint,
  jwkToPoint,
  matchDcql,
  respond,
  selectDcql,
  type DcqlQuery,
  type PublicJwk,
  type StoredCredential,
  type VpRequest,
  type ZkProveRequest,
} from "./index.js";

const DOC_TYPE = "urn:tamga:id:IdentityAttestation:1";
const NS = "tamga.id.1";
const CIRCUIT = "5a8938159603876eb537a117cfe9e2eaec5a01a042b316a8e57e52e4bb3c9291";
const NOW = Math.floor(Date.now() / 1000);
const zkQuery = (values: unknown[] = [true], doctype = ZK_COPY_VCT) => ({
  id: "age_zk",
  format: "mso_mdoc_zk",
  meta: {
    doctype_value: doctype,
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
const NO_KEY: PublicJwk = { kty: "EC", crv: "P-256", x: "", y: "" };

/** ZK kopyası mdoc'u (eşleşme imzayı denetlemez — kopya alınırken denetlendi; burada rastgele kurum anahtarı). */
function zkCopyMdoc(
  elements: Record<string, CborValue>,
  opts: { issuerSk?: Uint8Array; deviceKey?: Uint8Array; x5c?: Uint8Array } = {},
) {
  const sk = opts.issuerSk ?? p256.utils.randomSecretKey();
  return b64u(
    issueMdoc({
      docType: ZK_COPY_VCT,
      namespaces: { [NS]: elements },
      deviceKeyRaw: opts.deviceKey ?? p256.getPublicKey(p256.utils.randomSecretKey(), false),
      issuerSk: sk,
      x5chain: [opts.x5c ?? new Uint8Array([0x30, 1, 2, 3])],
      signed: NOW - 60,
      validFrom: NOW - 60,
      validUntil: NOW - 60 + 24 * 3600,
      randomBytes: (n) => new Uint8Array(randomBytes(n)),
    }).issuerSigned,
  );
}
const cred = (
  claims: Record<string, unknown>,
  zk?: { mdoc: string; validUntil?: number; keyRef?: string; cnf?: PublicJwk } | null,
): StoredCredential => ({
  id: "id1",
  vct: DOC_TYPE,
  typeName: "Kimlik",
  issuer: "i",
  issuerId: "0x1",
  leafFingerprint: "f",
  iat: 1,
  claims,
  disclosureNames: Object.keys(claims),
  copies: [{ keyRef: "main1", cnf: NO_KEY, combined: "", usedBy: [], mdoc: "x" }],
  receivedAt: 1,
  ...(zk === null
    ? {}
    : {
        zk: {
          docType: ZK_COPY_VCT,
          configurationId: ZK_COPY_VCT,
          token: "t",
          tokenEndpoint: "https://id.example/token",
          dpopRef: "dpop",
          dpopJwk: NO_KEY,
          copies: zk
            ? [
                {
                  keyRef: zk.keyRef ?? "zk1",
                  cnf: zk.cnf ?? NO_KEY,
                  mdoc: zk.mdoc,
                  validFrom: NOW - 60,
                  validUntil: zk.validUntil ?? NOW - 60 + 24 * 3600,
                },
              ]
            : [],
        },
      }),
});

describe("ADR-0032 + ADR-0044: mso_mdoc_zk eşleşmesi (yalnız ZK kopyasıyla)", () => {
  const adult = cred({ age_over_18: true, birthdate: "2000-01-01" }, { mdoc: zkCopyMdoc({ age_over_18: true }) });

  it("ispatçı ve geçerli ZK kopyası varsa eşleşir; ispatlanacak öğe, devreler ve kopya eşleşmede", () => {
    const r = matchDcql({ credentials: [zkQuery()] }, [adult], { zk: true });
    expect(r.unmatched).toEqual([]);
    expect(r.matches[0]).toMatchObject({
      queryId: "age_zk",
      format: "mso_mdoc_zk",
      namespace: NS,
      requested: ["age_over_18"],
      zk: { claims: [{ namespace: NS, element: "age_over_18", value: true }], circuits: [CIRCUIT], copyKeyRef: "zk1" },
    });
  });

  it("ispatçı yoksa zk_unavailable; kopyada değer tutmuyorsa values; ZK bağı yoksa no_credential", () => {
    const off = matchDcql({ credentials: [zkQuery()] }, [adult]);
    expect(off.matches).toEqual([]);
    expect(off.gaps[0]).toMatchObject({ queryId: "age_zk", reason: "zk_unavailable", claims: ["age_over_18"] });
    const minor = matchDcql(
      { credentials: [zkQuery()] },
      [cred({ age_over_18: false }, { mdoc: zkCopyMdoc({ age_over_18: false }) })],
      { zk: true },
    );
    expect(minor.gaps[0]).toMatchObject({ reason: "values", claims: ["age_over_18"] });
    const noBinding = cred({ age_over_18: true }, null);
    expect(matchDcql({ credentials: [zkQuery()] }, [noBinding], { zk: true }).gaps[0].reason).toBe("no_credential");
  });

  it("ZC1: kopya yoksa ya da süresi dolduysa ZK sorgusu karşılanmaz (zk_unavailable, belge belli) — ana mdoc kullanılmaz", () => {
    const none = cred({ age_over_18: true }, undefined);
    const r1 = matchDcql({ credentials: [zkQuery()] }, [none], { zk: true });
    expect(r1.gaps[0]).toMatchObject({ reason: "zk_unavailable", credential: { id: "id1" } });
    const expired = cred({ age_over_18: true }, { mdoc: zkCopyMdoc({ age_over_18: true }), validUntil: NOW + 30 });
    expect(matchDcql({ credentials: [zkQuery()] }, [expired], { zk: true }).gaps[0].reason).toBe("zk_unavailable");
    // işaretsiz ZK isteği (ana tür) ana belgenin mdoc'uyla karşılanmaz
    const unmarked = matchDcql({ credentials: [zkQuery([true], DOC_TYPE)] }, [adult], { zk: true });
    expect(unmarked.matches).toEqual([]);
    expect(unmarked.gaps[0].reason).toBe("no_credential");
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

describe("ADR-0032 + ADR-0044: ZK sunumu (respond)", async () => {
  const subtle = webcrypto.subtle;
  const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
  const rootKeys = (await subtle.generateKey(ALG, false, ["sign", "verify"])) as CryptoKeyPair;
  const rootName = "CN=Tamga Wallet ZK Test Root,O=Tamga Network Test,C=TR";
  const issuerSk = p256.utils.randomSecretKey();
  const issuerKey = p256.getPublicKey(issuerSk, false);
  const issuerCert = await X509CertificateGenerator.create({
    serialNumber: "02",
    subject: "CN=Tamga Wallet ZK Test Issuer,O=Tamga Network Test,C=TR",
    issuer: rootName,
    notBefore: new Date((NOW - 86400) * 1000),
    notAfter: new Date((NOW + 365 * 86400) * 1000),
    publicKey: await subtle.importKey("raw", issuerKey, ALG, true, ["verify"]),
    signingKey: rootKeys.privateKey,
    signingAlgorithm: ALG,
  });
  const issuerDer = new Uint8Array(issuerCert.rawData);
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  const zkKey = await keys.generate("zk1");
  const credential = cred(
    { given_name: "Ayşe", birthdate: "2000-01-01", age_over_18: true },
    {
      mdoc: zkCopyMdoc({ age_over_18: true }, { issuerSk, deviceKey: jwkToPoint(zkKey), x5c: issuerDer }),
      keyRef: "zk1",
      cnf: zkKey,
    },
  );
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
  // uygulama ana belgenin kopyasını verse de ZK sunumu eşleşmedeki ZK kopyasıyla yapılır
  const input = { match, keyRef: "main1", combined: "", disclose: match.requested };
  const http = async () => {
    throw new Error("no network in a DC API response");
  };

  it("ispatçı ZK kopyasının cihaz imzalı yanıtını, oturum özetini ve kurum anahtarını alır; türü ZK kopyası", async () => {
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
      docType: ZK_COPY_VCT,
      namespace: NS,
      claims: [{ namespace: NS, element: "age_over_18", value: true }],
      circuits: [CIRCUIT],
    });
    expect(a.transcript).toEqual(dcApiSessionTranscript(ORIGIN, request.nonce, jwkThumbprint(encJwk)));
    expect(a.issuerKey).toEqual(issuerKey);
    expect(a.issuerX5chain[0]).toEqual(issuerDer);
    // ispatçının girdisi ZK kopyasının olağan DeviceResponse'u: yalnız ispatlanan öğe, cihaz imzası var (WL11)
    const dr = decode(a.deviceResponse) as Map<string, unknown>;
    const doc = (dr.get("documents") as Map<string, unknown>[])[0];
    expect(doc.get("docType")).toBe(ZK_COPY_VCT);
    const text = new TextDecoder("latin1").decode(a.deviceResponse);
    expect(text).toContain("age_over_18");
    expect(text).not.toContain("birth");
    expect(text).not.toContain("given_name");
    expect(b64uDecode(out.vpToken.age_zk[0])).toEqual(proof);
  });

  it("ispatçı yoksa ya da hata verirse belge gönderilmez: unsupported + detail.zk (ZK5); kopya yoksa no_zk_copy", async () => {
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
    const gone = {
      ...input,
      match: { ...match, credential: { ...credential, zk: { ...credential.zk!, copies: [] } } },
    };
    await expect(
      respond({ request, matches: [gone], keys, http, zk: async () => new Uint8Array([1]) }),
    ).rejects.toMatchObject({ code: "unsupported", detail: { zk: "no_zk_copy" } });
  });
});
