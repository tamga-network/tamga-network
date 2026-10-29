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
  isPassKeyRef,
  makePassKeyProof,
  mintPassToken,
  newPassKeyRef,
  parsePassGrant,
  signJwt,
} from "@tamga-network/wallet-core";
import { pemRpSigner } from "./request.js";
import { PassRegistry, filePassStore, holderCnfOf, verifyPassKeyProof } from "./pass.js";
import { registerAccepted } from "./accepted.js";
import type { VerifyOutput } from "./verify.js";

/** Testte doğrulama hattının kabul çıktısı yerine: iç kayda işlenmiş ACCEPTED çıktısı (ADR-0056 K9). */
function acceptedOutput(presentation: string): VerifyOutput {
  const out = { result: { outcome: "ACCEPTED" }, claims: {} } as unknown as VerifyOutput;
  registerAccepted(out, { presentation, format: "dc+sd-jwt" });
  return out;
}

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
      verified: acceptedOutput(pres),
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
    // AP13/WL12: ileri tarihli jeton (saat kayması dışında) DUR; kayma içindeki GEÇ
    const future = await mintPassToken(grant, keys, nodeRandom, Math.floor(Date.now() / 1000) + 600);
    expect((await reg.verifyToken(future.token, { terminalGroup: "g1" })).reason).toMatch(/future/);
    const slight = await mintPassToken(grant, keys, nodeRandom, Math.floor(Date.now() / 1000) + 10);
    expect((await reg.verifyToken(slight.token, { terminalGroup: "g1" })).ok).toBe(true);
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
      verified: acceptedOutput(pres),
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
      verified: acceptedOutput(pres),
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

  it("a3/WL13: cüzdanın ayrı kart anahtarı (pass_key kanıtı) → kart o anahtara bağlanır; belge anahtarı DUR; bozuk kanıt reddedilir", async () => {
    const signer = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const reg = new PassRegistry(signer, undefined, "verify.tamga.network");
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const pres = await fakePresentation(keys, "holder");
    const passRef = newPassKeyRef(nodeRandom);
    expect(isPassKeyRef(passRef)).toBe(true);
    await keys.generate(passRef);
    const nonce = "n-123";
    const proof = await makePassKeyProof({ keys, ref: passRef, clientId: signer.clientId, nonce });
    const { record, jws } = await reg.issue({
      verified: acceptedOutput(pres),
      presentationId: "prs_pk",
      policy: { terminal_group: "g1", valid_days: 30 },
      passKey: { jws: proof, nonce },
    });
    expect(record.cnfKid).not.toBe(holderCnfOf(pres).kid);
    const grant = parsePassGrant(jws, { rpClientId: CLIENT, rpName: "Test", credentialId: "c1", keyRef: passRef });
    expect(
      (await reg.verifyToken((await mintPassToken(grant, keys, nodeRandom)).token, { terminalGroup: "g1" })).ok,
    ).toBe(true);
    // belge anahtarıyla imzalanmış jeton bu karta uymaz
    const withHolder = await mintPassToken({ ...grant, keyRef: "holder" }, keys, nodeRandom);
    expect((await reg.verifyToken(withHolder.token, { terminalGroup: "g1" })).ok).toBe(false);
    // yanlış nonce / aud → kanıt reddedilir (sunum kabulü ayrı; kart verilmez)
    await expect(
      reg.issue({
        verified: acceptedOutput(pres),
        presentationId: "prs_pk2",
        policy: { terminal_group: "g1", valid_days: 30 },
        passKey: { jws: proof, nonce: "other" },
      }),
    ).rejects.toThrow(/nonce/);
    // güvenlik turu 2026-10-19: boş beklenen nonce kabul edilmez
    await expect(verifyPassKeyProof(proof, { clientId: signer.clientId, nonce: "" })).rejects.toThrow(/expected/);
    const foreign = await makePassKeyProof({ keys, ref: passRef, clientId: "x509_hash:other", nonce });
    await expect(
      reg.issue({
        verified: acceptedOutput(pres),
        presentationId: "prs_pk3",
        policy: { terminal_group: "g1", valid_days: 30 },
        passKey: { jws: foreign, nonce },
      }),
    ).rejects.toThrow(/aud/);
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
      verified: acceptedOutput(pres),
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

describe("ADR-0056 K9: geçiş kartı yalnız doğrulama hattının KABUL çıktısından", () => {
  it("elle kurulmuş ya da kopyalanmış ACCEPTED, RED ve DOĞRULANAMADI çıktıları kart vermez", async () => {
    const signer = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const reg = new PassRegistry(signer);
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const pres = await fakePresentation(keys, "k-adr56");
    const policy = { terminal_group: "g1", valid_days: 1 };
    const forged = { result: { outcome: "ACCEPTED" }, claims: {} } as unknown as VerifyOutput;
    const genuine = acceptedOutput(pres);
    for (const verified of [
      forged,
      { ...genuine }, // kopya: kayıtta değil
      { ...genuine, result: { ...genuine.result, outcome: "REJECTED" } } as VerifyOutput,
      undefined as unknown as VerifyOutput,
    ])
      await expect(reg.issue({ verified, presentationId: "prs_x", policy })).rejects.toThrow(/only an ACCEPTED result/);
    // kayıtlı çıktının sonucu sonradan değiştirilirse de kart yok
    const mutated = acceptedOutput(pres);
    (mutated.result as { outcome: string }).outcome = "REJECTED";
    await expect(reg.issue({ verified: mutated, presentationId: "prs_y", policy })).rejects.toThrow(/only an ACCEPTED/);
    await expect(reg.issue({ verified: genuine, presentationId: "prs_z", policy })).resolves.toBeTruthy();
  });
  it("ADR-0069 TG3: kartın politikası kapı grubunun izinli politikalarında değilse jeton TÜKETİLMEDEN reddedilir", async () => {
    const signer = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const reg = new PassRegistry(signer, undefined, "verify.tamga.network");
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const pres = await fakePresentation(keys, "kp");
    const { record, jws } = await reg.issue({
      verified: acceptedOutput(pres),
      presentationId: "prs_pol",
      policy: { terminal_group: "gate", valid_days: 30, single_use: true, policy_id: "event-ticket" },
    });
    expect(record.policyId).toBe("event-ticket");
    const grant = parsePassGrant(jws, { rpClientId: CLIENT, rpName: "Kapı", credentialId: "tp", keyRef: "kp" });
    const t = await mintPassToken(grant, keys, nodeRandom);
    const seen: Array<string | undefined> = [];
    const denied = await reg.verifyToken(t.token, {
      terminalGroup: "gate",
      policyAllowed: (p) => (seen.push(p), p === "campus-access"),
    });
    expect(denied).toEqual({ ok: false, reason: "pass policy not allowed for this terminal group" });
    expect(seen).toEqual(["event-ticket"]);
    // reddedilen okuma bileti tüketmedi, jti de harcanmadı: aynı jeton izinli politikayla geçer
    const ok = await reg.verifyToken(t.token, { terminalGroup: "gate", policyAllowed: (p) => p === "event-ticket" });
    expect(ok.ok).toBe(true);
    expect(ok.consumed).toBe(true);
  });
  it("terminal saat kayması seçeneği en çok 600 sn", async () => {
    const signer = await pemRpSigner(
      readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
    );
    const reg = new PassRegistry(signer);
    await expect(reg.verifyToken("x.y.z", { terminalGroup: "g", maxClockSkewSec: 3600 })).rejects.toThrow(RangeError);
  });
});
