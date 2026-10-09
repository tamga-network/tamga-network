/**
 * OpenID4VCI 1.0 §8.3.1.2: credential ucu `invalid_nonce` dönerse cüzdan nonce ucundan yeni c_nonce alır, proof'ları yeniden
 * imzalar ve bir kez daha dener. Anahtarlar ve anahtar kanıtı (KA) yeniden üretilmez; ikinci `invalid_nonce` hata olarak döner.
 */
import { describe, it, expect } from "vitest";
import { obtainCredential } from "./oid4vci.js";
import { SoftwareKeyProvider, MemoryKeyStore } from "./keys.js";
import type { IssuerMetadata } from "./oid4vci.js";

const md = {
  credential_issuer: "https://i",
  credential_endpoint: "https://i/credential",
  nonce_endpoint: "https://i/nonce",
  credential_configurations_supported: { v: { format: "dc+sd-jwt", vct: "v" } },
} as unknown as IssuerMetadata;

const payloadOf = (jwt: string) =>
  JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")) as { nonce: string };
const headerOf = (jwt: string) =>
  JSON.parse(Buffer.from(jwt.split(".")[0], "base64url").toString("utf8")) as { key_attestation?: string };

function fakeIssuer(rejectNonces: number, copies: number) {
  let issued = 0;
  let rejected = 0;
  const seen: string[][] = [];
  const http = async (url: string, init?: { body?: string }) => {
    if (url === "https://i/nonce")
      return { status: 200, text: async () => JSON.stringify({ c_nonce: `n${++issued}` }) };
    const proofs = (JSON.parse(init?.body ?? "{}") as { proofs: { jwt: string[] } }).proofs.jwt;
    seen.push(proofs);
    if (rejected < rejectNonces) {
      rejected++;
      return {
        status: 400,
        text: async () => JSON.stringify({ error: "invalid_nonce", error_description: "c_nonce expired" }),
      };
    }
    return {
      status: 200,
      text: async () =>
        JSON.stringify({ credentials: Array.from({ length: copies }, (_, i) => ({ credential: `c${i}` })) }),
    };
  };
  return { http, seen };
}

describe("obtainCredential: invalid_nonce → yeni c_nonce ile tek yeniden deneme", () => {
  it("kopya başına proof: ikinci istek yeni nonce'la yeniden imzalı, aynı anahtarlar; belge alınır", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const { http, seen } = fakeIssuer(1, 2);
    const out = await obtainCredential({
      issuer: "https://i",
      vct: "v",
      metadata: md,
      accessToken: "a",
      keys,
      http,
      batch: 2,
    });
    expect(out.copies.map((c) => c.combined)).toEqual(["c0", "c1"]);
    expect(seen).toHaveLength(2);
    expect(seen[0].map((j) => payloadOf(j).nonce)).toEqual(["n1", "n1"]);
    expect(seen[1].map((j) => payloadOf(j).nonce)).toEqual(["n2", "n2"]);
    for (const c of out.copies) expect(await keys.publicKey(c.keyRef)).not.toBeNull();
  });

  it("anahtar kanıtlı (KA) proof: KA bir kez alınır, proof yeni nonce'la yeniden imzalanır", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const { http, seen } = fakeIssuer(1, 3);
    let kaCalls = 0;
    const out = await obtainCredential({
      issuer: "https://i",
      vct: "v",
      metadata: md,
      accessToken: "a",
      keys,
      http,
      batch: 3,
      keyAttestor: async () => `ka${++kaCalls}`,
    });
    expect(kaCalls).toBe(1);
    expect(out.copies).toHaveLength(3);
    expect(seen.map((p) => p.length)).toEqual([1, 1]);
    expect(payloadOf(seen[1][0]).nonce).toBe("n2");
    expect(headerOf(seen[1][0]).key_attestation).toBe("ka1");
  });

  it("ikinci invalid_nonce: yeniden deneme yok, hata; üretilen anahtarlar silinir", async () => {
    const store = new MemoryKeyStore();
    const keys = new SoftwareKeyProvider(store);
    const { http, seen } = fakeIssuer(2, 1);
    await expect(
      obtainCredential({
        issuer: "https://i",
        vct: "v",
        metadata: md,
        accessToken: "a",
        keys,
        http,
        batch: 1,
        keyRefPrefix: "x",
      }),
    ).rejects.toMatchObject({ code: "issuer_error" });
    expect(seen).toHaveLength(2);
    expect(await keys.publicKey("x.0")).toBeNull();
  });
});
