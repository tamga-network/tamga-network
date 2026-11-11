/**
 * ADR-0075: `fetchRpRecord` güven kaynağının cevabını olduğu gibi kullanır — kaynak belirsiz ad için null dönerse (iki arama
 * yolunda da; kural 0.8.3'ten beri `ListTrustSource`'un içinde) kayıt yok sayılır. Bu test kaynağı ELLE kurulmuş çok listeli bir
 * depoyla değiştirir: `fetchRpRecord`'un kendisi LOTL + TEK ülke listesi yükler, bu yüzden sahada cüzdan başka ülkenin listesindeki
 * kaydı göremez (belgelenmiş kapsam; gerçek yükleyiciyle iki imzalı liste: apps/chain-indexer/test/rp-ambiguity-fetch.test.ts).
 */
import { describe, expect, it, vi } from "vitest";
import { ListTrustSource, RelyingParty, TrustStore } from "@tamga-network/trust/core";

const NOW = new Date("2026-11-05T12:00:00Z");
const DNS = "verify.example";
let current: ListTrustSource | null = null;

vi.mock("./trustlist.js", async (orig) => ({
  ...(await orig<typeof import("./trustlist.js")>()),
  fetchTrustSource: async () => ({ source: current!, lists: {} }),
}));
const { fetchRpRecord } = await import("./oid4vp.js");

type H = { status: string; since: string; reason?: string; reassigned_to?: string };
const ACTIVE0: H = { status: "ACTIVE", since: "2026-01-01T00:00:00Z" };
function rp(status: string, history: H[], client: string, dns = DNS) {
  return RelyingParty.parse({
    rp_id: `rp-${client}`,
    client_id: `x509_hash:${client.repeat(43)}`,
    dns_name: dns,
    legal_name: dns,
    access_cert_fingerprint_sha256: "b".repeat(64),
    status,
    registered_at: "2026-01-01T00:00:00Z",
    scopes: [],
    status_history: history,
  });
}
const revoked = (to?: string): H => ({
  status: "REVOKED",
  since: "2026-06-01T00:00:00Z",
  reason: to ? `reassignment to ${to} (approval reassign-1)` : "registration ended",
  ...(to ? { reassigned_to: to } : {}),
});
function load(lists: Array<[string, RelyingParty]>) {
  const store = new TrustStore();
  for (const [cc, r] of lists)
    store.applyNationalList(
      { state_code: cc, root_cas: [], issuers: [], relying_parties: [r], national_schemas: [] } as never,
      "",
    );
  store.setFreshness({ source: "list", healthy: true, lotlVersion: 1, anchorsSeq: 1, loadedAt: NOW });
  current = new ListTrustSource(store, () => NOW);
}
const get = (clientId: string) => fetchRpRecord("https://trust.test", clientId, {} as never, { lotlSigners: ["00"] });

describe("fetchRpRecord — ülkeler arası ad belirsizliği (ADR-0075, x509_hash yolu)", () => {
  const tr = rp("ACTIVE", [ACTIVE0], "T");
  const az = rp("ACTIVE", [ACTIVE0], "A");

  it("tek ülke listesi → kayıt döner (iki yol da)", async () => {
    load([["TR", tr]]);
    expect((await get(tr.client_id))?.client_id).toBe(tr.client_id);
    expect((await get(DNS))?.client_id).toBe(tr.client_id);
  });

  it("aynı ad iki ülkede ACTIVE → istemci kimliğiyle de null (kapalı güvenli)", async () => {
    load([
      ["TR", tr],
      ["AZ", az],
    ]);
    expect(await get(tr.client_id)).toBeNull();
    expect(await get(az.client_id)).toBeNull();
    expect(await get(DNS)).toBeNull();
  });

  it("devir kaydı olmadan eski ülkede REVOKED + yeni ülkede ACTIVE → null", async () => {
    load([
      ["TR", rp("REVOKED", [ACTIVE0, revoked()], "T")],
      ["AZ", az],
    ]);
    expect(await get(az.client_id)).toBeNull();
  });

  it("yapılı devir kaydı (reassigned_to) → yeni ülkenin kaydı döner", async () => {
    load([
      ["TR", rp("REVOKED", [ACTIVE0, revoked("AZ")], "T")],
      ["AZ", az],
    ]);
    expect((await get(az.client_id))?.client_id).toBe(az.client_id);
    expect((await get(DNS))?.client_id).toBe(az.client_id);
  });

  it("başka bir adın belirsizliği bu kaydı etkilemez", async () => {
    const other = rp("ACTIVE", [ACTIVE0], "X", "other.example");
    const store = new TrustStore();
    store.applyNationalList(
      { state_code: "TR", root_cas: [], issuers: [], relying_parties: [tr, other], national_schemas: [] } as never,
      "",
    );
    store.applyNationalList(
      { state_code: "AZ", root_cas: [], issuers: [], relying_parties: [az], national_schemas: [] } as never,
      "",
    );
    store.setFreshness({ source: "list", healthy: true, lotlVersion: 1, anchorsSeq: 1, loadedAt: NOW });
    current = new ListTrustSource(store, () => NOW);
    expect((await get(other.client_id))?.client_id).toBe(other.client_id);
    expect(await get(tr.client_id)).toBeNull();
  });
});
