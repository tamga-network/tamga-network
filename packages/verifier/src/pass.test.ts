/**
 * Geçiş kartı (ADR-0012 B; WL12–WL14, AP13): grant ihracı → jeton → doğrulama; tekrar, süre, yanlış grup, yanlış anahtar;
 * dosya deposu (kayıtlar + tekrar listesi yeniden başlatmada korunur).
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { pemToDer, x509HashClientId } from "@tamga-network/core";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolve } from "node:path";
import {
  MemoryKeyStore,
  SoftwareKeyProvider,
  mintPassToken,
  parsePassGrant,
  signJwt,
} from "@tamga-network/wallet-core";
import { pemRpSigner } from "./request.js";
import { PassRegistry, filePassStore, holderCnfOf } from "./pass.js";

const PKI = resolve(__dirname, "../../../ops/pki");
const CLIENT = existsSync(resolve(PKI, "rp-verify.cert.pem"))
  ? x509HashClientId(pemToDer(readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8")))
  : ""; // ADR-0034: x509_hash
const nodeRandom = (n: number) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
  return b;
};

/** Sunum yerine geçen sahte SD-JWT: yalnızca cnf.jwk okunur (holderCnfOf). */
async function fakePresentation(keys: SoftwareKeyProvider, ref: string) {
  const jwk = await keys.generate(ref);
  const jwt = await signJwt({ typ: "dc+sd-jwt" }, { cnf: { jwk } }, keys, ref);
  return jwt + "~";
}

describe("PassRegistry (ADR-0012 B)", () => {
  it("ihraç → jeton GEÇ; tekrar DUR; süresi dolmuş DUR; yanlış grup DUR; başka anahtar DUR; jeton ≤ 400 bayt ve kişisel veri yok", async () => {
    const signer = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const reg = new PassRegistry(signer, undefined, "verify.tamga.network"); // ADR-0034: aud = kalıcı alan adı
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const pres = await fakePresentation(keys, "k1");
    const { record, jws } = await reg.issue({
      presentation: pres,
      presentationId: "prs_test",
      policy: { terminal_group: "g1", valid_days: 30 },
    });
    expect(record.cnfKid).toBe(holderCnfOf(pres).kid);

    const grant = parsePassGrant(jws, { rpClientId: CLIENT, rpName: "Test", credentialId: "c1", keyRef: "k1" });
    expect(grant.passId).toBe(record.passId);
    const t1 = await mintPassToken(grant, keys, nodeRandom);
    expect(t1.token.length).toBeLessThanOrEqual(400);
    const payload = JSON.parse(Buffer.from(t1.token.split(".")[1], "base64url").toString("utf8"));
    expect(Object.keys(payload).sort()).toEqual(["aud", "exp", "iat", "iss", "jti"]); // WL12

    expect((await reg.verifyToken(t1.token, { terminalGroup: "g1" })).ok).toBe(true);
    expect((await reg.verifyToken(t1.token, { terminalGroup: "g1" })).reason).toMatch(/replay/);
    const old = await mintPassToken(grant, keys, nodeRandom, Math.floor(Date.now() / 1000) - 120);
    expect((await reg.verifyToken(old.token, { terminalGroup: "g1" })).reason).toMatch(/expired/);
    const t2 = await mintPassToken(grant, keys, nodeRandom);
    expect((await reg.verifyToken(t2.token, { terminalGroup: "g2" })).reason).toMatch(/terminal group/);

    const other = new SoftwareKeyProvider(new MemoryKeyStore());
    await other.generate("thief");
    const forged = await mintPassToken({ ...grant, keyRef: "thief" }, other, nodeRandom);
    expect((await reg.verifyToken(forged.token, { terminalGroup: "g1" })).reason).toMatch(/signature/);
  });

  it("D10 tek kullanım (single_use): ilk GEÇ kartı tüketir (consumed), sonraki her jeton DUR — bilet kullanıldı", async () => {
    const signer = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const reg = new PassRegistry(signer, undefined, "verify.tamga.network"); // ADR-0034: aud = kalıcı alan adı
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const pres = await fakePresentation(keys, "kt");
    const { record, jws } = await reg.issue({
      presentation: pres,
      presentationId: "prs_ticket",
      policy: { terminal_group: "gate", valid_days: 400, single_use: true },
    });
    expect(record.singleUse).toBe(true);
    const grant = parsePassGrant(jws, { rpClientId: CLIENT, rpName: "Kapı", credentialId: "tk", keyRef: "kt" });
    expect(grant.singleUse).toBe(true);
    // 1. okuma: GEÇ + tüketildi
    const first = await reg.verifyToken((await mintPassToken(grant, keys, nodeRandom)).token, {
      terminalGroup: "gate",
    });
    expect(first.ok).toBe(true);
    expect(first.consumed).toBe(true);
    // aynı jeton tekrar VE yeni jeton: ikisi de DUR (consumedAt jti tekrarından önce bakılır)
    const t2 = await mintPassToken(grant, keys, nodeRandom);
    const again = await reg.verifyToken(t2.token, { terminalGroup: "gate" });
    expect(again.ok).toBe(false);
    expect(again.reason).toMatch(/already used/);
  });

  it("tek kullanımlık bilet iki kapıda EŞZAMANLI okunursa yalnızca biri geçer (yarış yok)", async () => {
    const signer = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const reg = new PassRegistry(signer, undefined, "verify.tamga.network"); // ADR-0034: aud = kalıcı alan adı
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const pres = await fakePresentation(keys, "kr");
    const { jws } = await reg.issue({
      presentation: pres,
      presentationId: "prs_race",
      policy: { terminal_group: "gate", valid_days: 400, single_use: true },
    });
    const grant = parsePassGrant(jws, { rpClientId: CLIENT, rpName: "Kapı", credentialId: "tk", keyRef: "kr" });
    const a = (await mintPassToken(grant, keys, nodeRandom)).token;
    const b = (await mintPassToken(grant, keys, nodeRandom)).token;
    const results = await Promise.all([
      reg.verifyToken(a, { terminalGroup: "gate" }),
      reg.verifyToken(b, { terminalGroup: "gate" }),
    ]);
    expect(results.filter((r) => r.ok).length).toBe(1);
  });

  it("dosya deposu: kayıtlar ve tekrar listesi yeniden başlatmada korunur", async () => {
    const signer = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const file = join(mkdtempSync(join(tmpdir(), "tamga-pass-")), "passes.json");
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const pres = await fakePresentation(keys, "k2");
    const reg1 = new PassRegistry(signer, filePassStore(file), "verify.tamga.network");
    const { jws } = await reg1.issue({
      presentation: pres,
      presentationId: "prs_p",
      policy: { terminal_group: "g1", valid_days: 1 },
    });
    const grant = parsePassGrant(jws, { rpClientId: CLIENT, rpName: "Test", credentialId: "c2", keyRef: "k2" });
    const t = await mintPassToken(grant, keys, nodeRandom);
    expect((await reg1.verifyToken(t.token, { terminalGroup: "g1" })).ok).toBe(true);

    const reg2 = new PassRegistry(signer, filePassStore(file), "verify.tamga.network"); // "yeniden başlatma"
    expect(reg2.list().map((r) => r.passId)).toEqual([grant.passId]);
    expect((await reg2.verifyToken(t.token, { terminalGroup: "g1" })).reason).toMatch(/replay/); // K3: liste korunur
    const t2 = await mintPassToken(grant, keys, nodeRandom);
    expect((await reg2.verifyToken(t2.token, { terminalGroup: "g1" })).ok).toBe(true);
  });
});
