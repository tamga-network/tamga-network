/**
 * 0.8.3 ikinci inceleme — güven listesi okuyucusu:
 *  - ADR-0075 RO5: aynı ülke listesinde aynı `dns_name` iki kayıtta → ad belirsiz (ikinci kayıt birinciyi sessizce ezmez);
 *    `dns_name` biçimi: sonda nokta, baştaki nokta, boş etiket yok.
 *  - ADR-0036 FD3: LOTL'da ETKİN ama yüklenememiş dış listeye bağlı sorular UNKNOWN (NO / null değil); Tamga soruları etkilenmez.
 *  - ADR-0036 FD2: dış kurumun iptal hizmeti sertifikası yalnız aynı roldeki (kapsamdaki) belge verme hizmetine bağlanır.
 */
import { describe, expect, it } from "vitest";
import {
  ExternalListPointer,
  ListTrustSource,
  RelyingParty,
  TrustStore,
  type ExternalEntityKind,
  type ParsedLote,
} from "./index.js";

const NOW = new Date("2026-11-11T12:00:00Z");
const fresh = (store: TrustStore) => {
  store.setFreshness({ source: "list", healthy: true, lotlVersion: 1, anchorsSeq: 1, loadedAt: NOW });
  return new ListTrustSource(store, () => NOW);
};

describe("ADR-0075 RO5: aynı listede yinelenen dns_name", () => {
  const rp = (client: string, dns = "shop.example") =>
    RelyingParty.parse({
      rp_id: `rp-${client}`,
      client_id: `x509_hash:${client.repeat(43)}`,
      dns_name: dns,
      legal_name: `Kurum ${client}`,
      access_cert_fingerprint_sha256: "b".repeat(64),
      status: "ACTIVE",
      registered_at: "2026-01-01T00:00:00Z",
      scopes: [],
      status_history: [{ status: "ACTIVE", since: "2026-01-01T00:00:00Z" }],
    });
  const list = (rps: RelyingParty[]) =>
    ({ state_code: "TR", root_cas: [], issuers: [], relying_parties: rps, national_schemas: [] }) as never;

  it("iki kayıt aynı adı taşıyorsa ad belirsizdir: alan adıyla da istemci kimliğiyle de null", () => {
    const store = new TrustStore();
    const a = rp("A");
    const b = rp("B");
    store.applyNationalList(list([a, b, rp("C", "other.example")]), "");
    const ts = fresh(store);
    expect(store.relyingPartyAmbiguous("shop.example")).toBe(true);
    expect(store.relyingPartyStateOf("shop.example")).toBeUndefined();
    expect(ts.relyingPartyByDnsName("shop.example")).toBeNull();
    expect(ts.relyingParty(a.client_id)).toBeNull();
    expect(ts.relyingParty(b.client_id)).toBeNull();
    // listenin geri kalanı etkilenmez
    expect(ts.relyingPartyByDnsName("other.example")?.legal_name).toBe("Kurum C");
  });

  it("tek kayıt: belirsiz değil", () => {
    const store = new TrustStore();
    store.applyNationalList(list([rp("A")]), "");
    expect(store.relyingPartyAmbiguous("shop.example")).toBe(false);
    expect(fresh(store).relyingPartyByDnsName("shop.example")?.legal_name).toBe("Kurum A");
  });

  it("ad biçimi: sonda nokta, baştaki nokta, boş etiket ve büyük harf liste şemasında reddedilir", () => {
    for (const bad of [
      "shop.example.",
      ".shop.example",
      "shop..example",
      "Shop.example",
      "-shop.example",
      "shop-.example",
    ])
      expect(() => rp("A", bad), bad).toThrow();
    for (const ok of ["shop.example", "a.b-c.example", "xn--bcher-kva.example", "localhost"])
      expect(rp("A", ok).dns_name).toBe(ok);
  });
});

