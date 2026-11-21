/**
 * ADR-0093 (D-TRUST-9) — birden çok ülke listesi:
 *  UL1 kurum kimliği sertifikadan ve kurumun ülkesinden (`resolveIssuerId`); iki ülkede aynı sertifika → belirsiz
 *  UL2 isteğe bağlı liste eksik / imzası tutmuyor / bayat / geri sarılmış → yalnız o ülke UNKNOWN; kendi listesi zorunlu
 *  Yalıtım: bir liste başka listenin kurum, kök CA, doğrulayıcı ya da şema kimliğini taşıyamaz
 */
import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider, KeyUsageFlags, KeyUsagesExtension } from "@peculiar/x509";
import { CompactSign, importPKCS8 } from "jose";
import {
  loadTrustSet,
  ListTrustSource,
  TrustStore,
  computeCaId,
  computeIssuerId,
  computeSchemaId,
  utf8,
  TL_TYP,
  certFingerprintSha256Hex,
  fetchListTrustSource,
  resetListMonotonicity,
  verifyJws,
  type NationalList,
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
  const sign = (obj: unknown) =>
    new CompactSign(utf8(JSON.stringify(obj))).setProtectedHeader({ alg: "ES256", typ: TL_TYP, x5c: [b64] }).sign(key);
  return { der, fp: certFingerprintSha256Hex(der), sign };
}
type Cert = Awaited<ReturnType<typeof mkCert>>;

const T0 = "2026-01-01T00:00:00Z";
const NOW = new Date("2026-09-24T12:00:00Z");
const NEXT = "2026-12-24T00:00:00Z";
const IAT = Math.floor(new Date("2026-03-01T00:00:00Z").getTime() / 1000);
const VCT = "urn:tamga:edu:DiplomaCredential:1";
const SCHEMA = computeSchemaId(VCT);
const op = (cc: string) => ({ name: "Tamga", status: "provisional", on_behalf_of: `${cc} representative (TEST)` });
const STATES = ["TR", "AZ", "KZ"] as const;
type CC = (typeof STATES)[number];

let lotlSigner: Cert;
const signer = {} as Record<CC, Cert>;
const root = {} as Record<CC, Cert>;
const inst = {} as Record<CC, Cert>;
let shared: Cert; // iki ülkenin listesinde aynı sertifika (belirsizlik testi)

function rootCa(cc: string, r: Cert) {
  return {
    ca_id: computeCaId(cc, r.der),
    legal_name: `${cc} Root`,
    cert_fingerprint_sha256: r.fp,
    service_type: "http://uri.etsi.org/TrstSvc/Svctype/CA/PKC",
    operator: op(cc),
    status: "ACTIVE",
    valid_from: T0,
    valid_until: "2036-01-01T00:00:00Z",
    successor_ca_id: null,
    status_history: [{ status: "ACTIVE", since: T0 }],
  };
}
function issuer(cc: string, cert: Cert, r: Cert, slug: string, idOverride?: string) {
  return {
    issuer_id: idOverride ?? computeIssuerId(cc, cert.der),
    slug,
    legal_name: slug,
    category: "EDUCATION",
    assurance: "I2",
    class: "EAA",
    parent_ca_id: computeCaId(cc, r.der),
    cert_fingerprint_sha256: cert.fp,
    issuer_url: `https://issuer.example/${slug}`,
    status_list_base: `https://status.example/${slug}/`,
    status: "ACTIVE",
    valid_from: T0,
    valid_until: "2028-01-01T00:00:00Z",
    successor_id: null,
    status_history: [{ status: "ACTIVE", since: T0 }],
    schema_authorizations: [{ schema_id: SCHEMA, allowed: true, valid_from: T0, valid_until: null }],
  };
}
function tl(cc: CC, o: { version?: number; next?: string; issuers?: unknown[]; schemas?: unknown[] } = {}) {
  return {
    list_format_version: "1.0",
    list_type: "trusted_list",
    state_code: cc,
    version: o.version ?? 1,
    issued_at: T0,
    next_update: o.next ?? NEXT,
    previous_version_hash: null,
    operator: op(cc),
    root_cas: [rootCa(cc, root[cc])],
    issuers: o.issuers ?? [issuer(cc, inst[cc], root[cc], `uni-${cc.toLowerCase()}`)],
    relying_parties: [],
    national_schemas: o.schemas ?? [],
  };
}
function lotl(version = 1) {
  return {
    list_format_version: "1.0",
    list_type: "lotl",
    version,
    issued_at: T0,
    next_update: NEXT,
    previous_version_hash: null,
    operator: { name: "Tamga", status: "provisional", on_behalf_of: "consortium" },
    anchor_signing_keys: [{ fingerprint_sha256: lotlSigner.fp, status: "ACTIVE" }],
    national_lists: STATES.map((cc) => ({
      state_code: cc,
      status: "ACTIVE",
      list_url: `https://trust.example/tl-${cc.toLowerCase()}.jws`,
      signing_keys: [{ fingerprint_sha256: signer[cc].fp, status: "ACTIVE" }],
      recognition: { mode: "unilateral", recognizes: [...STATES] },
    })),
    schemas: [
      {
        schema_id: SCHEMA,
        vct: VCT,
        metadata_url: "https://schemas.example/metadata.json",
        content_hash: "sha256-AAAA",
        layer: "NETWORK",
        status: "ACTIVE",
        registered_at: T0,
        status_history: [{ status: "ACTIVE", since: T0 }],
      },
    ],
    wallet_providers: [],
    pid_providers: [],
  };
}

