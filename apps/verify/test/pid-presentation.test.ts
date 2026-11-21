/**
 * ADR-0094 K7 — PID ile seçenek senaryosu gerçek istek yolundan: Sikke Bank (kurgusal doğrulayıcı) kendi erişim sertifikasıyla
 * `bank-account-opening-pid` sunumunu açar (sandbox doğrulayıcısı aracı) → cüzdan çekirdeği istek nesnesini doğrular, DCQL ile
 * cüzdandaki AB PID'i bulur (iç içe `address`, öğe öğe `nationalities`), asıl RP'yi denetler (`checkRp`) ve yanıt verir →
 * doğrulayıcı iptal listesini doğrulama anında sağlayıcı listesindeki iptal sunucusundan çeker → ACCEPTED, kurum ülkesi TR.
 * İptal edilmiş PID RED (D).
 */
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRpAssertion, pemRpSigner } from "@tamga-network/verifier";
import {
  issueSdJwtVc,
  pemIssuerSigner,
  signStatusListToken,
  StatusBitstring,
  MIN_CAPACITY,
  StatusValue,
} from "@tamga-network/sd-jwt";
import {
  checkRp,
  matchDcql,
  newState,
  parseVpUri,
  receiveCredentials,
  respond,
  rpRecordOf,
  verifyRequestObject,
  SoftwareKeyProvider,
  MemoryKeyStore,
  type Http,
  type RpRecord,
} from "@tamga-network/wallet-core";
import { epochMillis } from "@tamga-network/core";
import { buildVerifyApp } from "../src/app.js";
import type { VerifyConfig } from "../src/config.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-sandbox");
const PKI = resolve(ROOT, "ops/pki-sandbox");
const BASE = "http://localhost:4104";
const LOCAL = { allowLocalDevHost: true };
const ISS = "https://issuer.sandbox.tamga.network/pid-tr";
const VCT = "urn:eudi:pid:1";
const ready =
  ["rp-sikkebank", "rp-verify", "pid-tr-issuer", "pid-tr-status"].every((n) =>
    existsSync(resolve(PKI, `${n}.pkcs8.pem`)),
  ) && existsSync(resolve(DIST, "external/sandbox-pid-tr.jws"));
const key = (n: string) => readFileSync(resolve(PKI, `${n}.pkcs8.pem`), "utf8");
const cert = (n: string) => readFileSync(resolve(PKI, `${n}.cert.pem`), "utf8");

