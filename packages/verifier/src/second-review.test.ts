/**
 * İkinci inceleme turu (2026-11-11) — doğrulama hattı: dönen değerler (AP3/AP4), çapa gecikme penceresi (D5), `iss` zorunluluğu
 * (A3b), iptal anahtarı penceresi (D3), denetim yazıcısı hatası (E4), kök girdisi `"none"` (A3), sabit ret nedenleri (AP3).
 * Dev PKI + test listesi (`npm run setup`). Kişisel veri yok (örnek kişi kurgusaldır).
 */
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  issueSdJwtVc,
  pemIssuerSigner,
  signStatusListToken,
  StatusBitstring,
  MIN_CAPACITY,
  type SdPolicy,
} from "@tamga-network/sd-jwt";
import { loadTrustSourceFromDir, pemToDer, x509HashClientId, type ListTrustSource } from "@tamga-network/trust";
import { SoftwareKeyProvider, MemoryKeyStore, presentSdJwt } from "@tamga-network/wallet-core";
import { epochSeconds } from "@tamga-network/core";
import { verifyPresentation, MemoryStatusCache, type Policy } from "./index.js";
import { isLocalUrl, returnedClaims, stepT0, DEFAULT_MAX_ANCHOR_LAG_SEC, type VerifyCtx } from "./steps.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PKI = resolve(ROOT, "ops/pki");
const DIST = resolve(ROOT, "apps/trust-publisher/dist-test");
const ready = existsSync(resolve(PKI, "issuer-bilgi.pkcs8.pem")) && existsSync(resolve(DIST, "lotl.jws"));
const AUD = existsSync(resolve(PKI, "rp-verify.cert.pem"))
  ? x509HashClientId(pemToDer(readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8")))
  : "";
const ISS = "https://issuer.tamga.network/example-university";
const VCT = "urn:tamga:edu:DiplomaCredential:1";
const REQUIRED = ["is_graduate", "eqf_level", "qualification_title", "awarding_body_name"];
const policy: Policy = {
  policy_id: "t2",
  purpose: { "tr-TR": "test" },
  credentials: [{ id: "diploma", vct_values: [VCT], required_claims: REQUIRED }],
  trust: { min_issuer_assurance: "I2", allowed_categories: ["EDUCATION"], require_recognition: true, state_code: "TR" },
  freshness: { max_status_token_age_sec: 6 * 3600, max_trust_age_sec: 86400 },
};

describe("returnedClaims / isLocalUrl / T0 (birim)", () => {
  it("AP3/AP4: yalnız istenen alanlar döner; teknik alanlar istenmiş olsa da dönmez; yol istenirse yalnız o yol", () => {
    const a = {
      format: "dc+sd-jwt" as const,
      disclosedClaimNames: ["given_name", "address", "address.country", "nationalities[0]", "grade"],
      claims: {
        iss: "https://x",
        iat: 1,
        cnf: { jwk: { kty: "EC" } },
        status: { status_list: { idx: 4242, uri: "https://s/1" } },
        vct: "urn:x",
        given_name: "A",
        grade: "3.4",
        gate: "B",
        address: { country: "TR", locality: "İzmir" },
        nationalities: ["TR"],
      },
    };
    const r = returnedClaims(a, ["given_name", "address.country", "nationalities[0]", "gate", "status", "cnf", "yok"]);
    expect(r.claims).toEqual({ given_name: "A", address: { country: "TR" }, nationalities: ["TR"], gate: "B" });
    expect(r.alwaysVisible).toEqual(["gate"]); // kurumun açıkta bıraktığı, istenen alan
    expect(JSON.stringify(r.claims)).not.toMatch(/idx|jwk|İzmir|3\.4/);
    // kök bütünüyle istenirse bütün (açıklanan) alt alanlar
    expect(returnedClaims(a, ["address.country", "address"]).claims).toEqual({
      address: { country: "TR", locality: "İzmir" },
    });
    expect(returnedClaims(a, ["address", "address.country"]).claims).toEqual({
      address: { country: "TR", locality: "İzmir" },
    });
    expect(returnedClaims(a, []).claims).toEqual({});
  });

  it("A3b: `allowLocalIssuerUrls` yalnız localhost ve özel ağ aralıklarını yerel sayar — genel IP yerel değildir", () => {
    for (const u of [
      "http://localhost:4001/x",
      "http://127.0.0.1:4001/x",
      "http://192.168.1.20:4001/x",
      "https://10.0.0.5/x",
      "http://172.16.0.9/x",
      "http://172.31.255.1/x",
    ])
      expect(isLocalUrl(u), u).toBe(true);
    for (const u of [
      "https://8.8.8.8/x",
      "http://203.0.113.7:4001/x",
      "http://172.32.0.1/x",
      "http://192.169.1.1/x",
      "http://999.1.1.1/x",
      "http://[::1]:4001/x",
      "http://10.0.0.1.evil.example/x",
    ])
      expect(isLocalUrl(u), u).toBe(false);
  });

  it("T0: `max_anchor_lag_sec` verilmişse sayı olmalı (bozuk değer denetimi sessizce kapatmaz)", () => {
    const ctxWith = (freshness: unknown) =>
      ({ fr: { healthy: true, ageSec: 10 }, input: { policy: { freshness } }, done: [] }) as unknown as VerifyCtx;
    const base = { max_trust_age_sec: 86400, max_status_token_age_sec: 3600 };
    expect(stepT0(ctxWith({ ...base, max_anchor_lag_sec: 600 }))).toBeUndefined();
    for (const bad of ["600", -1, Number.NaN, Number.POSITIVE_INFINITY])
      expect(stepT0(ctxWith({ ...base, max_anchor_lag_sec: bad })), String(bad)).toMatchObject({ step: "T0" });
  });
});

describe.skipIf(!ready)("ikinci inceleme — verifyPresentation (dev PKI + dist)", () => {
  let trust: ListTrustSource;
  let rootDer: Uint8Array[];
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  const catalogue = JSON.parse(readFileSync(resolve(ROOT, "packages/schemas/dist/index.json"), "utf8")) as Array<{
    vct: string;
    content_hash: string;
  }>;
  const integ = catalogue.find((c) => c.vct === VCT)!.content_hash;
  const STATUS_URI = "https://status.tamga.network/abcdef0123456789";
  const IDX = 4242;
  const claims = {
    family_name: "Yılmaz",
    given_name: "Ayşe",
    birth_date: "2001-05-05",
    awarding_body_name: { "tr-TR": "Örnek Üniversitesi" },
    awarding_body_id: "example-university",
    awarding_body_country: "TR",
    qualification_title: { "tr-TR": "Bilgisayar Mühendisliği Lisans" },
    eqf_level: 6,
    isced_f_code: "0613",
    awarding_date: "2025-06-30",
    grade: "3.4",
    is_graduate: true,
    graduated_before: 2026,
  };
  beforeAll(async () => {
    const r = await loadTrustSourceFromDir(DIST);
    trust = r.trust;
    rootDer = [pemToDer(r.rootCertPem!)];
  });
  const issuerSigner = () =>
    pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-bilgi.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8"),
    );
  async function issue(iat: number, o: { iss?: string | null; sdPolicy?: Record<string, SdPolicy> } = {}) {
    const ref = `k-${iat}-${Math.random().toString(36).slice(2, 8)}`;
    const cnf = await keys.generate(ref);
    const r = await issueSdJwtVc({
      signer: await issuerSigner(),
      iss: (o.iss === null ? undefined : (o.iss ?? ISS)) as string,
      vct: VCT,
      vctIntegrity: integ,
      iat,
      cnfJwk: cnf as never,
      status: { status_list: { idx: IDX, uri: STATUS_URI } },
      claims,
      sdPolicy: { grade: "always", thesis_title: "always", ...o.sdPolicy },
    });
    return { combined: r.combined, ref };
  }
  async function statusToken(iat: number) {
    const signer = await pemIssuerSigner(
      readFileSync(resolve(PKI, "issuer-bilgi-status.pkcs8.pem"), "utf8"),
      readFileSync(resolve(PKI, "issuer-bilgi-status.cert.pem"), "utf8"),
    );
    return signStatusListToken({
      signer,
      iss: ISS,
      uri: STATUS_URI,
      bitstring: new StatusBitstring(MIN_CAPACITY),
      iat,
      ttlSec: 120,
      expSec: 6 * 3600,
    });
  }
  const present = (combined: string, ref: string, now: number, disclose = REQUIRED, nonce = "n-2r") =>
    presentSdJwt({ combined, discloseClaims: disclose, keys, keyRef: ref, aud: AUD, nonce, iat: now });
  const cacheWith = async (tokIat: number, fetchedAt = tokIat) => {
    const c = new MemoryStatusCache();
    c.set(STATUS_URI, await statusToken(tokIat), fetchedAt);
    return c;
  };
  const input = (presentation: string, now: number, statusCache: MemoryStatusCache) => ({
    presentation,
    aud: AUD,
    nonce: "n-2r",
    policy,
    policyCredentialId: "diploma",
    trust,
    statusCache,
    rootCertsDer: rootDer,
    rp: "none" as const,
    now: epochSeconds(now),
  });
  const anchored = (row: Record<string, unknown> | null): ListTrustSource => {
    const t: ListTrustSource = Object.create(trust);
    t.statusAnchor = () => row as ReturnType<ListTrustSource["statusAnchor"]>;
    return t;
  };

  it("AP4/AP3: `claims` yalnız istenen alanları taşır — `status` (idx), `cnf`, `iss`, `iat`, `vct` ve istenmeyen açıklama dönmez", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { combined, ref } = await issue(now);
    // cüzdan istenenden fazlasını (awarding_date) açıklıyor
    const pres = await present(combined, ref, now, [...REQUIRED, "awarding_date"]);
    const out = await verifyPresentation(input(pres, now, await cacheWith(now)));
    expect(out.result.outcome, out.result.failed_reason ?? "").toBe("ACCEPTED");
    expect(Object.keys(out.claims!).sort()).toEqual([...REQUIRED].sort());
    const wire = JSON.stringify(out);
    expect(wire).not.toContain(String(IDX));
    expect(wire).not.toMatch(/"idx"|"cnf"|"jwk"|"iss"|"vct#integrity"|"status_list"/);
    expect(out.claims).not.toHaveProperty("awarding_date");
    // açıklanan fazlalık yine `disclosed_claims`'te görünür (E3 onu denetler); değer dönmez
    expect(out.result.disclosed_claims).toContain("awarding_date");
  });

  it("E3: kurumun hep açık bıraktığı alan istenmişse açıklanmış sayılır (`disclosed_claims` + kapsam denetimi); istenmemişse dönmez", async () => {
    const now = Math.floor(Date.now() / 1000);
    // `grade` seçici açıklanamaz (açıkta) verilmiş bir belge
    const { combined, ref } = await issue(now, { sdPolicy: { grade: "never" } });
    const pres = await present(combined, ref, now);
    const cache = await cacheWith(now);
    const notAsked = await verifyPresentation(input(pres, now, cache));
    expect(notAsked.result.outcome, notAsked.result.failed_reason ?? "").toBe("ACCEPTED");
    expect(notAsked.claims).not.toHaveProperty("grade");
    expect(notAsked.result.disclosed_claims).not.toContain("grade");
    const asking: Policy = {
      ...policy,
      credentials: [{ ...policy.credentials[0], required_claims: [...REQUIRED, "grade"] }],
    };
    const asked = await verifyPresentation({ ...input(pres, now, cache), policy: asking });
    expect(asked.result.outcome, asked.result.failed_reason ?? "").toBe("ACCEPTED");
    expect(asked.claims?.grade).toBe("3.4");
    expect(asked.result.disclosed_claims).toContain("grade");
    // kayıtlı RP'nin kapsamında `grade` yok → açıkta gelen alan da E3'ten geçemez
    const scoped = await verifyPresentation({
      ...input(pres, now, cache),
      policy: asking,
      rp: trust.relyingParty(AUD),
    });
    expect(scoped.result).toMatchObject({ outcome: "REJECTED", failed_step: "E3" });
    expect(scoped.claims).toBeNull();
  });

  it("D5: çapadan yeni belirteç yalnız çapa gecikme penceresi içinde geçer; pencere aşılırsa DOĞRULANAMADI (STATUS_STALE)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { combined, ref } = await issue(now);
    const pres = await present(combined, ref, now);
    const row = (publishedAgoSec: number) => ({
      content_hash: "sha256:" + "ab".repeat(32), // belirtecin özetiyle uyuşmaz
      published_at: new Date((now - publishedAgoSec) * 1000).toISOString(),
      version: 7,
      list_uri: STATUS_URI,
    });
    const cache = await cacheWith(now);
    // son çapa 5 dk önce, belirteç şimdi: olağan gecikme → geçer, D5 "atlandı" görünür
    const within = await verifyPresentation({ ...input(pres, now, cache), trust: anchored(row(300)) });
    expect(within.result.outcome, within.result.failed_reason ?? "").toBe("ACCEPTED");
    expect(within.result.checks_skipped).toContain("D5");
    // son çapa varsayılan pencereden (+ saat toleransı) eski: belirtecin çapası gecikmiş → kabul edilmez
    const overdue = await verifyPresentation({
      ...input(pres, now, cache),
      trust: anchored(row(DEFAULT_MAX_ANCHOR_LAG_SEC + 121 + 10)),
    });
    expect(overdue.result).toMatchObject({
      outcome: "INDETERMINATE",
      failed_step: "D5",
      indeterminate_reason: "STATUS_STALE",
    });
    expect(overdue.claims).toBeNull();
    // seçenek: politika pencereyi daraltır (çapa günlüğünü yerelden okuyan doğrulayıcı)
    const tight: Policy = { ...policy, freshness: { ...policy.freshness, max_anchor_lag_sec: 60 } };
    const tightOverdue = await verifyPresentation({
      ...input(pres, now, cache),
      policy: tight,
      trust: anchored(row(300)),
    });
    expect(tightOverdue.result).toMatchObject({ outcome: "INDETERMINATE", failed_step: "D5" });
    const tightOk = await verifyPresentation({ ...input(pres, now, cache), policy: tight, trust: anchored(row(100)) });
    expect(tightOk.result.outcome).toBe("ACCEPTED");
  });

  it("D5: çapa günlüğünde hiç olmayan liste yalnız yeni verilmiş belgede geçer; pencere dolduysa DOĞRULANAMADI", async () => {
    const now = Math.floor(Date.now() / 1000);
    const noAnchor = anchored(null);
    const fresh = await issue(now - 60);
    const freshOut = await verifyPresentation({
      ...input(await present(fresh.combined, fresh.ref, now), now, await cacheWith(now)),
      trust: noAnchor,
    });
    expect(freshOut.result.outcome, freshOut.result.failed_reason ?? "").toBe("ACCEPTED");
    expect(freshOut.result.checks_skipped).toContain("D5");
    const old = await issue(now - DEFAULT_MAX_ANCHOR_LAG_SEC - 300);
    const oldOut = await verifyPresentation({
      ...input(await present(old.combined, old.ref, now), now, await cacheWith(now)),
      trust: noAnchor,
    });
    expect(oldOut.result).toMatchObject({
      outcome: "INDETERMINATE",
      failed_step: "D5",
      indeterminate_reason: "STATUS_STALE",
    });
    // çapa belirteçle eşleşiyorsa belgenin yaşı önemsizdir (D5 yapıldı)
    const cache = await cacheWith(now);
    const tok = cache.get(STATUS_URI)!.token;
    const { createHash } = await import("node:crypto");
    const matching = anchored({
      content_hash: "sha256:" + createHash("sha256").update(tok).digest("hex"),
      published_at: new Date(now * 1000).toISOString(),
      version: 3,
      list_uri: STATUS_URI,
    });
    const ok = await verifyPresentation({
      ...input(await present(old.combined, old.ref, now), now, cache),
      trust: matching,
    });
    expect(ok.result.outcome, ok.result.failed_reason ?? "").toBe("ACCEPTED");
    expect(ok.result.checks_performed).toContain("D5");
  });

  it("A3b: `iss` eksik ya da boş belge RED — tutarlılık denetimi atlanmaz; `allowLocalIssuerUrls` genel IP'yi geçirmez", async () => {
    const now = Math.floor(Date.now() / 1000);
    const cache = await cacheWith(now);
    const none = await issue(now, { iss: null });
    const noIss = await verifyPresentation(input(await present(none.combined, none.ref, now), now, cache));
    expect(noIss.result).toMatchObject({ outcome: "REJECTED", failed_step: "A3b" });
    expect(noIss.result.failed_reason).toMatch(/iss claim missing/);
    // boş `iss` şemada da geçersizdir (B6 önce çalışır); her iki adımda da RED
    const empty = await issue(now, { iss: "" });
    const emptyIss = await verifyPresentation(input(await present(empty.combined, empty.ref, now), now, cache));
    expect(emptyIss.result.outcome).toBe("REJECTED");
    expect(["A3b", "B6"]).toContain(emptyIss.result.failed_step);
    const pub = await issue(now, { iss: "https://8.8.8.8/example-university" });
    const pubPres = await present(pub.combined, pub.ref, now);
    const leaked = await verifyPresentation({ ...input(pubPres, now, cache), allowLocalIssuerUrls: true });
    expect(leaked.result).toMatchObject({ outcome: "REJECTED", failed_step: "A3b" });
    // yerel adres bayrakla kabul (yalnız yerel geliştirme), bayraksız RED
    const lan = await issue(now, { iss: "http://192.168.1.20:4001/example-university" });
    const lanPres = await present(lan.combined, lan.ref, now);
    expect((await verifyPresentation(input(lanPres, now, cache))).result.failed_step).toBe("A3b");
    const lanOk = await verifyPresentation({ ...input(lanPres, now, cache), allowLocalIssuerUrls: true });
    expect(lanOk.result.failed_step).not.toBe("A3b");
  });

  it("D3: iptal anahtarı `valid_from..valid_to` penceresi dışındaysa imzacı sayılmaz (kayıtlı anahtar yok → DOĞRULANAMADI)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { combined, ref } = await issue(now);
    const pres = await present(combined, ref, now);
    const cache = await cacheWith(now);
    const windowed = (w: { valid_from?: string; valid_to?: string }): ListTrustSource => {
      const t: ListTrustSource = Object.create(trust);
      t.issuer = (id: string) => {
        const rec = trust.issuer(id);
        return rec ? { ...rec, delegate_keys: (rec.delegate_keys ?? []).map((k) => ({ ...k, ...w })) } : rec;
      };
      return t;
    };
    const iso = (s: number) => new Date(s * 1000).toISOString();
    const expired = await verifyPresentation({
      ...input(pres, now, cache),
      trust: windowed({ valid_to: iso(now - 3600) }),
    });
    expect(expired.result).toMatchObject({ outcome: "INDETERMINATE", failed_step: "D3" });
    const notYet = await verifyPresentation({
      ...input(pres, now, cache),
      trust: windowed({ valid_from: iso(now + 3600) }),
    });
    expect(notYet.result).toMatchObject({ outcome: "INDETERMINATE", failed_step: "D3" });
    const inside = await verifyPresentation({
      ...input(pres, now, cache),
      trust: windowed({ valid_from: iso(now - 3600), valid_to: iso(now + 3600) }),
    });
    expect(inside.result.outcome, inside.result.failed_reason ?? "").toBe("ACCEPTED");
  });

  it("E4: fırlatan ya da reddeden denetim yazıcısı doğrulamayı düşürmez — sonuç döner, E4 `checks_skipped`'te", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { combined, ref } = await issue(now);
    const pres = await present(combined, ref, now);
    const cache = await cacheWith(now);
    const thrown = await verifyPresentation({
      ...input(pres, now, cache),
      audit: () => {
        throw new Error("disk dolu");
      },
    });
    expect(thrown.result.outcome).toBe("ACCEPTED");
    expect(thrown.result.checks_performed).not.toContain("E4");
    expect(thrown.result.checks_skipped).toContain("E4");
    const rejected = await verifyPresentation({
      ...input(pres, now, cache),
      audit: (() => Promise.reject(new Error("uzak kayıt yok"))) as never,
    });
    expect(rejected.result.checks_skipped).toContain("E4");
    let written = 0;
    const asyncOk = await verifyPresentation({
      ...input(pres, now, cache),
      audit: (async () => {
        await new Promise((r) => setTimeout(r, 5));
        written++;
      }) as never,
    });
    expect(written).toBe(1); // eşzamansız yazıcı beklenir
    expect(asyncOk.result.checks_performed).toContain("E4");
  });

  it('A3: `rootCertsDer: "none"` ile zincir denetlenmediyse A3 "yapıldı" değil "atlandı" raporlanır', async () => {
    const now = Math.floor(Date.now() / 1000);
    const { combined, ref } = await issue(now);
    const out = await verifyPresentation({
      ...input(await present(combined, ref, now), now, await cacheWith(now)),
      rootCertsDer: "none" as never,
    });
    expect(out.result.checks_performed).not.toContain("A3");
    expect(out.result.checks_skipped).toContain("A3");
    expect(out.result.checks_performed).toContain("A3b"); // kurum yine yaprak sertifikadan (C1 listede arar)
    // mdoc yollarında çapa şarttır; dizi olmayan başka değer de zinciri atlatmaz
    for (const bad of [undefined, "hepsi", {}]) {
      const r = await verifyPresentation({
        ...input(await present(combined, ref, now), now, await cacheWith(now)),
        rootCertsDer: bad as never,
      });
      expect(r.result, String(bad)).toMatchObject({ outcome: "INDETERMINATE", failed_step: "A3" });
    }
  });

  it("AP3 / AP2: ret nedeni belgedeki değeri taşımaz; önbellekteki okunamayan iptal gövdesi RED değil DOĞRULANAMADI", async () => {
    const now = Math.floor(Date.now() / 1000);
    // C4: kayıt sınıfı EAA iken belge `category` taşıyor → RED; neden değeri içermez
    const ref = `k-cat-${now}`;
    const cnf = await keys.generate(ref);
    const withCat = await issueSdJwtVc({
      signer: await issuerSigner(),
      iss: ISS,
      vct: VCT,
      vctIntegrity: integ,
      iat: now,
      cnfJwk: cnf as never,
      status: { status_list: { idx: IDX, uri: STATUS_URI } },
      category: "urn:tamga:eaa:SIZINTI" as never,
      claims,
      sdPolicy: { grade: "always" },
    });
    const c4 = await verifyPresentation(input(await present(withCat.combined, ref, now), now, await cacheWith(now)));
    expect(c4.result.outcome).toBe("REJECTED");
    expect(c4.result.failed_reason ?? "").not.toMatch(/SIZINTI/);
    // D3: önbellekte belirteç yerine sunucunun hata sayfası
    const { combined, ref: r2 } = await issue(now);
    const garbage = new MemoryStatusCache();
    garbage.set(STATUS_URI, "<html><body>502 Bad Gateway — iç adres 10.1.2.3</body></html>", now);
    const out = await verifyPresentation(input(await present(combined, r2, now), now, garbage));
    expect(out.result).toMatchObject({
      outcome: "INDETERMINATE",
      failed_step: "D3",
      indeterminate_reason: "STATUS_UNREACHABLE",
    });
    expect(out.result.failed_reason ?? "").not.toMatch(/10\.1\.2\.3|html|Gateway/);
  });
});
