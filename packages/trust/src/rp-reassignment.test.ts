/**
 * ADR-0075 RO1/RO5 (0.8.1) — aynı `dns_name` birden çok ülke listesinde: devir makinece okunur olmalı.
 *  - iptal edilmemiş TEK kayıt, ancak öteki bütün kayıtların son `REVOKED` girdisi `reassigned_to` ile onun ülkesini gösteriyorsa
 *    seçilir; aksi hâlde ad belirsizdir (kapalı güvenli). Gerekçe metni (`reason`) karar için okunmaz.
 *  - `SUSPENDED` iptal edilmemiş sayılır; `RETIRED` iptal edilmiş sayılır. Hepsi iptal edilmişse belirsiz değildir.
 *  - Sonuç liste yükleme sırasından bağımsızdır.
 */
import { describe, expect, it } from "vitest";
import { ListTrustSource, RelyingParty, StatusHistoryEntry, TrustStore } from "./index.js";

const NOW = new Date("2026-11-05T12:00:00Z");
const DNS = "verify.example";

type H = { status: string; since: string; reason?: string; reassigned_to?: string };
function rp(status: string, history: H[], client = "A") {
  return RelyingParty.parse({
    rp_id: `rp-${client}`,
    client_id: `x509_hash:${client.repeat(43)}`,
    dns_name: DNS,
    legal_name: DNS,
    access_cert_fingerprint_sha256: "b".repeat(64),
    status,
    registered_at: "2026-01-01T00:00:00Z",
    scopes: [],
    status_history: history,
  });
}
const ACTIVE0: H = { status: "ACTIVE", since: "2026-01-01T00:00:00Z" };
const revoked = (to?: string, since = "2026-06-01T00:00:00Z"): H => ({
  status: "REVOKED",
  since,
  reason: to ? `reassignment to ${to} (approval reassign-1)` : "registration ended",
  ...(to ? { reassigned_to: to } : {}),
});
const list = (cc: string, rps: RelyingParty[]) =>
  ({ state_code: cc, root_cas: [], issuers: [], relying_parties: rps, national_schemas: [] }) as never;

function load(lists: Array<[string, RelyingParty]>) {
  const store = new TrustStore();
  for (const [cc, r] of lists) store.applyNationalList(list(cc, [r]), "");
  store.setFreshness({ source: "list", healthy: true, lotlVersion: 1, anchorsSeq: 1, loadedAt: NOW });
  return { store, ts: new ListTrustSource(store, () => NOW) };
}

