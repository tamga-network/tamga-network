import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto } from "node:crypto";
import {
  X509CertificateGenerator,
  cryptoProvider,
  KeyUsageFlags,
  KeyUsagesExtension,
  BasicConstraintsExtension,
} from "@peculiar/x509";
import { exportJWK, generateKeyPair, type JWK } from "jose";
import type { SigningKey } from "./issue.js";
import { computeIssuerId, b64u, b64uToUtf8 } from "@tamga-network/core";
import { decodeDisclosures } from "@tamga-network/core/sd-structure";
import {
  issueSdJwtVc,
  presentSdJwtVc,
  verifySdJwtVc,
  digestOf,
  splitCombined,
  makeDisclosure,
  type IssuerSigner,
} from "./index.js";
import { CompactSign } from "jose";

cryptoProvider.set(webcrypto as unknown as Crypto);
const crypto = webcrypto as unknown as Crypto;
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;

let rootDer: Uint8Array, signer: IssuerSigner, leafDer: Uint8Array, holder: { priv: SigningKey; jwk: JWK };
const NOW = 1790000000,
  AUD = "x509_san_dns:verify.tamga.network",
  NONCE = "n-123";

beforeAll(async () => {
  const rootKeys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const root = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=TR Root (test)",
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    keys: rootKeys,
    extensions: [new BasicConstraintsExtension(true, 1, true), new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true)],
  });
  const leafKeys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const leaf = await X509CertificateGenerator.create({
    serialNumber: "02",
    subject: "CN=Bilgi (test)",
    issuer: root.subject,
    notBefore: new Date(0),
    notAfter: new Date("2099-01-01"),
    signingAlgorithm: ALG,
    publicKey: leafKeys.publicKey,
    signingKey: rootKeys.privateKey,
    extensions: [new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true)],
  });
  rootDer = new Uint8Array(root.rawData);
  leafDer = new Uint8Array(leaf.rawData);
  signer = {
    x5c: [leafDer],
    sign: (h, p) => new CompactSign(p).setProtectedHeader(h as never).sign(leafKeys.privateKey),
  };
  const hk = await generateKeyPair("ES256");
  holder = { priv: hk.privateKey, jwk: await exportJWK(hk.publicKey) };
});

async function issueDiploma() {
  return issueSdJwtVc({
    signer,
    iss: "https://issuer.tamga.network/bilgi",
    vct: "urn:tamga:edu:DiplomaCredential:1",
    vctIntegrity: "sha256-r+Pdm2xQrKxuuX9WwXGwntrJ7PtDjCbZ5pysOj3u6KA=",
    iat: NOW - 1000,
    cnfJwk: holder.jwk,
    status: { status_list: { idx: 48213, uri: "https://status.tamga.network/3f9a" } },
    claims: {
      family_name: "Yılmaz",
      given_name: "Ayşe",
      birth_date: "2002-05-14",
      qualification_title: { "tr-TR": "Bilgisayar Mühendisliği Lisans" },
      eqf_level: 6,
      isced_f_code: "0613",
      awarding_date: "2026-06-20",
      is_graduate: true,
      grade: "3.41",
    },
    sdPolicy: {
      birth_date: "always",
      grade: "always",
      family_name: "always",
      given_name: "always",
      is_graduate: "allowed",
      eqf_level: "allowed",
    },
  });
}

