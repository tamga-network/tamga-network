/**
 * Uyum koşucusu — vektörleri okur, @tamga-network/* ile koşar, beklentiyle karşılaştırır.
 * Vektör yoksa (henüz üretilmemiş) testler atlanır; `npm run conformance:gen` ile üretilir.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTrustSet, ListTrustSource } from "@tamga-network/trust";
import { verifySdJwtVc } from "@tamga-network/sd-jwt";
import { pemToDer } from "@tamga-network/core";
import { run } from "../generate.js";

const V = resolve(dirname(fileURLToPath(import.meta.url)), "..", "vectors");
const trustPath = resolve(V, "trust", "basic.json");
const sdPath = resolve(V, "sd-jwt", "diploma-basic.json");

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
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.failedStep).toBe(n.expect_failed_step);
    });
  }
});
