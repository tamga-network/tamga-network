/**
 * Kayıt geri çekme (SPEC-TRUST-0001 TL2: kayıt silinmez, durum `status_history`'ye eklenir) ve 2026-10-04 kararı: gerçek ağda
 * test/demo kurumu kalmaz — örnek kurumlar gerçek listede REVOKED (bütün belgeleri geçersiz), senaryolar sandbox listesinde.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { RegistryError, endRpUse, reassignRelyingPartyOut, setIssuerStatus, setRpStatus } from "../src/registry-ops.js";

const env = { now: new Date("2026-10-04T12:00:00Z") };
const NOW = "2026-10-04T12:00:00.000Z";
const src = () => ({
  issuers: [
    {
      slug: "ornek",
      status: "ACTIVE",
      valid_from: "2026-09-24T00:00:00Z",
      status_history: [{ status: "ACTIVE", since: "2026-09-24T00:00:00Z" }],
      schema_authorizations: [
        {
          vct: "urn:tamga:edu:StudentCredential:1",
          allowed: true,
          valid_from: "2026-09-24T00:00:00Z",
          valid_until: null,
        },
      ],
    },
  ],
  relying_parties: [
    {
      dns_name: "rp.example",
      status: "ACTIVE",
      status_history: [{ status: "ACTIVE", since: "2026-09-24T00:00:00Z" }],
      scopes: [
        { scope_id: "a-1", valid_from: "2026-09-24T00:00:00Z", valid_until: "2027-09-24T00:00:00Z" },
        { scope_id: "b-1", valid_from: "2026-09-24T00:00:00Z", valid_until: "2027-09-24T00:00:00Z" },
      ],
      terminal_groups: [{ group_id: "kapi", valid_from: "2026-09-24T00:00:00Z" }],
    },
  ],
});

describe("kayıt geri çekme (TL2)", () => {
  it("kurum REVOKED: kayıt kalır, geçmişe eklenir, invalidates_from yazılır, açık yetkiler kapanır", () => {
    const s = setIssuerStatus(src(), "ornek", "REVOKED", { reason: "r", invalidatesFrom: "2026-09-24T00:00:00Z" }, env);
    const i = s.issuers[0];
    expect(s.issuers).toHaveLength(1);
    expect(i.status).toBe("REVOKED");
    expect(i.status_history).toEqual([
      { status: "ACTIVE", since: "2026-09-24T00:00:00Z" },
      { status: "REVOKED", since: NOW, reason: "r", invalidates_from: "2026-09-24T00:00:00Z" },
    ]);
    expect(i.schema_authorizations[0].valid_until).toBe(NOW);
  });

  it("geçersiz istekler tek hatada", () => {
    expect(() => setIssuerStatus(src(), "yok", "REVOKED", {}, env)).toThrow(RegistryError);
    expect(() => setIssuerStatus(src(), "ornek", "SILINDI", {}, env)).toThrow(/durum/);
    expect(() => setIssuerStatus(src(), "ornek", "SUSPENDED", { invalidatesFrom: NOW }, env)).toThrow(/yalnız REVOKED/);
    expect(() => setIssuerStatus(src(), "ornek", "ACTIVE", {}, env)).toThrow(/zaten ACTIVE/);
  });

  it("doğrulayıcı REVOKED: kayıt kalır, kullanımlar sona erer", () => {
    const s = setRpStatus(src(), "rp.example", "REVOKED", { reason: "r" }, env);
    const rp = s.relying_parties[0];
    expect(rp.status).toBe("REVOKED");
    expect(rp.status_history.at(-1)).toEqual({ status: "REVOKED", since: NOW, reason: "r" });
    expect(rp.scopes.map((x: { valid_until: string }) => x.valid_until)).toEqual([NOW, NOW]);
  });

  it("ADR-0075 devir (eski ülke listesi): kayıt REVOKED, yapılı devir kaydı (reassigned_to); kullanımlar ve kapı grupları kapanır", () => {
    const s = reassignRelyingPartyOut(
      { ...src(), state_code: "TR" },
      "rp.example",
      { toState: "KZ", approval: "reassign-record-1" },
      env,
    );
    const rp = s.relying_parties[0];
    expect(s.relying_parties).toHaveLength(1);
    expect(rp.status).toBe("REVOKED");
    expect(rp.status_history.at(-1)).toEqual({
      status: "REVOKED",
      since: NOW,
      reason: "reassignment to KZ (approval reassign-record-1)",
      reassigned_to: "KZ", // makinece okunur devir kaydı: yükleyici yeni ülkedeki kaydı yalnız bununla alır
    });
    expect(rp.scopes.map((x: { valid_until: string }) => x.valid_until)).toEqual([NOW, NOW]);
    expect(rp.terminal_groups[0].valid_until).toBe(NOW);
    // onaysız, aynı devlete, iptal edilmiş kayda devir yok
    const tr = { ...src(), state_code: "TR" };
    expect(() => reassignRelyingPartyOut(tr, "rp.example", { toState: "KZ", approval: "" }, env)).toThrow(/approval/);
    expect(() => reassignRelyingPartyOut(tr, "rp.example", { toState: "TR", approval: "ok-123" }, env)).toThrow(
      /bu listenin devleti/,
    );
    expect(() => reassignRelyingPartyOut(tr, "rp.example", { toState: "kz", approval: "ok-123" }, env)).toThrow(
      /iki büyük harf/,
    );
    expect(() => reassignRelyingPartyOut(s, "rp.example", { toState: "KZ", approval: "ok-123" }, env)).toThrow(
      /iptal edilmemiş/,
    );
    expect(() => reassignRelyingPartyOut(tr, "yok.example", { toState: "KZ", approval: "ok-123" }, env)).toThrow(
      RegistryError,
    );
  });

  it("REVOKED son durumdur (zincirdeki AlreadyRevoked ile aynı): geri dönüş yok; yalnız kurumda ele geçirilme tarihi eklenir", () => {
    const rev = setIssuerStatus(src(), "ornek", "REVOKED", { reason: "r" }, env);
    for (const to of ["ACTIVE", "SUSPENDED", "RETIRED"])
      expect(() => setIssuerStatus(rev, "ornek", to, {}, env)).toThrow(/geri çekilmiş/);
    const esc = setIssuerStatus(rev, "ornek", "REVOKED", { invalidatesFrom: "2026-09-30T00:00:00Z" }, env);
    expect(esc.issuers[0].status_history.at(-1)).toMatchObject({
      status: "REVOKED",
      invalidates_from: "2026-09-30T00:00:00Z",
    });
    const rrev = setRpStatus(src(), "rp.example", "REVOKED", {}, env);
    for (const to of ["ACTIVE", "SUSPENDED", "RETIRED"])
      expect(() => setRpStatus(rrev, "rp.example", to, {}, env)).toThrow(/geri çekilmiş/);
  });

  it("RETIRED yalnız REVOKED'a; ACTIVE'e yalnız SUSPENDED'dan; askı yalnız ACTIVE'ten", () => {
    const ret = setIssuerStatus(src(), "ornek", "RETIRED", {}, env);
    expect(() => setIssuerStatus(ret, "ornek", "ACTIVE", {}, env)).toThrow(/RETIRED/);
    expect(() => setIssuerStatus(ret, "ornek", "SUSPENDED", {}, env)).toThrow(/RETIRED/);
    expect(setIssuerStatus(ret, "ornek", "REVOKED", {}, env).issuers[0].status).toBe("REVOKED");
    const sus = setIssuerStatus(src(), "ornek", "SUSPENDED", {}, env);
    expect(setIssuerStatus(sus, "ornek", "ACTIVE", {}, env).issuers[0].status).toBe("ACTIVE");
    const rsus = setRpStatus(src(), "rp.example", "SUSPENDED", {}, env);
    expect(setRpStatus(rsus, "rp.example", "ACTIVE", {}, env).relying_parties[0].status).toBe("ACTIVE");
  });

  it("tek kullanım / kapı grubu sona erer; diğerleri ve kayıt aynen kalır", () => {
    let s = endRpUse(src(), "rp.example", "a-1", env);
    s = endRpUse(s, "rp.example", "kapi", env);
    const rp = s.relying_parties[0];
    expect(rp.scopes.map((x: { valid_until: string }) => x.valid_until)).toEqual([NOW, "2027-09-24T00:00:00Z"]);
    expect((rp.terminal_groups[0] as { valid_until?: string }).valid_until).toBe(NOW);
    expect(() => endRpUse(s, "rp.example", "a-1", env)).toThrow(/zaten sona ermiş/);
    expect(() => endRpUse(s, "rp.example", "yok", env)).toThrow(/yok/);
  });
});

type Hist = { status: string; since: string; invalidates_from?: string };
type Src = {
  issuers: Array<{
    slug: string;
    status: string;
    valid_from: string;
    status_history: Hist[];
    schema_authorizations: Array<{ allowed: boolean; valid_until: string | null }>;
  }>;
  relying_parties: Array<{
    dns_name: string;
    status: string;
    scopes: Array<{ scope_id: string; valid_until: string }>;
    terminal_groups?: Array<{ group_id: string; valid_until?: string }>;
  }>;
};
const read = (dir: string) =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, "..", dir, "tl-tr.source.json"), "utf8")) as Src;
const DEMO_SCOPES = [
  "job-application-1",
  "student-discount-1",
  "campus-access-1",
  "event-tamga-id-1",
  "event-ticket-1",
  "car-rental-driving-1",
];

describe("gerçek ağ kayıt defteri: test/demo kurumu yok (2026-10-04)", () => {
  const prod = read("registry");
  // 2026-10-04: sınama döneminin örnek kurumları REVOKED yapıldı (bütün belgeleri geçersiz). 2026-11-11: proje yönetimi kararıyla
  // bu test kayıtları gerçek listeden çıkarıldı (onaylı çıkarma kaydı registry/removals.json; denetim removals.test.ts). Eski
  // liste sürümleri arşivde durur.
  it("gerçek listede sınama döneminin örnek kurumları yok; kalan tek belge veren ağın kimlik servisi (ACTIVE)", () => {
    expect(prod.issuers.map((i) => [i.slug, i.status])).toEqual([["tamga-id", "ACTIVE"]]);
    expect(prod.issuers.every((i) => i.status_history[0].status === "ACTIVE")).toBe(true);
  });
  it("örnek kurumun eşleştirme doğrulayıcısı listede yok; Tamga Verify'ın kurgusal kullanımları sona erdi, kapı grubu yok", () => {
    expect(prod.relying_parties.map((r) => r.dns_name)).toEqual(["verify.tamga.network"]);
    const v = prod.relying_parties.find((r) => r.dns_name === "verify.tamga.network")!;
    expect(v.status).toBe("ACTIVE");
    const now = Date.now();
    const open = v.scopes.filter((s) => Date.parse(s.valid_until) > now).map((s) => s.scope_id);
    for (const d of DEMO_SCOPES) expect(open).not.toContain(d);
    expect(open).toEqual(expect.arrayContaining(["age-over-18-1", "site-signup-1"]));
    expect((v.terminal_groups ?? []).every((g) => g.valid_until && Date.parse(g.valid_until) <= now)).toBe(true);
  });
  it("sandbox listesi aynı senaryoları taşır (örnek kurumlar + kurgusal kullanımlar ACTIVE)", () => {
    const sb = read("registry-sandbox");
    const active = sb.issuers.filter((i) => i.status === "ACTIVE").map((i) => i.slug);
    expect(active).toEqual(
      expect.arrayContaining(["example-university", "example-events", "example-cinema", "tamga-id-review"]),
    );
    const v = sb.relying_parties.find((r) => r.dns_name === "verify.sandbox.tamga.network")!;
    const ids = v.scopes.filter((s) => Date.parse(s.valid_until) > Date.now()).map((s) => s.scope_id);
    expect(ids).toEqual(expect.arrayContaining(DEMO_SCOPES));
  });
});