async function lists(over: Partial<Record<CC, unknown>> = {}, signers: Partial<Record<CC, Cert>> = {}) {
  const out: Record<string, string> = {};
  for (const cc of STATES) {
    const body = over[cc] === undefined ? tl(cc) : over[cc];
    if (body === null) continue;
    out[cc] = await (signers[cc] ?? signer[cc]).sign(body);
  }
  return out;
}
async function load(
  nationalListJws: Record<string, string>,
  extra: { requiredStates?: string[]; now?: Date } = { requiredStates: ["TR"] },
) {
  const { store, report } = await loadTrustSet({
    lotlJws: await lotlSigner.sign(lotl()),
    nationalListJws,
    anchorsJsonl: "",
    rootFingerprints: [lotlSigner.fp],
    now: extra.now ?? NOW,
    skipAnchors: true,
    versionMemory: "none",
    ...(extra.requiredStates ? { requiredStates: extra.requiredStates } : {}),
  });
  return { store, report, ts: new ListTrustSource(store, () => extra.now ?? NOW) };
}

beforeAll(async () => {
  lotlSigner = await mkCert("LOTL Signer");
  for (const cc of STATES) {
    signer[cc] = await mkCert(`TL Signer ${cc}`);
    root[cc] = await mkCert(`Root ${cc}`);
    inst[cc] = await mkCert(`University ${cc}`);
  }
  shared = await mkCert("Shared");
});

describe("ADR-0093 UL1 — kurum kimliği kurumun ülkesiyle", () => {
  it("her kurum kendi ülkesinin kimliğiyle bulunur; Türk doğrulayıcı tanıdığı Kazak kurumunu kabul eder", async () => {
    const { ts, report } = await load(await lists());
    expect(report.healthy).toBe(true);
    for (const cc of STATES) {
      const r = ts.resolveIssuerId(inst[cc].fp);
      expect(r).toEqual({ kind: "found", issuerId: computeIssuerId(cc, inst[cc].der), stateCode: cc });
    }
    const kz = computeIssuerId("KZ", inst.KZ.der);
    expect(ts.isCredentialAcceptable(kz, IAT)).toBe("YES");
    expect(ts.isCredentialSchemaAcceptable(kz, SCHEMA, IAT)).toBe("YES");
    expect(ts.isRecognizedBy("TR", kz)).toBe("YES");
    // eski (hatalı) türetme: doğrulayıcının ülkesiyle hesaplanan kimlik listede yok
    expect(ts.isCredentialAcceptable(computeIssuerId("TR", inst.KZ.der), IAT)).toBe("NO");
    expect(ts.unavailableStates()).toEqual([]);
  });

  it("başka listedeki kurum sertifikasını kopyalayan isteğe bağlı liste yüklenmez (TR kurumu RED'e düşürülemez); kayıtsız → none", async () => {
    const tr = tl("TR", { issuers: [issuer("TR", inst.TR, root.TR, "uni-tr"), issuer("TR", shared, root.TR, "s-tr")] });
    const az = tl("AZ", { issuers: [issuer("AZ", inst.AZ, root.AZ, "uni-az"), issuer("AZ", shared, root.AZ, "s-az")] });
    const { ts, report } = await load(await lists({ TR: tr, AZ: az }));
    expect(report.healthy).toBe(true);
    expect(report.warnings.some((w) => /tl-az: .*issuer certificate/.test(w))).toBe(true);
    expect(ts.resolveIssuerId(shared.fp)).toEqual({
      kind: "found",
      issuerId: computeIssuerId("TR", shared.der),
      stateCode: "TR",
    });
    expect(ts.unavailableStates()).toEqual(["AZ"]);
    expect(ts.resolveIssuerId(lotlSigner.fp)).toEqual({ kind: "none", unavailableStates: ["AZ"] });
    // depo düzeyinde iki listede eşleşme olsaydı (savunma): belirsiz
    const store = new TrustStore();
    store.national.set("TR", { list: tr as unknown as NationalList, raw: "" });
    store.national.set("AZ", { list: az as unknown as NationalList, raw: "" });
    store.setFreshness({ source: "list", healthy: true, lotlVersion: 1, anchorsSeq: 0, loadedAt: NOW });
    expect(new ListTrustSource(store, () => NOW).resolveIssuerId(shared.fp)).toEqual({
      kind: "ambiguous",
      stateCodes: ["AZ", "TR"],
    });
  });
});