describe.skipIf(!ready)("ADR-0094 K7 — PID ile banka hesabı açma (gerçek istek yolu)", () => {
  let app: Awaited<ReturnType<typeof buildVerifyApp>>;
  const statusUris = {
    ok: "https://status.sandbox.tamga.network/pid-e2e-ok",
    rev: "https://status.sandbox.tamga.network/pid-e2e-rev",
  };
  const tokens = new Map<string, string>();
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  beforeAll(async () => {
    const now = Math.floor(Date.now() / 1000);
    const st = await pemIssuerSigner(key("pid-tr-status"), cert("pid-tr-status"));
    for (const [uri, revoked] of [
      [statusUris.ok, false],
      [statusUris.rev, true],
    ] as const) {
      const bs = new StatusBitstring(MIN_CAPACITY);
      if (revoked) bs.set(7, StatusValue.INVALID);
      tokens.set(uri, await signStatusListToken({ signer: st, iss: ISS, uri, bitstring: bs, iat: now, ttlSec: 3600 }));
    }
    const cfg: VerifyConfig = {
      publicBase: BASE,
      port: 0,
      clientId: "",
      pkiDir: PKI,
      trustDist: DIST,
      stateCode: "TR",
      trustReloadSec: 60,
      statusPrefetchSec: 60,
      dataDir: join(tmpdir(), "tamga-verify-pid-" + process.pid + "-" + Math.random().toString(36).slice(2)),
      requireRpAuth: true,
      network: "sandbox",
    };
    // iptal listesi yalnız doğrulama anında çekilir (ön çekim çapalı listeleri bilir; PID listesi çapasız)
    app = await buildVerifyApp(cfg, { fetchText: async (u) => tokens.get(u) ?? null });
  });
  afterAll(async () => {
    await app?.close();
  });
  const http: Http = async (url, init) => {
    if (!url.startsWith(BASE)) throw new Error("host: " + url);
    const r = await app.inject({
      method: init?.method ?? "GET",
      url: url.slice(BASE.length),
      headers: init?.headers,
      payload: init?.body,
    });
    return { status: r.statusCode, text: async () => r.body };
  };

  async function walletWithPid(statusUri: string) {
    const now = Math.floor(Date.now() / 1000);
    const cnf = await keys.generate(`pid-${statusUri.slice(-3)}`);
    const issued = await issueSdJwtVc({
      signer: await pemIssuerSigner(key("pid-tr-issuer"), cert("pid-tr-issuer")),
      iss: ISS,
      vct: VCT,
      iat: now,
      exp: now + 365 * 86400,
      cnfJwk: cnf as never,
      status: { status_list: { idx: 7, uri: statusUri } },
      // barındırılan belge verenin `pidClaims` biçimi (tamga-platform apps/issuer/src/pid-provider.ts)
      claims: {
        given_name: "Aylin",
        family_name: "Kaya",
        birthdate: "2003-04-12",
        nationalities: ["TR"],
        address: { country: "TR", locality: "İstanbul" },
        personal_administrative_number: "990000000148",
        issuing_authority: "National Identity Authority — Türkiye (representative) (TEST)",
        issuing_country: "TR",
        date_of_issuance: "2026-11-21",
        date_of_expiry: "2031-11-21",
      },
      sdPolicy: {
        issuing_authority: "never",
        issuing_country: "never",
        date_of_issuance: "never",
        date_of_expiry: "never",
      },
      arrayElementSd: ["nationalities"],
      objectMemberSd: ["address"],
    });
    return receiveCredentials(
      newState("w"),
      {
        credentialIssuer: ISS,
        vct: VCT,
        issuedAt: now,
        copies: [{ combined: issued.combined, keyRef: `pid-${statusUri.slice(-3)}`, cnf }],
        metadata: { credential_issuer: ISS, credential_configurations_supported: {} } as never,
      },
      { trust: app.trust() },
    );
  }

  async function present(statusUri: string) {
    const r = await walletWithPid(statusUri);
    const owner = await pemRpSigner(key("rp-sikkebank"), cert("rp-sikkebank"));
    const auth = async () => `Bearer ${await createRpAssertion(owner, BASE)}`;
    const made = await app.inject({
      method: "POST",
      url: "/presentations",
      headers: { accept: "application/json", "content-type": "application/json", authorization: await auth() },
      payload: { policy_id: "bank-account-opening-pid" },
    });
    expect(made.statusCode, made.body).toBe(200);
    const { presentation_id, qr_payload } = made.json() as { presentation_id: string; qr_payload: string };
    const uri = parseVpUri(qr_payload, LOCAL);
    const fetched = await app.inject({ method: "GET", url: new URL(uri.requestUri).pathname });
    const req = verifyRequestObject(fetched.body.trim(), uri.clientId, LOCAL);
    const { matches } = matchDcql(req.dcql, r.state.credentials);
    expect(matches.length).toBe(1);
    expect(matches[0].credential.vct).toBe(VCT);
    const chk = checkRp(
      rpRecordOf(app.trust(), req.clientId) as RpRecord,
      req,
      matches[0],
      epochMillis(Date.now()),
      rpRecordOf(app.trust(), req.onBehalfOf!) as RpRecord,
    );
    expect(chk.registered && chk.active && chk.certMatches).toBe(true);
    expect(chk.legalName).toBe("Sikke Bank (TEST)");
    expect(chk.overAsk).toEqual([]);
    const copy = matches[0].credential.copies[0];
    const out = await respond({
      approval: chk.approval!,
      request: req,
      matches: [{ match: matches[0], keyRef: copy.keyRef, combined: copy.combined, disclose: matches[0].requested }],
      keys,
      http,
      allowLocalDevHost: true,
    });
    expect(out.status).toBe(200);
    return (
      await app.inject({
        method: "GET",
        url: `/presentations/${presentation_id}`,
        headers: { authorization: await auth() },
      })
    ).json() as {
      outcome: string;
      failed_step: string | null;
      failed_reason: string | null;
      disclosed_claims: string[];
    };
  }

  it("PID sunumu ACCEPTED; yalnız istenen öznitelikler açılır", async () => {
    const res = await present(statusUris.ok);
    expect(res.outcome, JSON.stringify([res.failed_step, res.failed_reason])).toBe("ACCEPTED");
    expect(res.disclosed_claims).toEqual(
      expect.arrayContaining([
        "given_name",
        "family_name",
        "birthdate",
        "nationalities",
        "personal_administrative_number",
      ]),
    );
    expect(res.disclosed_claims).not.toContain("address");
  });

  it("iptal edilmiş PID REJECTED (D)", async () => {
    const res = await present(statusUris.rev);
    expect(res.outcome).toBe("REJECTED");
    expect(res.failed_step).toMatch(/^D/);
  });
});
