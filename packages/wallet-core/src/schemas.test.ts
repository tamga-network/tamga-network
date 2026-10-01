/** B4 şema kataloğu çekimi — başarı, HTTP hatası, bozuk gövde (katalog yoksa B4 atlanır, neden bildirilir). */
import { describe, it, expect } from "vitest";
import { fetchCatalogueHash } from "./schemas.js";
import type { Http } from "./http.js";

const http =
  (status: number, body: string, seen: string[] = []): Http =>
  async (url) => {
    seen.push(url);
    return { status, text: async () => body };
  };

describe("fetchCatalogueHash", () => {
  it("katalogu çeker, vct → content_hash eşler", async () => {
    const seen: string[] = [];
    let loaded = -1;
    const body = JSON.stringify([
      { vct: "urn:tamga:edu:StudentCredential:1", content_hash: "sha256-aaa" },
      { vct: "urn:tamga:events:Ticket:1", content_hash: "sha256-bbb", content_hashes: ["sha256-old", "sha256-bbb"] },
    ]);
    const h = await fetchCatalogueHash({
      schemasBase: "http://s.example/",
      http: http(200, body, seen),
      onLoaded: (n) => (loaded = n),
    });
    expect(seen).toEqual(["http://s.example/v1/index.json"]);
    expect(loaded).toBe(2);
    expect(h?.("urn:tamga:edu:StudentCredential:1")).toEqual(["sha256-aaa"]);
    // ADR-0010 K4: eski sürümün belgesi de geçerli
    expect(h?.("urn:tamga:events:Ticket:1")).toEqual(["sha256-old", "sha256-bbb"]);
    expect(h?.("urn:tamga:x:Unknown:1")).toBeUndefined();
  });

  it("HTTP hatasında undefined döner ve nedeni bildirir", async () => {
    let err = "";
    const h = await fetchCatalogueHash({ http: http(503, ""), onError: (m) => (err = m) });
    expect(h).toBeUndefined();
    expect(err).toContain("503");
  });

  it("dizi olmayan ya da bozuk gövdeyi reddeder", async () => {
    const errs: string[] = [];
    expect(await fetchCatalogueHash({ http: http(200, "{}"), onError: (m) => errs.push(m) })).toBeUndefined();
    expect(await fetchCatalogueHash({ http: http(200, "<html>"), onError: (m) => errs.push(m) })).toBeUndefined();
    expect(errs).toHaveLength(2);
  });
});