describe("ADR-0093 UL2 — isteğe bağlı listeler yalnız kendi ülkesini etkiler", () => {
  it("KZ listesi verilmedi → kaynak sağlıklı, KZ kullanılamaz; kayıtsız sertifika için 'none' + KZ (bilinmiyor)", async () => {
    const { ts, report, store } = await load(await lists({ KZ: null }));
    expect(report.healthy).toBe(true);
    expect(store.national.has("KZ")).toBe(false);
    expect(ts.unavailableStates()).toEqual(["KZ"]);
    expect(ts.isCredentialAcceptable(computeIssuerId("TR", inst.TR.der), IAT)).toBe("YES");
    expect(ts.resolveIssuerId(inst.KZ.fp)).toEqual({ kind: "none", unavailableStates: ["KZ"] });
  });

  it("AZ listesinin imzası LOTL'daki imzacıya ait değil → AZ yüklenmez, ötekiler etkilenmez", async () => {
    const { ts, report } = await load(await lists({}, { AZ: signer.KZ }));
    expect(report.healthy).toBe(true);
    expect(report.warnings.some((w) => w.startsWith("tl-az:"))).toBe(true);
    expect(ts.unavailableStates()).toEqual(["AZ"]);
    expect(ts.resolveIssuerId(inst.AZ.fp).kind).toBe("none");
    expect(ts.isCredentialAcceptable(computeIssuerId("KZ", inst.KZ.der), IAT)).toBe("YES");
  });

  it("AZ listesi bayat → AZ kurumlarına dair sorular UNKNOWN, TR ve KZ YES; genel tazelik bozulmaz", async () => {
    const { ts, report } = await load(await lists({ AZ: tl("AZ", { next: "2026-09-01T00:00:00Z" }) }));
    expect(report.healthy).toBe(true);
    const az = computeIssuerId("AZ", inst.AZ.der);
    // bayat listenin kaydı karar vermez: eşleşme yok + AZ kullanılamaz → doğrulayıcıda INDETERMINATE
    expect(ts.resolveIssuerId(inst.AZ.fp)).toEqual({ kind: "none", unavailableStates: ["AZ"] });
    expect(ts.isCredentialAcceptable(az, IAT)).toBe("UNKNOWN");
    expect(ts.isIssuerSuspended(az)).toBe("UNKNOWN");
    expect(ts.isCredentialSchemaAcceptable(az, SCHEMA, IAT)).toBe("UNKNOWN");
    expect(ts.isRecognizedBy("TR", az)).toBe("UNKNOWN");
    expect(ts.issuer(az)).toBeNull();
    expect(ts.unavailableStates()).toEqual(["AZ"]);
    expect(ts.isCredentialAcceptable(computeIssuerId("TR", inst.TR.der), IAT)).toBe("YES");
    expect(ts.freshness().healthy).toBe(true);
  });

  it("isteğe bağlı liste sorgu anında bayatlarsa yalnız o ülke UNKNOWN olur", async () => {
    const { store } = await load(await lists({ KZ: tl("KZ", { next: "2026-10-01T00:00:00Z" }) }));
    const later = new ListTrustSource(store, () => new Date("2026-10-15T00:00:00Z"));
    expect(later.isCredentialAcceptable(computeIssuerId("KZ", inst.KZ.der), IAT)).toBe("UNKNOWN");
    expect(later.isCredentialAcceptable(computeIssuerId("TR", inst.TR.der), IAT)).toBe("YES");
  });

  it("kendi listesi zorunlu: TR eksik → sağlıksız; TR'nin imzası tutmazsa yükleme durur", async () => {
    const missing = await load(await lists({ TR: null }));
    expect(missing.report.healthy).toBe(false);
    expect(missing.ts.isCredentialAcceptable(computeIssuerId("AZ", inst.AZ.der), IAT)).toBe("UNKNOWN");
    await expect(load(await lists({}, { TR: signer.AZ }))).rejects.toThrow();
  });

  it("requiredStates verilmezse bugünkü davranış: her beklenen liste zorunlu", async () => {
    const { report } = await load(await lists({ KZ: null }), {});
    expect(report.healthy).toBe(false);
  });
});