describe("ADR-0036 FD3 / FD2: dış listeler", () => {
  const pointer = (id: string, kinds: ExternalEntityKind[], vct?: string[]) =>
    ExternalListPointer.parse({
      list_id: id,
      territory: "DE",
      format: "etsi-lote-json",
      list_url: `https://lists.example/${id}.jws`,
      signing_keys: [{ fingerprint_sha256: "a".repeat(64) }],
      operator: { name: "Example operator" },
      status: "ACTIVE",
      scope: { entity_kinds: kinds, ...(vct ? { vct } : {}) },
      approval: { approved_at: "2026-10-01T00:00:00Z", ref: "ornek-onay-1" },
    });
  const PID = "urn:eudi:pid:1";
  const TAMGA_ROOT_FP = "c".repeat(64);
  function storeWith(pointers: ExternalListPointer[]) {
    const store = new TrustStore();
    store.applyLotl(
      { schemas: [], wallet_providers: [], national_lists: [], external_lists: pointers } as never,
      "",
      NOW,
    );
    store.root_cas.set("0xroot", { ca_id: "0xroot", cert_fingerprint_sha256: TAMGA_ROOT_FP } as never);
    store.wallet_provider_keys.add("d".repeat(64));
    return store;
  }
  const lote = (
    services: ParsedLote["entities"][number]["services"],
    nextUpdate = "2026-12-01T00:00:00Z",
  ): ParsedLote => ({
    sequence: 1,
    territory: "DE",
    issuedAt: new Date("2026-11-01T00:00:00Z"),
    nextUpdate: new Date(nextUpdate),
    loteType: "",
    operatorName: "Example operator",
    entities: [{ name: "Example PID provider", services }],
  });
  const der = (n: number) => new Uint8Array([0x30, 0x03, 0x02, 0x01, n]);
  const svc = (
    kind: ExternalEntityKind | null,
    role: "issuance" | "revocation",
    n: number,
    supplyPoints: string[] = [],
  ) => ({
    kind,
    role,
    typeUri: "",
    name: "svc",
    certsDer: [der(n)],
    supplyPoints,
  });

  it("LOTL'da etkin ama yüklenememiş liste: ona bağlı sorular UNKNOWN, Tamga soruları eskisi gibi", () => {
    const ts = fresh(
      storeWith([pointer("de-pid", ["pid_provider"], [PID]), pointer("de-wallets", ["wallet_provider"])]),
    );
    // belge veren: bilinmeyen çapa + bu türe kefil olabilen eksik liste → UNKNOWN (önce: null → doğrulayıcı RED)
    const ans = ts.externalIssuerByAnchor("e".repeat(64), PID, 0);
    expect(ans).toMatchObject({ tri: "UNKNOWN", issuer: null, list_id: "de-pid", territory: "DE" });
    expect(ts.unavailableExternalListFor(PID)).toBe("de-pid");
    // başka tür: eksik liste ona kefil olamaz → soru listeye bağlı değil
    expect(ts.externalIssuerByAnchor("e".repeat(64), "urn:tamga:edu:DiplomaCredential:1", 0)).toBeNull();
    expect(ts.unavailableExternalListFor("urn:tamga:edu:DiplomaCredential:1")).toBeNull();
    // Tamga kökü: dış listeye bağlı değil (Tamga kaydı aranır) — dış liste Tamga listelerini bozmaz
    expect(ts.externalIssuerByAnchor(TAMGA_ROOT_FP, PID, 0)).toBeNull();
    // cüzdan sağlayıcı anahtarı: Tamga'nın kendi anahtarı YES; bilinmeyen anahtar eksik cüzdan listesinde olabilir → UNKNOWN
    expect(ts.isWalletProviderKey("d".repeat(64))).toBe("YES");
    expect(ts.isWalletProviderKey("f".repeat(64))).toBe("UNKNOWN");
  });

  it("eksik liste cüzdan sağlayıcılarına kefil değilse bilinmeyen anahtar NO kalır; dış liste yoksa hiçbir şey değişmez", () => {
    const pidOnly = fresh(storeWith([pointer("de-pid", ["pid_provider"], [PID])]));
    expect(pidOnly.isWalletProviderKey("f".repeat(64))).toBe("NO");
    const none = fresh(storeWith([]));
    expect(none.isWalletProviderKey("f".repeat(64))).toBe("NO");
    expect(none.externalIssuerByAnchor("e".repeat(64), PID, 0)).toBeNull();
    expect(none.unavailableExternalListFor(PID)).toBeNull();
    // etkin olmayan (SUSPENDED) gösterici "eksik liste" sayılmaz
    const suspended = { ...pointer("de-pid", ["pid_provider"], [PID]), status: "SUSPENDED" as const };
    expect(fresh(storeWith([suspended])).externalIssuerByAnchor("e".repeat(64), PID, 0)).toBeNull();
  });

  it("yüklü ve taze liste: eksik sayılmaz; NextUpdate geçince kullanılamaz sayılır", () => {
    const ptr = pointer("de-pid", ["pid_provider"], [PID]);
    const store = storeWith([ptr]);
    store.applyExternalList(ptr, lote([svc("pid_provider", "issuance", 1)], "2026-11-20T00:00:00Z"));
    let now = NOW;
    store.setFreshness({ source: "list", healthy: true, lotlVersion: 1, anchorsSeq: 1, loadedAt: NOW });
    const ts = new ListTrustSource(store, () => now);
    expect(ts.unavailableExternalListFor(PID)).toBeNull();
    expect(ts.externalIssuerByAnchor("e".repeat(64), PID, 0)).toBeNull(); // listede olmayan çapa: gerçekten yok
    now = new Date("2026-11-21T00:00:00Z");
    expect(ts.unavailableExternalListFor(PID)).toBe("de-pid");
  });

  it("FD2: kapsam dışı roldeki iptal hizmetinin sertifikası ve adresi kapsamdaki kayda bağlanmaz", () => {
    const ptr = pointer("de-pid", ["pid_provider"], [PID]);
    const store = storeWith([ptr]);
    const fpOf = (n: number) => [...store.external_anchors.values()].find((e) => e.cert_der[4] === n)!;
    store.applyExternalList(
      ptr,
      lote([
        svc("pid_provider", "issuance", 1, ["https://pid.example/issue"]),
        svc("pid_provider", "revocation", 2, ["https://status.pid.example/"]),
        svc("eaa_provider", "issuance", 3, ["https://eaa.example/issue"]), // kapsam dışı rol
        svc("eaa_provider", "revocation", 4, ["https://status.eaa.example/"]), // kapsam dışı rolün iptal hizmeti
        svc(null, "revocation", 5, ["https://status.other.example/"]), // rolü tanınmayan iptal hizmeti
      ]),
    );
    expect(store.external_anchors.size).toBe(1); // yalnız PID belge verme hizmeti
    const pid = fpOf(1);
    expect(pid.status_signer_fps).toHaveLength(1); // yalnız PID iptal hizmeti (önce: 2, 4 ve 5 birlikte)
    expect(pid.status_signer_fps[0]).not.toBe(pid.cert_fingerprint);
    expect(pid.status_hosts.sort()).toEqual(["pid.example", "status.pid.example"]);
  });

  it("FD2: aynı rolde iptal hizmeti yoksa iptal listesi imzacısı çapanın kendisidir", () => {
    const ptr = pointer("de-pid", ["pid_provider"], [PID]);
    const store = storeWith([ptr]);
    store.applyExternalList(ptr, lote([svc("pid_provider", "issuance", 1), svc("eaa_provider", "revocation", 4)]));
    const [pid] = [...store.external_anchors.values()];
    expect(pid.status_signer_fps).toEqual([pid.cert_fingerprint]);
  });
});