describe("@tamga-network/sd-jwt — SPEC-CRED-0002", () => {
  it("ihraç: başlık/gövde kuralları (C1, C2, C5, C6, C7, C13, C16)", async () => {
    const out = await issueDiploma();
    const { jwt, disclosures, kb } = splitCombined(out.combined);
    expect(kb).toBe("");
    expect(disclosures.length).toBe(9);
    expect(out.payload._sd_alg).toBe("sha-256");
    expect([...(out.payload._sd as string[])].sort()).toEqual(out.payload._sd);
    expect((out.payload._sd as string[]).length).toBe(9); // decoy yok
    expect(out.payload.cnf).toBeTruthy();
    const header = JSON.parse(Buffer.from(jwt.split(".")[0], "base64url").toString());
    expect(header.typ).toBe("dc+sd-jwt");
    expect(header.alg).toBe("ES256");
    expect(header.x5c.length).toBe(1);
  });
  it("digest disclosure DİZESİNİN hash'idir; çözüp yeniden serileştirme farklı sonuç verir (C4/C14)", async () => {
    const out = await issueDiploma();
    const d = out.disclosures[0];
    expect(digestOf(d.disclosure)).toBe(d.digest);
    const re = b64u(JSON.stringify(JSON.parse(Buffer.from(d.disclosure, "base64url").toString()), null, 1));
    expect(digestOf(re)).not.toBe(d.digest);
  });
  it("sunum + doğrulama: seçili alanlar açılır, gizli alanlar görünmez, KB-JWT doğrulanır", async () => {
    const out = await issueDiploma();
    const pres = await presentSdJwtVc({
      combined: out.combined,
      discloseClaims: ["is_graduate", "eqf_level", "family_name", "given_name"],
      holderKey: holder.priv,
      aud: AUD,
      nonce: NONCE,
      iat: NOW,
    });
    const r = await verifySdJwtVc(pres, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW, rootCertsDer: [rootDer] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.disclosedClaimNames.sort()).toEqual(["eqf_level", "family_name", "given_name", "is_graduate"]);
    expect(r.claims.grade).toBeUndefined();
    expect(r.claims.birth_date).toBeUndefined();
    expect(r.issuerId).toBe(computeIssuerId("TR", leafDer));
    expect(r.checksPerformed).toEqual(["A1", "A2", "A3", "A4", "A5", "A6", "A7"]);
  });
  it("KB-JWT yoksa A1 RED (C8); yanlış nonce A6; aud uyuşmazlığı A6; iat penceresi A6 (C17)", async () => {
    const out = await issueDiploma();
    const noKb = await verifySdJwtVc(out.combined, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW });
    expect(noKb.ok).toBe(false);
    if (!noKb.ok) expect(noKb.failedStep).toBe("A1");
    const pres = await presentSdJwtVc({
      combined: out.combined,
      discloseClaims: ["is_graduate"],
      holderKey: holder.priv,
      aud: AUD,
      nonce: NONCE,
      iat: NOW,
    });
    const wn = await verifySdJwtVc(pres, { aud: AUD, nonce: "other", stateCode: "TR", now: NOW });
    expect(wn.ok).toBe(false);
    if (!wn.ok) expect(wn.failedStep).toBe("A6");
    const wa = await verifySdJwtVc(pres, { aud: "x509_san_dns:evil", nonce: NONCE, stateCode: "TR", now: NOW });
    expect(wa.ok).toBe(false);
    if (!wa.ok) expect(wa.failedStep).toBe("A6");
    const late = await verifySdJwtVc(pres, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW + 301 });
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.failedStep).toBe("A6");
  });
  it("kurcalanmış disclosure (değer değişti) → A5 RED (C10); ekran görüntüsü/kopya KB üretemez", async () => {
    const out = await issueDiploma();
    const pres = await presentSdJwtVc({
      combined: out.combined,
      discloseClaims: ["eqf_level"],
      holderKey: holder.priv,
      aud: AUD,
      nonce: NONCE,
      iat: NOW,
    });
    const { jwt, disclosures, kb } = splitCombined(pres);
    const [dec] = decodeDisclosures([disclosures[0]], digestOf, (d) => JSON.parse(b64uToUtf8(d)));
    const forged = b64u(JSON.stringify([dec.salt, dec.name, 8]));
    const tampered = [jwt, forged, ""].join("~") + kb;
    const r = await verifySdJwtVc(tampered, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failedStep).toBe("A5");
    // başka anahtarla KB üret → A6
    const other = await generateKeyPair("ES256");
    const pres2 = await presentSdJwtVc({
      combined: out.combined,
      discloseClaims: ["eqf_level"],
      holderKey: other.privateKey,
      aud: AUD,
      nonce: NONCE,
      iat: NOW,
    });
    const r2 = await verifySdJwtVc(pres2, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.failedStep).toBe("A6");
  });
  it("yanlış typ (vc+sd-jwt) varsayılan RED, bayrakla kabul (T2/§5.1.1); kök zinciri tutmuyorsa A3", async () => {
    const out = await issueDiploma();
    const pres = await presentSdJwtVc({
      combined: out.combined,
      discloseClaims: [],
      holderKey: holder.priv,
      aud: AUD,
      nonce: NONCE,
      iat: NOW,
    });
    const otherRootKeys = (await crypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
    const otherRoot = await X509CertificateGenerator.createSelfSigned({
      serialNumber: "09",
      name: "CN=Other Root",
      notBefore: new Date(0),
      notAfter: new Date("2099-01-01"),
      signingAlgorithm: ALG,
      keys: otherRootKeys,
    });
    const r = await verifySdJwtVc(pres, {
      aud: AUD,
      nonce: NONCE,
      stateCode: "TR",
      now: NOW,
      rootCertsDer: [new Uint8Array(otherRoot.rawData)],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failedStep).toBe("A3");
  });

  /** Kütüphanenin reddettiği biçimleri (başka bir ihraççının üretebileceği) elle kurar: payload + disclosure'lar, aynı imzacı. */
  async function craft(
    payload: Record<string, unknown>,
    disclosed: Array<[string, unknown]>,
    s: IssuerSigner = signer,
  ) {
    const ds = disclosed.map(([n, v]) => makeDisclosure(n, v));
    const body = { ...payload, _sd_alg: "sha-256", _sd: ds.map((d) => d.digest).sort() };
    const header = { alg: "ES256", typ: "dc+sd-jwt", x5c: s.x5c.map((d) => Buffer.from(d).toString("base64")) };
    const jwt = await s.sign(header, new TextEncoder().encode(JSON.stringify(body)));
    return [jwt, ...ds.map((d) => d.disclosure), ""].join("~");
  }
  const basePayload = () => ({
    iss: "https://issuer.tamga.network/bilgi",
    vct: "urn:tamga:edu:DiplomaCredential:1",
    "vct#integrity": "sha256-x",
    iat: NOW - 1000,
    cnf: { jwk: holder.jwk },
  });
  const present = (combined: string, discloseClaims: string[]) =>
    presentSdJwtVc({ combined, discloseClaims, holderKey: holder.priv, aud: AUD, nonce: NONCE, iat: NOW });
  const check = (pres: string) =>
    verifySdJwtVc(pres, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW, rootCertsDer: [rootDer] });

  it("seçici açıklanamaz adlar disclosure olarak gelirse A5 RED (status, cnf, __proto__ …)", async () => {
    for (const name of ["status", "__proto__", "_sd", "iat", "category"]) {
      const c = await craft(basePayload(), [
        [name, { x: 1 }],
        ["is_graduate", true],
      ]);
      const r = await check(await present(c, [name, "is_graduate"]));
      expect(r.ok, name).toBe(false);
      if (!r.ok) expect(r.failedStep, name).toBe("A5");
    }
  });
  it("iat yoksa A3; nbf gelecekteyse A7; sertifika iat anında geçersizse A3", async () => {
    const { iat: _iat, ...noIat } = basePayload();
    const r1 = await check(await present(await craft(noIat, [["is_graduate", true]]), ["is_graduate"]));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.failedStep).toBe("A3");
    const r2 = await check(
      await present(await craft({ ...basePayload(), nbf: NOW + 600 }, [["is_graduate", true]]), ["is_graduate"]),
    );
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.failedStep).toBe("A7");
    const r3 = await check(
      await present(await craft({ ...basePayload(), iat: -10 }, [["is_graduate", true]]), ["is_graduate"]),
    );
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.failedStep).toBe("A3");
    const ok = await check(await present(await craft(basePayload(), [["is_graduate", true]]), ["is_graduate"]));
    expect(ok.ok).toBe(true);
  });

  it("A7: süresi dolmuş belge (exp geçmiş) RED; adımlar A1–A6 tamamlanmış görünür (SPEC-API-0001)", async () => {
    const r = await check(
      await present(await craft({ ...basePayload(), exp: NOW - 1 }, [["is_graduate", true]]), ["is_graduate"]),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failedStep).toBe("A7");
    expect(r.reason).toMatch(/expired/);
    expect(r.checksPerformed).toEqual(["A1", "A2", "A3", "A4", "A5", "A6"]);
  });

  it("A3: gelecekteki iat (saat kayması payından fazla) ve nesne olmayan yük RED", async () => {
    const future = await check(
      await present(await craft({ ...basePayload(), iat: NOW + 3600 }, [["is_graduate", true]]), ["is_graduate"]),
    );
    expect(future.ok).toBe(false);
    if (!future.ok) expect(future.failedStep).toBe("A3");
    if (!future.ok) expect(future.reason).toMatch(/future/);
    // imzalı yük JSON dizisi: ayrıştırılır ama nesne değil
    const header = { alg: "ES256", typ: "dc+sd-jwt", x5c: signer.x5c.map((d) => Buffer.from(d).toString("base64")) };
    const jwt = await signer.sign(header, new TextEncoder().encode(JSON.stringify([1, 2])));
    const arr = await verifySdJwtVc(`${jwt}~`, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW, requireKb: false });
    expect(arr.ok).toBe(false);
    if (!arr.ok) expect(arr.failedStep).toBe("A3");
    if (!arr.ok) expect(arr.reason).toMatch(/not a JSON object/);
  });

  it("A1: birleşik biçimde boş ara parça (~~) RED", async () => {
    const out = await issueDiploma();
    const { jwt, disclosures } = splitCombined(out.combined);
    expect(() => splitCombined(`${jwt}~${disclosures[0]}~~`)).toThrow(/empty disclosure/);
    const r = await verifySdJwtVc(`${jwt}~~${disclosures[0]}~`, {
      aud: AUD,
      nonce: NONCE,
      stateCode: "TR",
      now: NOW,
      requireKb: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failedStep).toBe("A1");
  });

  describe("A3 ara CA denetimi (RFC 5280: cA, keyCertSign, pathLen, iat anında geçerlilik)", () => {
    type Cert = Awaited<ReturnType<typeof X509CertificateGenerator.create>>;
    type KC = { keys: CryptoKeyPair; cert: Cert };
    let root: KC;
    const gen = () => crypto.subtle.generateKey(ALG, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
    let serial = 100;
    const mk = async (
      name: string,
      parent: KC,
      exts: unknown[],
      validity: { from: Date; to: Date } = { from: new Date(0), to: new Date("2099-01-01") },
    ): Promise<KC> => {
      const keys = await gen();
      const cert = await X509CertificateGenerator.create({
        serialNumber: String(serial++),
        subject: `CN=${name}`,
        issuer: parent.cert.subject,
        notBefore: validity.from,
        notAfter: validity.to,
        signingAlgorithm: ALG,
        publicKey: keys.publicKey,
        signingKey: parent.keys.privateKey,
        extensions: exts as never,
      });
      return { keys, cert };
    };
    const CA = (pathLen?: number) => [
      new BasicConstraintsExtension(true, pathLen, true),
      new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true),
    ];
    const LEAF = [new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true)];
    beforeAll(async () => {
      const keys = await gen();
      const cert = await X509CertificateGenerator.createSelfSigned({
        serialNumber: "77",
        name: "CN=Chain Root (test)",
        notBefore: new Date(0),
        notAfter: new Date("2099-01-01"),
        signingAlgorithm: ALG,
        keys,
        extensions: CA(),
      });
      root = { keys, cert };
    });
    /** Yaprak + ara zinciriyle ihraç et, sun, kökle doğrula. */
    const run = async (leaf: KC, intermediates: KC[]) => {
      const s: IssuerSigner = {
        x5c: [leaf, ...intermediates].map((k) => new Uint8Array(k.cert.rawData)),
        sign: (h, p) => new CompactSign(p).setProtectedHeader(h as never).sign(leaf.keys.privateKey),
      };
      const c = await craft(basePayload(), [["is_graduate", true]], s);
      return verifySdJwtVc(await present(c, ["is_graduate"]), {
        aud: AUD,
        nonce: NONCE,
        stateCode: "TR",
        now: NOW,
        rootCertsDer: [new Uint8Array(root.cert.rawData)],
      });
    };
    it("geçerli ara CA kabul; CA olmayan, sertifika imzalayamayan, pathLen aşan ve iat anında geçersiz ara RED", async () => {
      const ica = await mk("ICA ok", root, CA(1));
      const good = await run(await mk("Leaf ok", ica, LEAF), [ica]);
      expect(good.ok).toBe(true);

      const notCa = await mk("ICA not CA", root, [new KeyUsagesExtension(KeyUsageFlags.keyCertSign, true)]);
      const r1 = await run(await mk("Leaf 1", notCa, LEAF), [notCa]);
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.reason).toMatch(/not a CA/);

      const noSign = await mk("ICA no sign", root, [
        new BasicConstraintsExtension(true, undefined, true),
        new KeyUsagesExtension(KeyUsageFlags.digitalSignature, true),
      ]);
      const r2 = await run(await mk("Leaf 2", noSign, LEAF), [noSign]);
      expect(r2.ok).toBe(false);
      if (!r2.ok) expect(r2.reason).toMatch(/keyCertSign/);

      const top0 = await mk("ICA pathLen 0", root, CA(0));
      const mid = await mk("ICA under pathLen 0", top0, CA());
      const r3 = await run(await mk("Leaf 3", mid, LEAF), [mid, top0]);
      expect(r3.ok).toBe(false);
      if (!r3.ok) expect(r3.reason).toMatch(/pathLen/);

      const late = await mk("ICA later", root, CA(), { from: new Date((NOW + 10) * 1000), to: new Date("2099-01-01") });
      const r4 = await run(await mk("Leaf 4", late, LEAF), [late]);
      expect(r4.ok).toBe(false);
      if (!r4.ok) expect(r4.failedStep).toBe("A3");
      if (!r4.ok) expect(r4.reason).toMatch(/intermediate not valid/);
    });
  });
});