describe("ADR-0093 yalıtım — bir liste başka listenin kaydını ezemez", () => {
  it("AZ listesi TR kurumunun kimliğini taşıyor → AZ yüklenmez (kimlik ülkeyle türetilmemiş); TR cevapları değişmez", async () => {
    const trId = computeIssuerId("TR", inst.TR.der);
    const evil = tl("AZ", {
      issuers: [{ ...issuer("AZ", inst.TR, root.AZ, "uni-tr", trId), status: "SUSPENDED" }],
    });
    const { ts, report } = await load(await lists({ AZ: evil }));
    expect(report.warnings.some((w) => /tl-az: .*SPEC-ID-0002/.test(w))).toBe(true);
    expect(ts.unavailableStates()).toEqual(["AZ"]);
    expect(ts.isCredentialAcceptable(trId, IAT)).toBe("YES");
    expect(ts.isIssuerSuspended(trId)).toBe("NO");
    expect(ts.isRecognizedBy("TR", trId)).toBe("YES");
  });

  it("AZ listesi LOTL şemasını gölgelemeye çalışıyor → AZ yüklenmez; şema LOTL'daki gibi kalır", async () => {
    const shadow = { ...lotl().schemas[0], content_hash: "sha256-EVIL", layer: "NATIONAL" };
    const { ts, report } = await load(await lists({ AZ: tl("AZ", { schemas: [shadow] }) }));
    expect(report.warnings.some((w) => /tl-az: .*schema/.test(w))).toBe(true);
    expect(ts.schemaContentHash(SCHEMA)).toBe("sha256-AAAA");
  });

  it("depo düzeyi: aynı kurum, kök CA ya da doğrulayıcı istemci kimliği iki listede → ikinci liste uygulanmaz", () => {
    const base = { root_cas: [], issuers: [], relying_parties: [], national_schemas: [] };
    const store = new TrustStore();
    store.applyNationalList(
      { ...base, state_code: "TR", issuers: [{ issuer_id: "0x01" }] } as unknown as NationalList,
      "",
    );
    expect(() =>
      store.applyNationalList(
        { ...base, state_code: "AZ", issuers: [{ issuer_id: "0x01" }] } as unknown as NationalList,
        "",
      ),
    ).toThrow(/issuer 0x01 already listed by TR/);
    store.applyNationalList(
      { ...base, state_code: "KZ", root_cas: [{ ca_id: "0xca" }] } as unknown as NationalList,
      "",
    );
    expect(() =>
      store.applyNationalList(
        { ...base, state_code: "UZ", root_cas: [{ ca_id: "0xca" }] } as unknown as NationalList,
        "",
      ),
    ).toThrow(/root CA 0xca already listed by KZ/);
    expect(store.national.has("AZ")).toBe(false);
    expect(store.issuer_states.get("0x01")).toBe("TR");
  });
});

