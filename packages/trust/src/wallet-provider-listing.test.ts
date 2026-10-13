/** ADR-0049: "Tamga Network'te listeli" göstergesinin kaynağı — imzalı listedeki `wallet_providers[]` kaydı ve gizleme koşulları. */
import { describe, it, expect } from "vitest";
import { ListTrustSource, TrustStore, type Lotl } from "./index.js";

const NOW = new Date("2026-10-13T12:00:00Z");
const FP = "ab".repeat(32);
function source(
  o: { environment?: string; status?: string; solution?: string; healthy?: boolean; keyStatus?: string } = {},
) {
  const store = new TrustStore();
  store.lotl = {
    version: 42,
    issued_at: "2026-10-13T00:00:00Z",
    ...(o.environment ? { environment: o.environment } : {}),
    wallet_providers: [
      {
        provider_id: "TAMGA-WP-1",
        legal_name: "Örnek Sağlayıcı Ltd.",
        status: o.status ?? "ACTIVE",
        wua_signing_keys: [
          { fingerprint_sha256: "cd".repeat(32), status: "REVOKED" },
          { fingerprint_sha256: FP, status: o.keyStatus ?? "ACTIVE" },
        ],
        solutions: [
          {
            solution_id: "tamga-wallet-expo",
            status: o.solution ?? "ACTIVE",
            security_level: "W2",
            min_version: "1.0.0",
          },
        ],
      },
    ],
  } as unknown as Lotl;
  store.setFreshness({ healthy: o.healthy ?? true } as never);
  return new ListTrustSource(store, () => NOW);
}

describe("walletProviderListing (ADR-0049)", () => {
  it("listeli: kayıt + çözüm ACTIVE, gerçek ağ, taze liste → resmî ad, durum, etkin anahtar parmak izi, liste zamanı", () => {
    expect(source().walletProviderListing("TAMGA-WP-1", { solutionId: "tamga-wallet-expo" })).toEqual({
      listed: true,
      provider_id: "TAMGA-WP-1",
      status: "ACTIVE",
      legal_name: "Örnek Sağlayıcı Ltd.",
      fingerprint: FP,
      solution: { solution_id: "tamga-wallet-expo", status: "ACTIVE", security_level: "W2", min_version: "1.0.0" },
      list_issued_at: "2026-10-13T00:00:00Z",
      list_version: 42,
    });
  });

  it("K3: gizlenir — sağlayıcı ACTIVE değil, çözüm yok / ACTIVE değil, birim iptal, sandbox, bayat liste, kayıt yok", () => {
    const h = (s: ListTrustSource, opts?: Parameters<ListTrustSource["walletProviderListing"]>[1]) =>
      s.walletProviderListing("TAMGA-WP-1", { solutionId: "tamga-wallet-expo", ...opts });
    expect(h(source({ status: "SUSPENDED" }))).toMatchObject({
      listed: false,
      hidden: "provider_not_active",
      status: "SUSPENDED",
    });
    expect(h(source({ status: "RESERVED" }))).toMatchObject({ listed: false, hidden: "provider_not_active" });
    expect(h(source({ solution: "REVOKED" }))).toMatchObject({ listed: false, hidden: "solution_not_active" });
    expect(h(source(), { solutionId: "other" })).toMatchObject({ listed: false, hidden: "solution_not_listed" });
    expect(h(source(), { unitRevoked: true })).toMatchObject({
      listed: false,
      hidden: "unit_revoked",
      legal_name: "Örnek Sağlayıcı Ltd.",
    });
    expect(h(source({ environment: "sandbox" }))).toMatchObject({ listed: false, hidden: "sandbox" });
    expect(h(source({ healthy: false }))).toMatchObject({
      listed: false,
      hidden: "list_unavailable",
      legal_name: null,
    });
    expect(source().walletProviderListing("NOPE")).toMatchObject({ listed: false, hidden: "not_listed", status: null });
    // etkin anahtarı yoksa parmak izi null (kayıt yine okunur)
    expect(source({ keyStatus: "REVOKED" }).walletProviderListing("TAMGA-WP-1").fingerprint).toBeNull();
  });
});