describe("SPEC-CRED-0002 §3.4–§3.5: belge veren serileştirme sözleşmesi", () => {
  const hex = (h: string) => new Uint8Array(Buffer.from(h, "hex"));
  it("şartnamedeki gerçek değerler: virgül-boşluk ayracı + ASCII dışı karakter kaçışı → aynı disclosure ve digest", () => {
    const d = makeDisclosure("given_name", "Ayşe", hex("3af29c417b0ed5882691ff4ca307be52"));
    expect(b64uToUtf8(d.disclosure)).toBe('["OvKcQXsO1Ygmkf9Mowe-Ug", "given_name", "Ay\\u015fe"]');
    expect(d.disclosure).toBe("WyJPdktjUVhzTzFZZ21rZjlNb3dlLVVnIiwgImdpdmVuX25hbWUiLCAiQXlcdTAxNWZlIl0");
    expect(d.digest).toBe("nM_EESmLJt3b0fzNu1paGyiAfSLs4Npf2yEjUn0upSo");
  });
  it('iç içe nesne ve dizi: ": " / ", " ayraçları, ASCII dışı karakter kaçışlı; değer çözülünce aynı', () => {
    const v = { "tr-TR": "Bilgisayar Mühendisliği", list: [1, "ç"], ok: true, n: null };
    const d = makeDisclosure("t", v, hex("00112233445566778899aabbccddeeff"));
    const json = b64uToUtf8(d.disclosure);
    expect(json).toBe(
      '["ABEiM0RVZneImaq7zN3u_w", "t", {"tr-TR": "Bilgisayar M\\u00fchendisli\\u011fi", "list": [1, "\\u00e7"], "ok": true, "n": null}]',
    );
    expect(JSON.parse(json)[2]).toEqual(v);
  });
});

