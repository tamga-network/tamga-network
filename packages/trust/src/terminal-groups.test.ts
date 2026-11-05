/**
 * ADR-0069 (ADR-0012 K5): doğrulayıcı kaydındaki `terminal_groups[]` — şema ve `TrustSource.terminalGroup` okuyucusu.
 *  - grup kaydı ADR-0069 alanlarıyla okunur; eski (kurumsuz) kayıt da yüklenir
 *  - etkin / geri çekilmiş / doğrulayıcısı ACTIVE olmayan grup `active` ile ayrılır
 *  - bayat listede cevap yok (BT5); sertifika parmak izinden yalnız etkin grup döner
 */
import { describe, it, expect } from "vitest";
import { ListTrustSource, RelyingParty, TerminalGroup, TrustStore, type Issuer } from "./index.js";

const NOW = new Date("2026-10-29T12:00:00Z");
const FP = "a".repeat(64);

function rp(dns: string, status: string, groups: unknown[]) {
  return RelyingParty.parse({
    rp_id: `rp-${dns}`,
    client_id: `x509_hash:${"A".repeat(43)}`,
    dns_name: dns,
    legal_name: dns,
    access_cert_fingerprint_sha256: "b".repeat(64),
    status,
    registered_at: "2026-01-01T00:00:00Z",
    scopes: [],
    status_history: [],
    terminal_groups: groups,
  });
}

function source(
  rps: ReturnType<typeof rp>[],
  healthy = true,
  issuers: Array<{ slug: string; status: string }> = [{ slug: "example-events", status: "ACTIVE" }], // grubun kurumu listede (K12)
) {
  const store = new TrustStore();
  for (const r of rps) store.relying_parties_by_dns.set(r.dns_name, r);
  for (const i of issuers) store.issuers.set(`iss-${i.slug}`, i as unknown as Issuer);
  store.setFreshness({ source: "list", healthy, lotlVersion: 1, anchorsSeq: 1, loadedAt: NOW });
  return new ListTrustSource(store, () => NOW);
}

