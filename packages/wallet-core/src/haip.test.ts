/**
 * HAIP 1.0 açıkları (BACKLOG HAIP-1): cüzdan tarafının sunucu doğrulamasıyla birlikte çalıştığını kanıtlar.
 *  (a) RFC 9207 iss · (b) DPoP-Nonce: sunucu nonce isterse cüzdan bir kez yeniden dener; yanıttaki nonce sonraki kanıta eklenir ·
 *  (d) yanıt şifrelemesi A128GCM + A256GCM · (e) DCQL trusted_authorities (aki).
 */
import { describe, it, expect } from "vitest";
import { DpopNonces, DpopReplayCache, verifyDpop } from "@tamga-network/issuer";
import { MemoryKeyStore, SoftwareKeyProvider } from "./keys.js";
import { dpopRequest, newDpopSigner } from "./dpop.js";
import { completeAuthorized, parseCallback, type AuthStart } from "./authcode.js";
import type { Http } from "./http.js";
import { chooseEnc, encryptJwe } from "./jwe.js";
import { b64u, utf8 } from "./b64.js";
import { RESPONSE_ENC, decryptResponse } from "@tamga-network/verifier";
import { exportJWK, generateKeyPair } from "jose";
import { webcrypto } from "node:crypto";
import {
  AuthorityKeyIdentifierExtension,
  BasicConstraintsExtension,
  SubjectKeyIdentifierExtension,
  X509CertificateGenerator,
  cryptoProvider,
} from "@peculiar/x509";
import { akiTrustedAuthority, dcqlFromPolicy } from "@tamga-network/verifier";
import { certAuthorityKeyId } from "./asn1.js";
import { matchDcql } from "./oid4vp.js";

const now = 1_800_000_000;
const URL_TOKEN = "https://id.tamga.network/token";

/** Nonce zorunlu tutan sahte token ucu (issuer paketinin gerçek doğrulayıcısıyla). */
function nonceServer(status: 400 | 401) {
  const nonces = new DpopNonces();
  const replay = new DpopReplayCache();
  const seen: Array<{ nonceSent: boolean; pop?: string }> = [];
  const http: Http = async (url, init) => {
    const proof = init?.headers?.dpop;
    const payload = JSON.parse(Buffer.from(String(proof).split(".")[1], "base64url").toString()) as { nonce?: string };
    seen.push({ nonceSent: !!payload.nonce, pop: init?.headers?.["oauth-client-attestation-pop"] });
    const d = await verifyDpop(proof, { htm: "POST", htu: url, now, replay, nonces });
    const headers = { "dpop-nonce": nonces.current(now) };
    if (!d.ok && d.useNonce)
      return status === 400
        ? { status, headers, text: async () => JSON.stringify({ error: "use_dpop_nonce" }) }
        : {
            status,
            headers: { ...headers, "www-authenticate": 'DPoP error="use_dpop_nonce"' },
            text: async () => "",
          };
    if (!d.ok) return { status: 400, text: async () => JSON.stringify({ error: "invalid_dpop_proof" }) };
    return { status: 200, headers, text: async () => JSON.stringify({ access_token: "t" }) };
  };
  return { http, seen };
}

describe("HAIP-1 (b) DPoP-Nonce", () => {
  for (const status of [400, 401] as const)
    it(`sunucu nonce isterse (${status}) cüzdan bir kez nonce ile yeniden dener ve başarılı olur`, async () => {
      const keys = new SoftwareKeyProvider(new MemoryKeyStore());
      const signer = await newDpopSigner(keys, "dpop.t");
      const { http, seen } = nonceServer(status);
      let n = 0;
      const r = await dpopRequest(
        http,
        signer,
        URL_TOKEN,
        { method: "POST", headers: async () => ({ "oauth-client-attestation-pop": `pop-${++n}` }), body: "x=1" },
        { now },
      );
      expect(r.status).toBe(200);
      expect(await r.text()).toContain("access_token");
      expect(seen.map((s) => s.nonceSent)).toEqual([false, true]);
      // tek kullanımlık başlıklar her denemede yeniden üretilir
      expect(seen.map((s) => s.pop)).toEqual(["pop-1", "pop-2"]);
      // saklanan nonce sonraki istekte ilk denemede kullanılır (ek gidiş-dönüş yok)
      await dpopRequest(http, signer, URL_TOKEN, { method: "POST", body: "x=2" }, { now });
      expect(seen.at(-1)?.nonceSent).toBe(true);
      expect(seen).toHaveLength(3);
    });

  it("nonce istemeyen sunucuda tek istek; başka hata yeniden denenmez", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const signer = await newDpopSigner(keys, "dpop.u");
    let calls = 0;
    const http: Http = async () => {
      calls++;
      return {
        status: 400,
        headers: { "dpop-nonce": "n" },
        text: async () => JSON.stringify({ error: "invalid_grant" }),
      };
    };
    const r = await dpopRequest(http, signer, URL_TOKEN, { method: "POST" }, { now });
    expect(r.status).toBe(400);
    expect(calls).toBe(1);
  });
});