describe("ADR-0045 — dizi öğeleri ayrı ayrı açıklanır (RFC 9901 §4.2.2; AB PID `nationalities`)", () => {
  async function issueId() {
    return issueSdJwtVc({
      signer,
      iss: "https://id.tamga.network",
      vct: "urn:tamga:id:IdentityAttestation:1",
      vctIntegrity: "sha256-r+Pdm2xQrKxuuX9WwXGwntrJ7PtDjCbZ5pysOj3u6KA=",
      iat: NOW - 1000,
      cnfJwk: holder.jwk,
      claims: { given_name: "Ayşe", birthdate: "2002-05-14", nationalities: ["TR", "AZ"] },
      sdPolicy: { given_name: "always", birthdate: "always", nationalities: "always" },
      arrayElementSd: ["nationalities"],
    });
  }
  it("dizi öğeleri `[salt, değer]` disclosure'ı; dizide `{...: özet}`; kök `_sd` yalnız adlı claim'ler", async () => {
    const out = await issueId();
    expect(out.disclosures.length).toBe(5); // 3 ad + 2 öğe
    expect((out.payload._sd as string[]).length).toBe(3);
    const parent = out.disclosures.find((d) => d.name === "nationalities")!;
    const arr = parent.value as Array<{ "...": string }>;
    expect(arr.map((x) => x["..."])).toEqual(
      out.disclosures.filter((d) => /^nationalities\[\d\]$/.test(d.name)).map((d) => d.digest),
    );
    const el = JSON.parse(b64uToUtf8(out.disclosures.find((d) => d.name === "nationalities[0]")!.disclosure));
    expect(el).toHaveLength(2);
    expect(el[1]).toBe("TR");
  });
  it("sunumda `nationalities` istenirse dizi ve bütün öğeleri açılır; doğrulayıcı diziyi çözer", async () => {
    const out = await issueId();
    const pres = await presentSdJwtVc({
      combined: out.combined,
      discloseClaims: ["nationalities"],
      holderKey: holder.priv,
      aud: AUD,
      nonce: NONCE,
      iat: NOW,
    });
    const r = await verifySdJwtVc(pres, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW, rootCertsDer: [rootDer] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.claims.nationalities).toEqual(["TR", "AZ"]);
    expect(r.claims.birthdate).toBeUndefined();
    expect(r.claims.given_name).toBeUndefined();
  });
  it("yalnız bir öğe açılabilir (`nationalities[1]`); öteki öğe gizli kalır", async () => {
    const out = await issueId();
    const pres = await presentSdJwtVc({
      combined: out.combined,
      discloseClaims: ["nationalities[1]"],
      holderKey: holder.priv,
      aud: AUD,
      nonce: NONCE,
      iat: NOW,
    });
    const r = await verifySdJwtVc(pres, { aud: AUD, nonce: NONCE, stateCode: "TR", now: NOW, rootCertsDer: [rootDer] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.claims.nationalities).toEqual(["AZ"]);
  });
});