describe("ADR-0093 K2 — HTTP'den bütün etkin listeler", () => {
  async function site(files: Record<string, string>) {
    return async (url: string) => {
      const name = url.replace("https://trust.example/", "");
      const body = files[name];
      return { status: body === undefined ? 404 : 200, text: async () => body ?? "" };
    };
  }
  async function files(over: Partial<Record<CC, unknown>> = {}, lotlVersion = 1) {
    const l = await lists(over);
    const out: Record<string, string> = { "lotl.jws": await lotlSigner.sign(lotl(lotlVersion)) };
    for (const [cc, jws] of Object.entries(l)) out[`tl-${cc.toLowerCase()}.jws`] = jws;
    return out;
  }
  const fetchAll = async (f: Record<string, string>) =>
    fetchListTrustSource("https://trust.example", await site(f), {
      rootFingerprints: [lotlSigner.fp],
      verifyJws,
      stateCode: "TR",
      nationalLists: "all-active",
      now: NOW,
      versionMemory: "none",
    });

  it("bütün etkin listeler yüklenir; KZ dosyası yoksa yalnız KZ kullanılamaz", async () => {
    resetListMonotonicity();
    const all = await fetchAll(await files());
    expect([...all.store.national.keys()].sort()).toEqual(["AZ", "KZ", "TR"]);
    const noKz = await fetchAll(await files({ KZ: null }));
    expect([...noKz.store.national.keys()].sort()).toEqual(["AZ", "TR"]);
    expect(noKz.source.unavailableStates()).toEqual(["KZ"]);
    expect(noKz.source.resolveIssuerId(inst.AZ.fp).kind).toBe("found");
  });

  it("kendi listesi yoksa yükleme reddedilir", async () => {
    resetListMonotonicity();
    await expect(fetchAll(await files({ TR: null }))).rejects.toThrow();
  });

  it("isteğe bağlı listenin geri sarılması yalnız o ülkeyi kullanılamaz yapar (oturum içi)", async () => {
    resetListMonotonicity();
    await fetchAll(await files({ AZ: tl("AZ", { version: 5 }) }));
    const again = await fetchAll(await files({ AZ: tl("AZ", { version: 4 }) }));
    expect(again.source.unavailableStates()).toEqual(["AZ"]);
    expect(again.source.isCredentialAcceptable(computeIssuerId("AZ", inst.AZ.der), IAT)).toBe("UNKNOWN");
    expect(again.source.isCredentialAcceptable(computeIssuerId("TR", inst.TR.der), IAT)).toBe("YES");
  });
});

describe("ADR-0093 inceleme düzeltmeleri — isteğe bağlı listenin sınırları", () => {
  const rp = {
    rp_id: "rp-x",
    client_id: "x509_hash:" + "A".repeat(43),
    dns_name: "verify.example",
    legal_name: "Uydurma Doğrulayıcı (TEST)",
    access_cert_fingerprint_sha256: "a".repeat(64),
    status: "ACTIVE",
    registered_at: T0,
    scopes: [],
    status_history: [{ status: "ACTIVE", since: T0 }],
  };
  it("K3: kayıt makamı rolü etkin olmayan isteğe bağlı liste doğrulayıcı taşırsa yüklenmez; doğrulayıcı görünmez", async () => {
    const az = { ...tl("AZ"), relying_parties: [rp] };
    const { ts, report } = await load(await lists({ AZ: az }));
    expect(report.healthy).toBe(true);
    expect(report.warnings.some((w) => /tl-az: .*registrar role/.test(w))).toBe(true);
    expect(ts.unavailableStates()).toEqual(["AZ"]);
    expect(ts.relyingPartyByDnsName("verify.example")).toBeNull();
    expect(ts.relyingParty(rp.client_id)).toBeNull();
  });
  it("isteğe bağlı listedeki kurum yalnız kendi listesinin köküne bağlanır", async () => {
    const az = tl("AZ", { issuers: [issuer("AZ", inst.AZ, root.TR, "uni-az")] });
    const { ts, report } = await load(await lists({ AZ: az }));
    expect(report.warnings.some((w) => /tl-az: .*parent CA/.test(w))).toBe(true);
    expect(ts.resolveIssuerId(inst.AZ.fp)).toEqual({ kind: "none", unavailableStates: ["AZ"] });
  });
  it("zorunlu liste LOTL'da etkin değil ya da yüklenmemişse kaynak sağlıksız; boş zorunlu küme reddedilir", async () => {
    const { report } = await load(await lists(), { requiredStates: ["UZ"] });
    expect(report.healthy).toBe(false);
    expect(report.warnings).toContain("required national list tl-uz not loaded");
    await expect(load(await lists(), { requiredStates: [] })).rejects.toThrow(/at least one state/);
  });
  it("kullanılamayan ülkenin kurumları dizinde görünmez", async () => {
    const { ts } = await load(await lists({ AZ: tl("AZ", { next: "2026-09-01T00:00:00Z" }) }));
    const ids = ts.issuers().map((i) => i.issuer_id);
    expect(ids).toContain(computeIssuerId("TR", inst.TR.der));
    expect(ids).not.toContain(computeIssuerId("AZ", inst.AZ.der));
  });
});