describe("ADR-0075 devir kuralı (relyingPartyAmbiguous / relyingPartyByDnsName)", () => {
  const oldTr = (to?: string) => rp("REVOKED", [ACTIVE0, revoked(to)], "O");
  const newAz = rp("ACTIVE", [{ status: "ACTIVE", since: "2026-06-01T00:00:00Z" }], "N");

  it("devir kaydı olmadan: yabancı ACTIVE + kendi REVOKED → belirsiz (null); gerekçe metni yetmez", () => {
    const { store, ts } = load([
      ["TR", oldTr()],
      ["AZ", newAz],
    ]);
    expect(store.relyingPartyAmbiguous(DNS)).toBe(true);
    expect(store.relyingPartyStateOf(DNS)).toBeUndefined();
    expect(ts.relyingPartyByDnsName(DNS)).toBeNull();
    // gerekçe metninde devir yazsa da yapılı alan yoksa devir sayılmaz
    const textOnly = rp("REVOKED", [ACTIVE0, { ...revoked(), reason: "reassignment to AZ (approval x)" }], "O");
    expect(
      load([
        ["TR", textOnly],
        ["AZ", newAz],
      ]).store.relyingPartyAmbiguous(DNS),
    ).toBe(true);
  });

  it("doğru reassigned_to → yeni kayıt seçilir", () => {
    const { store, ts } = load([
      ["TR", oldTr("AZ")],
      ["AZ", newAz],
    ]);
    expect(store.relyingPartyAmbiguous(DNS)).toBe(false);
    expect(store.relyingPartyStateOf(DNS)).toBe("AZ");
    expect(ts.relyingPartyByDnsName(DNS)?.client_id).toBe(newAz.client_id);
  });

  it("yanlış ülkeyi gösteren devir → belirsiz", () => {
    const { store, ts } = load([
      ["TR", oldTr("KZ")],
      ["AZ", newAz],
    ]);
    expect(store.relyingPartyAmbiguous(DNS)).toBe(true);
    expect(ts.relyingPartyByDnsName(DNS)).toBeNull();
  });

  it("yalnız SON REVOKED girdisi sayılır: eski devir + sonraki devirsiz iptal → belirsiz", () => {
    const twice = rp(
      "REVOKED",
      [
        ACTIVE0,
        revoked("AZ", "2026-03-01T00:00:00Z"),
        { status: "ACTIVE", since: "2026-04-01T00:00:00Z" },
        revoked(undefined, "2026-06-01T00:00:00Z"),
      ],
      "O",
    );
    expect(
      load([
        ["TR", twice],
        ["AZ", newAz],
      ]).store.relyingPartyAmbiguous(DNS),
    ).toBe(true);
    // sıra listede karışık yazılmış olsa da `since`'e göre son girdi
    const shuffled = rp("REVOKED", [revoked(undefined, "2026-03-01T00:00:00Z"), ACTIVE0, revoked("AZ")], "O");
    expect(
      load([
        ["TR", shuffled],
        ["AZ", newAz],
      ]).store.relyingPartyAmbiguous(DNS),
    ).toBe(false);
  });

  it("SUSPENDED iptal edilmemiş sayılır: SUSPENDED + başka ACTIVE → belirsiz", () => {
    const suspended = rp("SUSPENDED", [ACTIVE0, { status: "SUSPENDED", since: "2026-05-01T00:00:00Z" }], "O");
    const { store, ts } = load([
      ["TR", suspended],
      ["AZ", newAz],
    ]);
    expect(store.relyingPartyAmbiguous(DNS)).toBe(true);
    expect(ts.relyingPartyByDnsName(DNS)).toBeNull();
  });

  it("RETIRED iptal edilmemiş sayılmaz: devirle kapanıp emekliye ayrılan kayıt yeni kaydı belirsiz yapmaz; hepsi kapalıysa belirsizlik yok", () => {
    const retired = rp("RETIRED", [ACTIVE0, revoked("AZ"), { status: "RETIRED", since: "2026-07-01T00:00:00Z" }], "O");
    const ok = load([
      ["TR", retired],
      ["AZ", newAz],
    ]);
    expect(ok.store.relyingPartyAmbiguous(DNS)).toBe(false);
    expect(ok.store.relyingPartyStateOf(DNS)).toBe("AZ");
    // devir kaydı olmayan RETIRED + ACTIVE: belirsiz
    const plainRetired = rp("RETIRED", [ACTIVE0, { status: "RETIRED", since: "2026-07-01T00:00:00Z" }], "O");
    expect(
      load([
        ["TR", plainRetired],
        ["AZ", newAz],
      ]).store.relyingPartyAmbiguous(DNS),
    ).toBe(true);
    // hepsi iptal / emekli: belirsiz değil, durumu en son değişen kayıt
    const gone = load([
      ["TR", plainRetired],
      ["AZ", rp("REVOKED", [ACTIVE0, revoked(undefined, "2026-08-01T00:00:00Z")], "N")],
    ]);
    expect(gone.store.relyingPartyAmbiguous(DNS)).toBe(false);
    expect(gone.ts.relyingPartyByDnsName(DNS)?.status).toBe("REVOKED");
  });

  it("başka ülkede iptal sonrası yeniden kayıt (RO2): devir kaydı yok → ağ düzeyinde kayıt gelene kadar belirsiz", () => {
    const { store } = load([
      ["TR", oldTr()],
      ["KZ", rp("ACTIVE", [{ status: "ACTIVE", since: "2026-09-01T00:00:00Z" }], "N")],
    ]);
    expect(store.relyingPartyAmbiguous(DNS)).toBe(true);
  });

  it("üç liste: öteki BÜTÜN kayıtlar yeni ülkeyi göstermeli", () => {
    const viaKz = rp("REVOKED", [ACTIVE0, revoked("KZ")], "K");
    const allToAz = load([
      ["TR", oldTr("AZ")],
      ["KZ", rp("REVOKED", [ACTIVE0, revoked("AZ")], "K")],
      ["AZ", newAz],
    ]);
    expect(allToAz.store.relyingPartyStateOf(DNS)).toBe("AZ");
    const mixed = load([
      ["TR", oldTr("AZ")],
      ["KZ", viaKz],
      ["AZ", newAz],
    ]);
    expect(mixed.store.relyingPartyAmbiguous(DNS)).toBe(true);
  });

  it("yükleme sırasından bağımsız: seçilen kayıt ve belirsizlik aynı", () => {
    const cases: Array<Array<[string, RelyingParty]>> = [
      [
        ["TR", oldTr("AZ")],
        ["AZ", newAz],
      ],
      [
        ["TR", oldTr()],
        ["AZ", newAz],
      ],
      [
        ["TR", rp("ACTIVE", [ACTIVE0], "O")],
        ["AZ", newAz],
      ],
      [
        ["TR", rp("REVOKED", [ACTIVE0, revoked(undefined, "2026-02-01T00:00:00Z")], "O")],
        ["AZ", rp("REVOKED", [ACTIVE0, revoked(undefined, "2026-03-01T00:00:00Z")], "N")],
      ],
    ];
    for (const c of cases) {
      const a = load(c).store;
      const b = load([...c].reverse()).store;
      expect(b.relyingPartyAmbiguous(DNS)).toBe(a.relyingPartyAmbiguous(DNS));
      expect(b.relying_parties_by_dns.get(DNS)?.client_id).toBe(a.relying_parties_by_dns.get(DNS)?.client_id);
      expect(b.relyingPartyStateOf(DNS)).toBe(a.relyingPartyStateOf(DNS));
    }
  });

  it("relying_party_records olmadan elle kurulan depo: yalnız görüldüğü liste sayısına bakılır", () => {
    const store = new TrustStore();
    store.relying_parties_by_dns.set(DNS, newAz);
    expect(store.relyingPartyAmbiguous(DNS)).toBe(false);
    expect(store.relyingPartyStateOf(DNS)).toBeUndefined();
    store.relying_party_states.set(DNS, new Set(["AZ"]));
    expect(store.relyingPartyAmbiguous(DNS)).toBe(false);
    expect(store.relyingPartyStateOf(DNS)).toBe("AZ");
    store.relying_party_states.set(DNS, new Set(["AZ", "TR"]));
    expect(store.relyingPartyAmbiguous(DNS)).toBe(true);
    expect(store.relyingPartyStateOf(DNS)).toBeUndefined();
  });

  it("şema: reassigned_to iki büyük harf; isteğe bağlı (eski girdiler geçerli)", () => {
    const base = { status: "REVOKED", since: "2026-06-01T00:00:00Z" };
    expect(StatusHistoryEntry.safeParse(base).success).toBe(true);
    expect(StatusHistoryEntry.safeParse({ ...base, reassigned_to: "AZ" }).success).toBe(true);
    expect(StatusHistoryEntry.safeParse({ ...base, reassigned_to: "az" }).success).toBe(false);
    expect(StatusHistoryEntry.safeParse({ ...base, reassigned_to: "AZE" }).success).toBe(false);
  });
});