describe("ADR-0069 terminal_groups", () => {
  const gate = {
    group_id: "example-events-gate",
    institution_id: "example-events",
    label: "Event gates",
    allowed_policies: ["event-ticket"],
    cert_fingerprints: [FP],
    offline_allowed: false,
    valid_from: "2026-10-01T00:00:00Z",
  };

  it("şema: ADR-0069 alanları; eski kayıt (kurum ve politika yok) da geçer; bozuk grup kimliği reddedilir", () => {
    expect(TerminalGroup.parse(gate).institution_id).toBe("example-events");
    expect(TerminalGroup.safeParse({ group_id: "old-gate", valid_from: "2026-01-01T00:00:00Z" }).success).toBe(true);
    expect(TerminalGroup.safeParse({ ...gate, group_id: "Büyük Kapı" }).success).toBe(false);
    expect(TerminalGroup.safeParse({ ...gate, cert_fingerprints: ["XYZ"] }).success).toBe(false);
    expect(TerminalGroup.safeParse({ ...gate, allowed_policies: ["<script>"] }).success).toBe(false);
  });

  it("etkin grup: kurum, politika ve doğrulayıcı kimliğiyle döner", () => {
    const ts = source([rp("verify.sandbox.tamga.network", "ACTIVE", [gate])]);
    const a = ts.terminalGroup("example-events-gate");
    expect(a).toMatchObject({ rp_dns_name: "verify.sandbox.tamga.network", active: true });
    expect(a?.group.allowed_policies).toEqual(["event-ticket"]);
    expect(ts.terminalGroup("yok")).toBeNull();
  });

  it("geri çekilmiş grup, henüz başlamamış grup ve ACTIVE olmayan doğrulayıcı → active: false", () => {
    const ts = source([
      rp("verify.tamga.network", "ACTIVE", [
        { ...gate, valid_until: "2026-10-04T00:00:00Z" },
        { ...gate, group_id: "future-gate", valid_from: "2027-01-01T00:00:00Z" },
      ]),
      rp("old.example", "SUSPENDED", [{ ...gate, group_id: "susp-gate" }]),
    ]);
    expect(ts.terminalGroup("example-events-gate")?.active).toBe(false);
    expect(ts.terminalGroup("future-gate")?.active).toBe(false);
    expect(ts.terminalGroup("susp-gate")?.active).toBe(false);
  });

  it("K12 (kontrol 2026-11-03): grubun kurumu listede ACTIVE değilse (REVOKED belge veren, SUSPENDED doğrulayıcı, listede yok) grup etkin değil; kurumsuz eski grup doğrulayıcıyla değerlendirilir", () => {
    const rps = [
      rp("verify.tamga.network", "ACTIVE", [
        gate, // example-events
        { ...gate, group_id: "example-university-gate", institution_id: "example-university" },
        { ...gate, group_id: "susp-rp-gate", institution_id: "susp.example" },
        { ...gate, group_id: "ghost-gate", institution_id: "yok-boyle" },
        { ...gate, group_id: "self-gate", institution_id: "verify.tamga.network" },
        { group_id: "legacy-gate", valid_from: "2026-01-01T00:00:00Z" },
      ]),
      rp("susp.example", "SUSPENDED", []),
    ];
    const ts = source(rps, true, [
      { slug: "example-events", status: "ACTIVE" },
      { slug: "example-university", status: "REVOKED" },
    ]);
    expect(ts.terminalGroup("example-events-gate")?.active).toBe(true);
    expect(ts.terminalGroup("example-university-gate")?.active).toBe(false); // kurum geri çekildi → kapı kapanır
    expect(ts.terminalGroup("susp-rp-gate")?.active).toBe(false);
    expect(ts.terminalGroup("ghost-gate")?.active).toBe(false);
    expect(ts.terminalGroup("self-gate")?.active).toBe(true);
    expect(ts.terminalGroup("legacy-gate")?.active).toBe(true);
    // aynı parmak izi birden çok ETKİN grupta (example-events, self, legacy): hangi kapı olduğu belirsiz → null (2026-11-04)
    expect(ts.terminalGroupByCertFingerprint(FP)).toBeNull();
    // kurum geri çekilmemiş olsaydı aynı grup etkin olurdu
    const ok = source(rps, true, [{ slug: "example-university", status: "ACTIVE" }]);
    expect(ok.terminalGroup("example-university-gate")?.active).toBe(true);
  });

  it("sertifika parmak izi → yalnız etkin grup (hazırlık); bayat listede hiç cevap yok", () => {
    const ts = source([rp("verify.tamga.network", "ACTIVE", [gate])]);
    expect(ts.terminalGroupByCertFingerprint(FP.toUpperCase())?.group.group_id).toBe("example-events-gate");
    expect(ts.terminalGroupByCertFingerprint("c".repeat(64))).toBeNull();
    const stale = source([rp("verify.tamga.network", "ACTIVE", [gate])], false);
    expect(stale.terminalGroup("example-events-gate")).toBeNull();
    expect(stale.terminalGroupByCertFingerprint(FP)).toBeNull();
  });

  it("2026-11-04: aynı group_id iki doğrulayıcı kaydında (iki ülke listesi) ya da kurumun slug'ı iki belge veren kaydında → kapı kapalı", () => {
    // aynı grup kimliği TR ve AZ listesindeki iki doğrulayıcıda: hangisinin kapısı belirsiz → null
    const dup = source([rp("verify.tamga.network", "ACTIVE", [gate]), rp("verify.az.example", "ACTIVE", [gate])]);
    expect(dup.terminalGroup("example-events-gate")).toBeNull();
    // grubun kurumu (slug) iki ülke listesindeki iki belge verende aynı: kurum belirsiz → grup etkin değil
    const store = new TrustStore();
    store.relying_parties_by_dns.set("verify.tamga.network", rp("verify.tamga.network", "ACTIVE", [gate]));
    store.issuers.set("iss-tr", { slug: "example-events", status: "ACTIVE" } as unknown as Issuer);
    store.issuers.set("iss-az", { slug: "example-events", status: "ACTIVE" } as unknown as Issuer);
    store.setFreshness({ source: "list", healthy: true, lotlVersion: 1, anchorsSeq: 1, loadedAt: NOW });
    const ambiguous = new ListTrustSource(store, () => NOW);
    expect(ambiguous.terminalGroup("example-events-gate")?.active).toBe(false);
    expect(ambiguous.terminalGroupByCertFingerprint(FP)).toBeNull();
  });

  it("2026-11-04: parmak izi yalnız bir etkin grupta → o grup (geri çekilmiş eski grup belirsizlik saymaz); iki etkin grupta → null", () => {
    const rotated = source([
      rp("verify.tamga.network", "ACTIVE", [
        { ...gate, group_id: "old-gate", valid_until: "2026-10-04T00:00:00Z" },
        { ...gate, group_id: "new-gate" },
      ]),
    ]);
    expect(rotated.terminalGroupByCertFingerprint(FP)?.group.group_id).toBe("new-gate");
    const twice = source([rp("verify.tamga.network", "ACTIVE", [gate, { ...gate, group_id: "second-gate" }])]);
    expect(twice.terminalGroupByCertFingerprint(FP)).toBeNull();
  });

  it("2026-11-04: aynı dns_name iki ülke listesinde → doğrulayıcı belirsiz (null, grupları etkin değil); slug ülkeyle nitelenir", () => {
    const iss = (id: string, slug: string, status = "ACTIVE") => ({ issuer_id: id, slug, status }) as unknown as Issuer;
    // TR listesindeki doğrulayıcının kapı grubu; aynı slug AZ listesinde de var → yalnız TR'deki sayılır
    const store = new TrustStore();
    store.relying_parties_by_dns.set("verify.tamga.network", rp("verify.tamga.network", "ACTIVE", [gate]));
    store.relying_party_states.set("verify.tamga.network", new Set(["TR"]));
    store.issuers.set("iss-tr", iss("iss-tr", "example-events"));
    store.issuers.set("iss-az", iss("iss-az", "example-events", "REVOKED"));
    store.issuer_states.set("iss-tr", "TR");
    store.issuer_states.set("iss-az", "AZ");
    store.setFreshness({ source: "list", healthy: true, lotlVersion: 1, anchorsSeq: 1, loadedAt: NOW });
    const ts = new ListTrustSource(store, () => NOW);
    expect(ts.terminalGroup("example-events-gate")?.active).toBe(true);
    expect(ts.terminalGroupByCertFingerprint(FP)?.group.group_id).toBe("example-events-gate");
    expect(ts.relyingPartyByDnsName("verify.tamga.network")?.dns_name).toBe("verify.tamga.network");
    // TR'deki kurum geri çekilirse AZ'deki aynı slug kapıyı açmaz
    store.issuers.set("iss-tr", iss("iss-tr", "example-events", "REVOKED"));
    store.issuers.set("iss-az", iss("iss-az", "example-events"));
    expect(ts.terminalGroup("example-events-gate")?.active).toBe(false);
    // aynı dns_name iki listede: belirsiz
    store.issuers.set("iss-tr", iss("iss-tr", "example-events"));
    store.relying_party_states.set("verify.tamga.network", new Set(["TR", "AZ"]));
    expect(ts.relyingPartyByDnsName("verify.tamga.network")).toBeNull();
    expect(ts.terminalGroup("example-events-gate")?.active).toBe(false);
    expect(ts.terminalGroupByCertFingerprint(FP)).toBeNull();
  });

  it("ADR-0075 devir: eski ülke listesinde REVOKED, yenide ACTIVE → belirsiz değil, yeni kayıt (grupları etkin, kurum yeni ülkede)", () => {
    const store = new TrustStore();
    const list = (cc: string, rps: ReturnType<typeof rp>[], issuers: Array<Record<string, unknown>> = []) =>
      ({ state_code: cc, root_cas: [], issuers, relying_parties: rps, national_schemas: [] }) as never;
    const old = {
      ...rp("verify.tamga.network", "REVOKED", [{ ...gate, group_id: "old-gate" }]),
      client_id: "x509_hash:old",
      // makinece okunur devir kaydı (0.8.1): yükleyici AZ'deki kaydı yalnız bununla alır (ayrıntı rp-reassignment.test.ts)
      status_history: [
        {
          status: "REVOKED" as const,
          since: "2026-06-01T00:00:00Z",
          reason: "reassignment to AZ (approval r-1)",
          reassigned_to: "AZ",
        },
      ],
    };
    const moved = { ...rp("verify.tamga.network", "ACTIVE", [gate]), client_id: "x509_hash:new" };
    const issAz = { issuer_id: "iss-az", slug: "example-events", status: "ACTIVE", schema_authorizations: [] };
    const issTr = { issuer_id: "iss-tr", slug: "example-events", status: "REVOKED", schema_authorizations: [] };
    store.applyNationalList(list("TR", [old], [issTr]), "");
    store.applyNationalList(list("AZ", [moved], [issAz]), "");
    store.setFreshness({ source: "list", healthy: true, lotlVersion: 1, anchorsSeq: 1, loadedAt: NOW });
    const ts = new ListTrustSource(store, () => NOW);
    expect(store.relyingPartyAmbiguous("verify.tamga.network")).toBe(false);
    expect(store.relyingPartyStateOf("verify.tamga.network")).toBe("AZ");
    expect(ts.relyingPartyByDnsName("verify.tamga.network")?.status).toBe("ACTIVE");
    // grubun kurumu yeni ülkenin listesindeki slug (TR'deki aynı slug geri çekilmiş olsa da)
    expect(ts.terminalGroup("example-events-gate")?.active).toBe(true);
    // eski kaydın grupları seçilen kayıtta değil
    expect(ts.terminalGroup("old-gate")).toBeNull();
    // iki liste de ACTIVE kalırsa belirsiz (kapalı güvenli)
    const both = new TrustStore();
    both.applyNationalList(list("TR", [{ ...old, status: "ACTIVE" }]), "");
    both.applyNationalList(list("AZ", [moved]), "");
    both.setFreshness({ source: "list", healthy: true, lotlVersion: 1, anchorsSeq: 1, loadedAt: NOW });
    expect(new ListTrustSource(both, () => NOW).relyingPartyByDnsName("verify.tamga.network")).toBeNull();
    // hepsi iptal edilmişse belirsiz değil: durumu en son değişen kayıt (REVOKED)
    const gone = new TrustStore();
    gone.applyNationalList(list("TR", [old]), "");
    gone.applyNationalList(list("AZ", [{ ...moved, status: "REVOKED" }]), "");
    gone.setFreshness({ source: "list", healthy: true, lotlVersion: 1, anchorsSeq: 1, loadedAt: NOW });
    expect(new ListTrustSource(gone, () => NOW).relyingPartyByDnsName("verify.tamga.network")?.status).toBe("REVOKED");
  });
});
