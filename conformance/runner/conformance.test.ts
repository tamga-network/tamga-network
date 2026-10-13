/**
 * Uyum koşucusu — vektörleri okur, @tamga-network/* ile koşar, beklentiyle karşılaştırır.
 * Vektör yoksa (henüz üretilmemiş) testler atlanır; `npm run conformance:gen` ile üretilir.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTrustSet, ListTrustSource } from "@tamga-network/trust";
import { StatusBitstring, verifySdJwtVc, verifyStatusListCwt, verifyStatusListToken } from "@tamga-network/sd-jwt";
import { pemToDer } from "@tamga-network/core";
import { run } from "../generate.js";

const V = resolve(dirname(fileURLToPath(import.meta.url)), "..", "vectors");
const trustPath = resolve(V, "trust", "basic.json");
const sdPath = resolve(V, "sd-jwt", "diploma-basic.json");
const idPath = resolve(V, "sd-jwt", "identity-pid-names.json");
const slPath = resolve(V, "status-list", "jwt-cwt.json");

describe.skipIf(!existsSync(trustPath))("conformance: trust/basic", () => {
  const vec = existsSync(trustPath) ? JSON.parse(readFileSync(trustPath, "utf8")) : null;
  it("liste seti yüklenir, rapor beklentiyle aynı", async () => {
    const { report } = await loadTrustSet({
      lotlJws: vec.input.lotl_jws,
      nationalListJws: vec.input.national_lists_jws,
      anchorsJsonl: vec.input.anchors_jsonl,
      rootFingerprints: vec.input.root_fingerprints,
      now: new Date(vec.now),
      ...({ anchorMaxAgeMs: vec.input.anchor_max_age_ms } as object),
    });
    expect(report.healthy).toBe(vec.expect_report.healthy);
    expect(report.lotlVersion).toBe(vec.expect_report.lotlVersion);
  });
  for (const c of vec?.cases ?? []) {
    it(`${c.q.op}: ${c.name} → ${JSON.stringify(c.expect)}`, async () => {
      const { store } = await loadTrustSet({
        lotlJws: vec.input.lotl_jws,
        nationalListJws: vec.input.national_lists_jws,
        anchorsJsonl: vec.input.anchors_jsonl,
        rootFingerprints: vec.input.root_fingerprints,
        now: new Date(vec.now),
        ...({ anchorMaxAgeMs: vec.input.anchor_max_age_ms } as object),
      });
      const ts = new ListTrustSource(store, () => new Date(vec.now));
      expect(run(ts, c.q)).toEqual(c.expect);
    });
  }
});

describe.skipIf(!existsSync(sdPath))("conformance: sd-jwt/diploma-basic", () => {
  const vec = existsSync(sdPath) ? JSON.parse(readFileSync(sdPath, "utf8")) : null;
  const now = () => Math.floor(new Date(vec.now).getTime() / 1000);
  it("olumlu: sunum doğrulanır, açılan/gizli alanlar beklentiyle aynı", async () => {
    const r = await verifySdJwtVc(vec.presentation, {
      aud: vec.aud,
      nonce: vec.nonce,
      stateCode: vec.state_code,
      now: now(),
      rootCertsDer: [pemToDer(vec.root_cert_pem)],
      acceptLegacyVcSdJwtTyp: false, // Tamga türü: yalnız dc+sd-jwt (C13)
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.issuerId).toBe(vec.expect.issuer_id);
    expect([...r.disclosedClaimNames].sort()).toEqual(vec.expect.disclosed_claim_names);
    for (const h of vec.expect.hidden_claims) expect(r.claims[h]).toBeUndefined();
    expect(r.vct).toBe(vec.expect.vct);
    expect(r.checksPerformed).toEqual(vec.expect.checks);
  });
  for (const n of vec?.negative ?? []) {
    it(`olumsuz: ${n.name} → ${n.expect_failed_step}`, async () => {
      const r = await verifySdJwtVc(n.input, {
        aud: vec.aud,
        nonce: n.nonce ?? vec.nonce,
        stateCode: vec.state_code,
        now: now() + (n.now_offset_sec ?? 0),
        rootCertsDer: [pemToDer(vec.root_cert_pem)],
        acceptLegacyVcSdJwtTyp: false, // Tamga türü: yalnız dc+sd-jwt (C13)
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.failedStep).toBe(n.expect_failed_step);
    });
  }
});

describe.skipIf(!existsSync(idPath))("conformance: sd-jwt/identity-pid-names (ADR-0045)", () => {
  const vec = existsSync(idPath) ? JSON.parse(readFileSync(idPath, "utf8")) : null;
  it("AB PID adları: birthdate + nationalities dizisinin tek öğesi açılır; eski adlar yok", async () => {
    const r = await verifySdJwtVc(vec.presentation, {
      aud: vec.aud,
      nonce: vec.nonce,
      stateCode: vec.state_code,
      now: Math.floor(new Date(vec.now).getTime() / 1000),
      rootCertsDer: [pemToDer(vec.root_cert_pem)],
      acceptLegacyVcSdJwtTyp: false, // Tamga türü: yalnız dc+sd-jwt (C13)
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.issuerId).toBe(vec.expect.issuer_id);
    expect(r.vct).toBe(vec.expect.vct);
    expect([...r.disclosedClaimNames].sort()).toEqual(vec.expect.disclosed_claim_names);
    for (const [k, v] of Object.entries(vec.expect.claims)) expect(r.claims[k]).toEqual(v);
    for (const h of vec.expect.hidden_claims) expect(r.claims[h]).toBeUndefined();
  });
});

describe.skipIf(!existsSync(slPath))("conformance: status-list/jwt-cwt (ADR-0048)", () => {
  const vec = existsSync(slPath) ? JSON.parse(readFileSync(slPath, "utf8")) : null;
  const now = () => Math.floor(new Date(vec.now).getTime() / 1000);
  it("taslağın bits = 1 örneği: sıkıştırılmış lst açılır", () => {
    const bs = StatusBitstring.fromCompressed(Buffer.from(vec.draft_example.lst_compressed_hex, "hex"), 100_000, 1);
    expect(Buffer.from(bs.bytes).toString("hex")).toBe(vec.draft_example.bytes_hex);
  });
  for (const l of vec?.lists ?? []) {
    it(`${l.name}: JWT ve CWT gösterimleri aynı bitleri, imzacıyı ve zamanları taşır`, async () => {
      const a = await verifyStatusListToken(l.jwt.token, l.jwt.uri, now());
      const b = await verifyStatusListCwt(Buffer.from(l.cwt.hex, "hex"), l.cwt.uri, now());
      for (const t of [a, b]) {
        expect(t.payload.status_list.bits).toBe(l.bits);
        expect(t.leafFingerprintHex).toBe(l.expect.signer_fingerprint_sha256);
        expect([t.payload.iat, t.payload.exp, t.payload.ttl]).toEqual([l.expect.iat, l.expect.exp, l.expect.ttl]);
        for (const [i, v] of Object.entries(l.expect.values)) expect(t.bitstring.get(Number(i))).toBe(v);
      }
      expect(a.contentHash).toBe(l.jwt.content_hash);
      expect(b.contentHash).toBe(l.cwt.content_hash);
    });
    for (const n of l.negative) {
      it(`${l.name}: olumsuz — ${n.name} → ${n.expect}`, async () => {
        const t = now() + n.now_offset_sec;
        const re = new RegExp(`^${n.expect}:`);
        await expect(verifyStatusListToken(l.jwt.token, n.uri ?? l.jwt.uri, t)).rejects.toThrow(re);
        await expect(verifyStatusListCwt(Buffer.from(l.cwt.hex, "hex"), n.uri ?? l.cwt.uri, t)).rejects.toThrow(re);
      });
    }
  }
});
