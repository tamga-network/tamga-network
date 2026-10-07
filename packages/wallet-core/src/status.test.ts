/** ARF VCR_19: cüzdan kendi belgelerinin iptal durumunu status list'ten okur (dev PKI ile gerçek imzalı token). */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pemIssuerSigner } from "@tamga-network/sd-jwt";
import { StatusBitstring, StatusValue, signStatusListToken } from "@tamga-network/issuer";
import { pemToDer, sha256Hex } from "@tamga-network/core";
import type { TrustSource } from "@tamga-network/trust/core";
import { credentialStatusFrom, parseStatusToken, refreshCredentialStatuses } from "./status.js";
import { matchDcql } from "./oid4vp.js";
import type { StoredCredential, WalletState } from "./store.js";

const PKI = resolve(import.meta.dirname, "../../../ops/pki");
const have = existsSync(resolve(PKI, "issuer-bilgi-status.pkcs8.pem"));
const URI = "https://status.tamga.network/abc123";
const ISSUER = "0xissuer";

describe.skipIf(!have)("cüzdan: belge iptal durumu (VCR_19)", async () => {
  const certPem = readFileSync(resolve(PKI, "issuer-bilgi-status.cert.pem"), "utf8");
  const signer = await pemIssuerSigner(readFileSync(resolve(PKI, "issuer-bilgi-status.pkcs8.pem"), "utf8"), certPem);
  const fp = sha256Hex(pemToDer(certPem));
  const now = Math.floor(Date.now() / 1000);
  const bits = new StatusBitstring();
  bits.set(7, StatusValue.INVALID);
  bits.set(9, StatusValue.SUSPENDED);
  bits.set(11, 3 as StatusValue); // uygulamaya özgü değer
  const token = await signStatusListToken({
    signer,
    iss: "https://issuer.tamga.network/bilgi",
    uri: URI,
    bitstring: bits,
    iat: now,
    ttlSec: 3600,
  });
  const trust = (keys: string[]) =>
    ({
      issuer: () => ({
        delegate_keys: keys.map((k) => ({ purpose: "status_list", fingerprint_sha256: k, status: "ACTIVE" })),
      }),
    }) as unknown as TrustSource;
  const cred = (idx: number[]): StoredCredential => ({
    id: `c${idx.join("-")}`,
    vct: "urn:tamga:edu:StudentCredential:1",
    typeName: "S",
    issuer: "x",
    issuerId: ISSUER,
    leafFingerprint: "f",
    iat: now,
    statusUri: URI,
    claims: { is_enrolled: true },
    disclosureNames: [],
    copies: idx.map((i) => ({ keyRef: `k${i}`, cnf: {}, combined: "", idx: i, usedBy: [] })) as never,
    receivedAt: now,
  });

  it("imzalı listeden kopya bitleri okunur", () => {
    const list = parseStatusToken(token, URI, now);
    expect(credentialStatusFrom(cred([1, 2]), list, trust([fp]))).toBe("valid");
    expect(credentialStatusFrom(cred([1, 7]), list, trust([fp]))).toBe("revoked");
    expect(credentialStatusFrom(cred([9]), list, trust([fp]))).toBe("suspended");
    // 3: doğrulayıcı reddeder → cüzdan da "geçerli" göstermez (iptal sayılır)
    expect(credentialStatusFrom(cred([11]), list, trust([fp]))).toBe("revoked");
  });
  it("imzacı kurumun kayıtlı iptal anahtarı değilse sonuç yok (S11)", () => {
    const list = parseStatusToken(token, URI, now);
    expect(credentialStatusFrom(cred([7]), list, trust(["0".repeat(64)]))).toBe("unknown");
  });
  it("liste adresi uyuşmazsa ya da imza bozuksa reddedilir", () => {
    expect(() => parseStatusToken(token, "https://status.tamga.network/other", now)).toThrow(/sub/);
    const broken = token.slice(0, -4) + (token.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => parseStatusToken(broken, URI, now)).toThrow();
  });
  it("refresh: iptal edilen belge işaretlenir ve sunumda eşleşmez; ağ hatasında önceki sonuç korunur", async () => {
    const state = { credentials: [cred([1]), cred([7])] } as unknown as WalletState;
    const http = async () => ({ status: 200, text: async () => token });
    const next = await refreshCredentialStatuses(state, http, trust([fp]), now);
    expect(next.credentials.map((c) => c.status?.value)).toEqual(["valid", "revoked"]);
    const q = {
      credentials: [
        {
          id: "s",
          format: "dc+sd-jwt",
          meta: { vct_values: ["urn:tamga:edu:StudentCredential:1"] },
          claims: [{ path: ["is_enrolled"] }],
        },
      ],
    };
    const m = matchDcql(q, next.credentials);
    expect(m.matches[0].credential.id).toBe("c1");
    expect(m.matches[0].alternatives).toBeUndefined();
    const offline = async () => {
      throw new Error("offline");
    };
    const kept = await refreshCredentialStatuses(next, offline, trust([fp]), now);
    expect(kept.credentials[1].status?.value).toBe("revoked");
  });
});