describe("HAIP-1 (a) RFC 9207 iss", () => {
  const start = (issSupported: boolean) =>
    ({
      issuer: "https://issuer.tamga.network/bilgi",
      vct: "urn:tamga:edu:Diploma:1",
      redirectUri: "tamga-wallet://cb",
      state: "st",
      pkce: { verifier: "v", challenge: "c" },
      requestUri: "urn:x",
      authorizeUrl: "https://issuer.tamga.network/bilgi/authorize",
      metadata: {} as never,
      as: {
        issuer: "https://issuer.tamga.network/bilgi",
        token_endpoint: "https://issuer.tamga.network/bilgi/token",
        authorization_response_iss_parameter_supported: issSupported,
      },
    }) as AuthStart;
  const run = (url: string, issSupported = true) =>
    completeAuthorized({
      start: start(issSupported),
      callbackUrl: url,
      keys: new SoftwareKeyProvider(new MemoryKeyStore()),
      http: async () => {
        throw new Error("ağa çıkılmamalı");
      },
      wua: {} as never,
      randomBytes: (n) => new Uint8Array(n),
    });

  it("parseCallback iss'i okur", () => {
    expect(parseCallback("tamga-wallet://cb?code=c&state=st&iss=https%3A%2F%2Fa").iss).toBe("https://a");
  });
  it("başka sunucunun iss'i ya da eksik iss (sunucu ilan ettiyse) ağa çıkmadan reddedilir", async () => {
    await expect(run("tamga-wallet://cb?code=c&state=st&iss=https%3A%2F%2Fevil.example")).rejects.toThrow(/iss/);
    await expect(run("tamga-wallet://cb?code=c&state=st")).rejects.toThrow(/iss/);
    // hata yanıtında da denetlenir
    await expect(run("tamga-wallet://cb?error=access_denied&state=st&iss=https%3A%2F%2Fevil.example")).rejects.toThrow(
      /iss/,
    );
  });
  it("doğru iss denetimi geçer (sonraki adımlar bu testte sahte olduğu için başka bir hatayla durur)", async () => {
    const e = await run("tamga-wallet://cb?code=c&state=st&iss=https%3A%2F%2Fissuer.tamga.network%2Fbilgi").catch(
      (x: Error) => x,
    );
    expect(String((e as Error).message)).not.toMatch(/iss does not match/);
    // sunucu iss ilan etmiyor ve yanıtta iss yoksa denetim atlanır (eski issuer'larla uyum)
    const e2 = await run("tamga-wallet://cb?code=c&state=st", false).catch((x: Error) => x);
    expect(String((e2 as Error).message)).not.toMatch(/iss does not match/);
  });
});

describe("HAIP-1 (d) A128GCM + A256GCM", () => {
  it("chooseEnc: ilan yoksa A128GCM, A256GCM varsa o, ikisi de yoksa null", () => {
    expect(chooseEnc(undefined)).toBe("A128GCM");
    expect(chooseEnc(["A128GCM"])).toBe("A128GCM");
    expect(chooseEnc(["A128GCM", "A256GCM"])).toBe("A256GCM");
    expect(chooseEnc(["A192GCM"])).toBeNull();
    expect(chooseEnc("A256GCM")).toBeNull();
  });
  it("doğrulayıcı ikisini de ilan eder ve cüzdanın iki şifrelemesini de çözer", async () => {
    expect(RESPONSE_ENC).toEqual(["A128GCM", "A256GCM"]);
    const { publicKey, privateKey } = await generateKeyPair("ECDH-ES", { crv: "P-256", extractable: true });
    const pub = { ...(await exportJWK(publicKey)), use: "enc" } as never;
    for (const enc of ["A128GCM", "A256GCM"] as const) {
      const jwe = encryptJwe(utf8(JSON.stringify({ vp_token: { q: ["x"] }, state: "s" })), pub, { enc });
      expect(JSON.parse(Buffer.from(jwe.split(".")[0], "base64url").toString()).enc).toBe(enc);
      const out = await decryptResponse(jwe, privateKey);
      expect(out).toEqual({ vp_token: { q: ["x"] }, state: "s" });
    }
  });
});

