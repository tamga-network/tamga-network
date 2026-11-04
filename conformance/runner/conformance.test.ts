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
import { epochSeconds, pemToDer } from "@tamga-network/core";
import { encKid, responseKidOf } from "@tamga-network/verifier";
import { declineRequest } from "@tamga-network/wallet-core";
import { run } from "../generate.js";
import {
  jweHeaderOnly,
  runKbAudCase,
  runScenario,
  type EncKidCase,
  type KbAudCase,
  type KidCase,
  type ResponseScenario,
} from "../openid4vp.js";

const V = resolve(dirname(fileURLToPath(import.meta.url)), "..", "vectors");
const trustPath = resolve(V, "trust", "basic.json");
const sdPath = resolve(V, "sd-jwt", "diploma-basic.json");
const idPath = resolve(V, "sd-jwt", "identity-pid-names.json");
const slPath = resolve(V, "status-list", "jwt-cwt.json");
const ovPath = resolve(V, "openid4vp", "basic.json");

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
  const now = () => epochSeconds(Math.floor(new Date(vec.now).getTime() / 1000));
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
        now: epochSeconds(now() + (n.now_offset_sec ?? 0)),
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
      now: epochSeconds(Math.floor(new Date(vec.now).getTime() / 1000)),
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
  const now = () => epochSeconds(Math.floor(new Date(vec.now).getTime() / 1000));
  it("taslağın bits = 1 örneği: sıkıştırılmış lst açılır", () => {
    const bs = StatusBitstring.fromCompressed(Buffer.from(vec.draft_example.lst_compressed_hex, "hex"), 100_000, 1);
    expect(Buffer.from(bs.bytes).toString("hex")).toBe(vec.draft_example.bytes_hex);
  });
  for (const l of vec?.lists ?? []) {
    it(`${l.name}: JWT ve CWT gösterimleri aynı bitleri, imzacıyı ve zamanları taşır`, async () => {
      // ADR-0056 K6: imzacı vektörün beklenen parmak iziyle sabitlenir
      const pin = { expectedSignerFingerprints: [l.expect.signer_fingerprint_sha256] };
      const a = await verifyStatusListToken(l.jwt.token, l.jwt.uri, now(), pin);
      const b = await verifyStatusListCwt(Buffer.from(l.cwt.hex, "hex"), l.cwt.uri, now(), pin);
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
        const t = epochSeconds(now() + n.now_offset_sec);
        const re = new RegExp(`^${n.expect}:`);
        const pin = {
          expectedSignerFingerprints: [n.expected_signer_fingerprint_sha256 ?? l.expect.signer_fingerprint_sha256],
        };
        await expect(verifyStatusListToken(l.jwt.token, n.uri ?? l.jwt.uri, t, pin)).rejects.toThrow(re);
        await expect(verifyStatusListCwt(Buffer.from(l.cwt.hex, "hex"), n.uri ?? l.cwt.uri, t, pin)).rejects.toThrow(
          re,
        );
      });
    }
  }
});

describe.skipIf(!existsSync(ovPath))("conformance: openid4vp/basic (PV7, ADR-0067)", () => {
  const vec = existsSync(ovPath) ? JSON.parse(readFileSync(ovPath, "utf8")) : null;
  const now = () => Math.floor(new Date(vec.now).getTime() / 1000);
  for (const c of (vec?.kb_aud.cases ?? []) as KbAudCase[]) {
    it(`KB-JWT aud — ${c.name}`, async () => {
      expect(await runKbAudCase(c, { policy: vec.kb_aud.policy, rootCertPem: vec.root_cert_pem, now: now() })).toEqual(
        c.expect,
      );
      // beklenen aud yola göre: DC API'de `origin:` + köken, cihazlar arası yolda client identifier (PV7)
      if (c.expected_kb_aud !== null)
        expect(c.expected_kb_aud).toBe(c.path === "dc_api" ? `origin:${c.verifier.origin}` : vec.client_id);
    });
  }
  for (const s of (vec?.responses.scenarios ?? []) as ResponseScenario[]) {
    it(`yanıtlar — ${s.name}`, async () => {
      const r = await runScenario(
        {
          presentationId: vec.presentation_id,
          expiresAt: vec.expires_at,
          now: now(),
          responseUri: vec.response_uri,
          branches: vec.responses.branches,
          dcApi: vec.responses.dc_api,
        },
        s,
      );
      expect(r.events).toEqual(s.events.map((e) => e.expect));
      expect(r.final).toEqual(s.expect_final);
    });
  }
  it("cüzdanın şifresiz reddi: yalnız error=access_denied ve state, response_uri'ye; DC API yolunda POST yok", async () => {
    const calls: Array<{ url: string; body?: string; method?: string }> = [];
    const http = async (url: string, init?: { method?: string; body?: string }) => {
      calls.push({ url, body: init?.body, method: init?.method });
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    };
    const d = vec.responses.wallet_decline;
    await declineRequest({ responseUri: vec.response_uri, state: d.state }, http as never);
    expect(calls).toEqual([{ url: vec.response_uri, method: "POST", body: d.expect_body }]);
    const dc = await declineRequest(
      { responseUri: vec.response_uri, state: d.state, origin: vec.responses.dc_api.expected_origins[0] },
      http as never,
    );
    expect(dc.status).toBe(0);
    expect(calls).toHaveLength(1);
  });
  it("dal kid'i: responseKidOf ve encKid", () => {
    for (const c of vec.kid_naming.response_kid_cases as KidCase[])
      expect(responseKidOf(jweHeaderOnly(c.kid))).toEqual(c.expect);
    for (const c of vec.kid_naming.enc_kid_cases as EncKidCase[])
      expect(encKid(c.presentation_id, c.path, c.branch_id)).toBe(c.expect);
    for (const b of vec.responses.branches) {
      expect(b.kid).toBe(encKid(vec.presentation_id, "cross_device", b.branch_id));
      expect(b.enc_public_jwk.kid).toBe(b.kid);
    }
    expect(vec.responses.dc_api.kid).toBe(encKid(vec.presentation_id, "dc_api"));
  });
});
