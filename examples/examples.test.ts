/**
 * The examples are real code: this test runs each one against the real packages (and, where possible, the real
 * reference verifier in-process), so the snippets shown on the docs site and tamga.network cannot go stale.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { issueSdJwtVc, pemIssuerSigner } from "@tamga-network/sd-jwt";
import { signStatusListToken, StatusBitstring, MIN_CAPACITY } from "@tamga-network/issuer";
import { pemRpSigner } from "@tamga-network/verifier";
import {
  SoftwareKeyProvider,
  MemoryKeyStore,
  parseVpUri,
  fetchRequestObject,
  verifyRequestObject,
  matchDcql,
  respond,
  newState,
  receiveCredentials,
  type Http,
} from "@tamga-network/wallet-core";
import { buildVerifyApp } from "../apps/verify/src/app.js";
import { tamgaSignIn } from "./01-web-login/server.js";
import { createOwnVerifier } from "./02-verify-own-server/verifier.js";
import { institution } from "./03-issue-hosted/issuer.js";
import { institutionStatus } from "./04-check-institution/check.js";

const ROOT = resolve(import.meta.dirname, "..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test"); // test listesi (test/fixtures/registry; npm run setup)
const ready = existsSync(resolve(PKI, "rp-verify.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));
const TRUST = "https://trust.test";
const ISS = "https://issuer.tamga.network/bilgi";
const VCT = "urn:tamga:edu:DiplomaCredential:1";
const STATUS_URI = "https://status.tamga.network/feedfacefeedface";
const YEAR = 365 * 86400_000;

const pins = () =>
  (
    JSON.parse(readFileSync(resolve(DIST, "keys/root-fingerprints.json"), "utf8")) as {
      lotl_signing_keys: Array<{ fingerprint_sha256: string }>;
    }
  ).lotl_signing_keys.map((k) => k.fingerprint_sha256);
/** Serves the published trust files as if from https://trust.test. */
const trustFetch = (async (url: string | URL) => {
  const p = resolve(DIST, String(url).slice(TRUST.length + 1));
  return existsSync(p) ? new Response(readFileSync(p, "utf8")) : new Response("", { status: 404 });
}) as typeof fetch;
const rpSigner = () =>
  pemRpSigner(
    readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"),
    readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8"),
  );