describe("HAIP-1 (e) DCQL trusted_authorities (aki)", () => {
  cryptoProvider.set(webcrypto as unknown as Crypto);
  const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
  const kp = () => webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
  async function ca(name: string) {
    const k = await kp();
    const cert = await X509CertificateGenerator.createSelfSigned({
      serialNumber: "01",
      name: `CN=${name}`,
      signingAlgorithm: ALG,
      keys: k,
      extensions: [
        new BasicConstraintsExtension(true, 0, true),
        await SubjectKeyIdentifierExtension.create(k.publicKey),
      ],
    });
    return { cert, key: k };
  }
  async function leaf(issuer: Awaited<ReturnType<typeof ca>>, withAki: boolean) {
    const k = await kp();
    return X509CertificateGenerator.create({
      serialNumber: "02",
      subject: "CN=Issuer",
      issuer: issuer.cert.subject,
      signingAlgorithm: ALG,
      publicKey: k.publicKey,
      signingKey: issuer.key.privateKey,
      extensions: withAki ? [await AuthorityKeyIdentifierExtension.create(issuer.cert.publicKey)] : [],
    });
  }
  const cred = (leafDer: ArrayBuffer) => {
    const hdr = Buffer.from(JSON.stringify({ alg: "ES256", x5c: [Buffer.from(leafDer).toString("base64")] })).toString(
      "base64url",
    );
    return {
      id: "c1",
      vct: "urn:tamga:edu:Diploma:1",
      claims: { degree: "BSc" },
      copies: [{ combined: `${hdr}.e30.sig~`, keyRef: "k" }],
    } as never;
  };
  const query = (ta?: Array<{ type: string; values: string[] }>) => ({
    credentials: [
      {
        id: "q",
        format: "dc+sd-jwt",
        meta: { vct_values: ["urn:tamga:edu:Diploma:1"] },
        claims: [{ path: ["degree"] }],
        ...(ta ? { trusted_authorities: ta } : {}),
      },
    ],
  });

  it("doğrulayıcının CA SKI'sinden ürettiği aki, o CA'nın imzaladığı belgeyi seçer; başka CA'nınki eler", async () => {
    const good = await ca("Good Root");
    const other = await ca("Other Root");
    const l = await leaf(good, true);
    expect(b64u(certAuthorityKeyId(new Uint8Array(l.rawData))!)).toBe(
      akiTrustedAuthority([new Uint8Array(good.cert.rawData)])!.values[0],
    );
    const c = cred(l.rawData);
    const ta = akiTrustedAuthority([new Uint8Array(good.cert.rawData)])!;
    expect(matchDcql(query([ta]), [c]).matches).toHaveLength(1);
    const bad = akiTrustedAuthority([new Uint8Array(other.cert.rawData)])!;
    expect(matchDcql(query([bad]), [c]).unmatched).toEqual(["q"]);
    // sorguda trusted_authorities yoksa etkisiz
    expect(matchDcql(query(), [c]).matches).toHaveLength(1);
    // değerlendiremediği bir tip de varsa belge elenmez
    expect(matchDcql(query([bad, { type: "etsi_tl", values: ["https://lotl.example"] }]), [c]).matches).toHaveLength(1);
  });
  it("AKI'siz sertifikalı belge aki sorgusuna uymaz (OpenID4VP §6.1.1.1)", async () => {
    const good = await ca("Good Root");
    const l = await leaf(good, false);
    expect(certAuthorityKeyId(new Uint8Array(l.rawData))).toBeNull();
    const ta = akiTrustedAuthority([new Uint8Array(good.cert.rawData)])!;
    expect(matchDcql(query([ta]), [cred(l.rawData)]).unmatched).toEqual(["q"]);
  });
  it("politikadaki trusted_authorities DCQL sorgusuna taşınır", () => {
    const ta = { type: "aki" as const, values: ["abc"] };
    const d = dcqlFromPolicy({
      policy_id: "p",
      purpose: {},
      credentials: [{ id: "q", vct_values: ["urn:x:1"], required_claims: ["a"], trusted_authorities: [ta] }],
      trust: { min_issuer_assurance: "I1", allowed_categories: [], require_recognition: false, state_code: "TR" },
      freshness: { max_status_token_age_sec: 1, max_trust_age_sec: 1 },
    });
    expect(d.credentials[0].trusted_authorities).toEqual([ta]);
  });
});
