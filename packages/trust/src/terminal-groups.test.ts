/**
 * ADR-0069 (ADR-0012 K5): doğrulayıcı kaydındaki `terminal_groups[]` — şema ve `TrustSource.terminalGroup` okuyucusu.
 *  - grup kaydı ADR-0069 alanlarıyla okunur; eski (kurumsuz) kayıt da yüklenir
 *  - etkin / geri çekilmiş / doğrulayıcısı ACTIVE olmayan grup `active` ile ayrılır
 *  - bayat listede cevap yok (BT5); sertifika parmak izinden yalnız etkin grup döner
 */
import { describe, it, expect } from "vitest";
import { ListTrustSource, RelyingParty, TerminalGroup, TrustStore } from "./index.js";

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

function source(rps: ReturnType<typeof rp>[], healthy = true) {
  const store = new TrustStore();
  for (const r of rps) store.relying_parties_by_dns.set(r.dns_name, r);
  store.setFreshness({ source: "list", healthy, lotlVersion: 1, anchorsSeq: 1, loadedAt: NOW });
  return new ListTrustSource(store, () => NOW);
}

describe("ADR-0069 terminal_groups", () => {
  const gate = {
    group_id: "bubilet-gate",
    institution_id: "bubilet",
    label: "Event gates",
    allowed_policies: ["event-ticket"],
    cert_fingerprints: [FP],
    offline_allowed: false,
    valid_from: "2026-10-01T00:00:00Z",
  };

  it("şema: ADR-0069 alanları; eski kayıt (kurum ve politika yok) da geçer; bozuk grup kimliği reddedilir", () => {
    expect(TerminalGroup.parse(gate).institution_id).toBe("bubilet");
    expect(TerminalGroup.safeParse({ group_id: "old-gate", valid_from: "2026-01-01T00:00:00Z" }).success).toBe(true);
    expect(TerminalGroup.safeParse({ ...gate, group_id: "Büyük Kapı" }).success).toBe(false);
    expect(TerminalGroup.safeParse({ ...gate, cert_fingerprints: ["XYZ"] }).success).toBe(false);
    expect(TerminalGroup.safeParse({ ...gate, allowed_policies: ["<script>"] }).success).toBe(false);
  });

  it("etkin grup: kurum, politika ve doğrulayıcı kimliğiyle döner", () => {
    const ts = source([rp("verify.sandbox.tamga.network", "ACTIVE", [gate])]);
    const a = ts.terminalGroup("bubilet-gate");
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
    expect(ts.terminalGroup("bubilet-gate")?.active).toBe(false);
    expect(ts.terminalGroup("future-gate")?.active).toBe(false);
    expect(ts.terminalGroup("susp-gate")?.active).toBe(false);
  });

  it("sertifika parmak izi → yalnız etkin grup (hazırlık); bayat listede hiç cevap yok", () => {
    const ts = source([rp("verify.tamga.network", "ACTIVE", [gate])]);
    expect(ts.terminalGroupByCertFingerprint(FP.toUpperCase())?.group.group_id).toBe("bubilet-gate");
    expect(ts.terminalGroupByCertFingerprint("c".repeat(64))).toBeNull();
    const stale = source([rp("verify.tamga.network", "ACTIVE", [gate])], false);
    expect(stale.terminalGroup("bubilet-gate")).toBeNull();
    expect(stale.terminalGroupByCertFingerprint(FP)).toBeNull();
  });
});