describe.skipIf(!ready)("examples", () => {
  let statusTok = "";
  beforeAll(async () => {
    const st = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-bilgi-status.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-bilgi-status.cert.pem"), "utf8"),
    );
    statusTok = await signStatusListToken({
      signer: st,
      iss: ISS,
      uri: STATUS_URI,
      bitstring: new StatusBitstring(MIN_CAPACITY),
      iat: Math.floor(Date.now() / 1000),
      ttlSec: 3600,
    });
  });

  it("02 — own server: request → wallet answers → ACCEPTED with only the requested fields; a replay is refused", async () => {
    const PUB = "http://own.test";
    const v = await createOwnVerifier({
      trustBase: TRUST,
      rootFingerprints: pins(),
      signer: await rpSigner(),
      publicBase: PUB,
      fetch: trustFetch,
      fetchStatus: async (u) => (u === STATUS_URI ? statusTok : null),
      anchorMaxAgeMs: YEAR,
    });
    // the test list below is not anchored in the published lists, so load it explicitly
    await v.statusCache.refresh([STATUS_URI]);
    // a diploma in a wallet
    const now = Math.floor(Date.now() / 1000);
    const catalogue = JSON.parse(readFileSync(resolve(ROOT, "packages/schemas/dist/index.json"), "utf8")) as Array<{
      vct: string;
      content_hash: string;
    }>;
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const cnf = await keys.generate("w.0");
    const issued = await issueSdJwtVc({
      signer: await pemIssuerSigner(
        readFileSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"), "utf8"),
        readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8"),
      ),
      iss: ISS,
      vct: VCT,
      vctIntegrity: catalogue.find((c) => c.vct === VCT)!.content_hash,
      iat: now,
      cnfJwk: cnf as never,
      status: { status_list: { idx: 9, uri: STATUS_URI } },
      claims: {
        family_name: "Example",
        given_name: "Graduate",
        birth_date: "2000-01-01",
        awarding_body_name: { "tr-TR": "Bilgi (DEMO)" },
        awarding_body_id: "bilgi",
        awarding_body_country: "TR",
        qualification_title: { "tr-TR": "Bilgisayar Müh." },
        eqf_level: 6,
        isced_f_code: "0613",
        awarding_date: "2025-06-30",
        grade: "3.4",
        is_graduate: true,
        graduated_before: 2026,
      },
      sdPolicy: { grade: "always" },
    });
    const wallet = receiveCredentials(
      newState("w"),
      {
        credentialIssuer: ISS,
        vct: VCT,
        issuedAt: now,
        copies: [{ combined: issued.combined, keyRef: "w.0", cnf }],
        metadata: {
          credential_issuer: ISS,
          credential_endpoint: ISS + "/credential",
          credential_configurations_supported: { [VCT]: { format: "dc+sd-jwt" } },
        },
      },
      { now },
    ).state;

    // your server's two routes, as the wallet sees them
    let outcome: Awaited<ReturnType<typeof v.handleResponse>> | null = null;
    let lastJwe = "";
    const http: Http = async (url, init) => {
      if (url.startsWith(`${PUB}/vp/req/`)) {
        const jwt = v.requestObject(url.slice(`${PUB}/vp/req/`.length));
        return { status: jwt ? 200 : 404, text: async () => jwt ?? "" };
      }
      if (url === `${PUB}/vp/response`) {
        lastJwe = decodeURIComponent(String(init?.body).replace(/^response=/, ""));
        outcome = await v.handleResponse(lastJwe);
        return { status: 200, text: async () => "{}" };
      }
      return { status: 404, text: async () => "" };
    };

    const { qrPayload } = await v.start();
    const uri = parseVpUri(qrPayload);
    const req = verifyRequestObject(await fetchRequestObject(uri.requestUri, http), uri.clientId);
    const { matches } = matchDcql(req.dcql, wallet.credentials);
    const copy = matches[0].credential.copies[0];
    await respond({
      request: req,
      matches: [{ match: matches[0], keyRef: copy.keyRef, combined: copy.combined, disclose: matches[0].requested }],
      keys,
      http,
      now,
    });
    const out = outcome as unknown as Awaited<ReturnType<typeof v.handleResponse>>;
    expect(out.result.failed_reason).toBeNull();
    expect(out.result.outcome).toBe("ACCEPTED");
    expect([...out.result.disclosed_claims].sort()).toEqual(
      ["awarding_body_name", "eqf_level", "is_graduate", "qualification_title"].sort(),
    );
    for (const personal of ["family_name", "given_name", "birth_date", "grade"])
      expect(out.claims).not.toHaveProperty(personal); // not requested → never sent
    await expect(v.handleResponse(lastJwe)).rejects.toThrow(/already answered/);
  });

  it("01 — website: the server opens the presentation with its signed assertion; the page gets only a status token", async () => {
    const app = await buildVerifyApp(
      {
        publicBase: "http://verify.local",
        port: 0,
        clientId: "", // set from the access certificate (x509_hash)
        pkiDir: PKI,
        trustDist: DIST,
        stateCode: "TR",
        trustReloadSec: 60,
        statusPrefetchSec: 60,
        dataDir: join(tmpdir(), "tamga-examples-" + process.pid),
        requireRpAuth: true,
      },
      { fetchText: async () => null },
    );
    const inject = (async (url: string | URL, init?: RequestInit) => {
      const r = await app.inject({
        method: (init?.method ?? "GET") as "GET" | "POST",
        url: String(url).slice("http://verify.local".length),
        headers: init?.headers as Record<string, string>,
        payload: init?.body as string | undefined,
      });
      return new Response(r.body, { status: r.statusCode });
    }) as typeof fetch;
    const site = tamgaSignIn({ verifier: "http://verify.local", rp: await rpSigner(), siteSecret: "s", fetch: inject });
    const started = await site.start("site-signup");
    expect(started.qr_payload).toContain("request_uri=");
    expect(started.status_token.length).toBeGreaterThan(16);
    expect(await site.finish(started.presentation_id)).toEqual({ ok: false, outcome: "PENDING" });
  });

  it("03 — hosted issuing: scoped API key on /{slug}/api/v1; the PIN is not inside the link", async () => {
    const calls: Array<{ url: string; auth: string | null; body: unknown }> = [];
    const fake = (async (url: string | URL, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      calls.push({
        url: String(url),
        auth: h.get("authorization"),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      if (String(url).endsWith("/revocations"))
        return new Response(JSON.stringify({ message: "credential not found" }), { status: 404 });
      return new Response(
        JSON.stringify({
          offer_id: "o1",
          tx_code: "123456",
          expires_at: 1,
          offer_uri: "u",
          deep_link: "openid-credential-offer://?x",
        }),
      );
    }) as typeof fetch;
    const uni = institution({ apiKey: "tmg_bilgi_k", slug: "bilgi", fetch: fake });
    const offer = await uni.offerDiploma("121200001");
    expect(calls[0].url).toBe("https://issuer.tamga.network/bilgi/api/v1/offers");
    expect(calls[0].auth).toBe("Bearer tmg_bilgi_k");
    expect(calls[0].body).toMatchObject({ subject_id: "121200001", vct: VCT });
    expect(offer.deepLink).not.toContain(offer.txCode);
    expect(await uni.cancel("nope", "test")).toBeNull();
  });

  it("04 — trust lists: registered, active and authorized for diplomas; unknown institution", async () => {
    const s = await institutionStatus(TRUST, pins(), "bilgi", VCT, { fetch: trustFetch });
    expect(s).toMatchObject({ registered: true, status: "ACTIVE", authorized: true, category: "EDUCATION" });
    expect((await institutionStatus(TRUST, pins(), "yok", VCT, { fetch: trustFetch })).registered).toBe(false);
    expect(
      (await institutionStatus(TRUST, pins(), "bilgi", "urn:tamga:tkt:EventTicket:1", { fetch: trustFetch }))
        .authorized,
    ).toBe(false);
  });
});
