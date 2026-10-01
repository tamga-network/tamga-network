/** D7 — kopya planı (WL5 yapışkan, §4.3 tükenme) ve yenileme sonrası yerine geçme; WL7: otomatik yenileme yok (yalnız saf mantık). */
import { describe, it, expect } from "vitest";
import {
  LOW_COPIES,
  planCopy,
  remainingCopies,
  supersedeCredential,
  canSupersede,
  removeCredential,
  type StoredCredential,
  type WalletState,
} from "./store.js";

const cred = (
  id: string,
  usedBy: string[][],
  vct = "urn:tamga:edu:StudentCredential:1",
  issuerId = "0xbilgi",
): StoredCredential => ({
  id,
  vct,
  typeName: "Öğrenci Belgesi",
  issuer: "https://issuer/bilgi",
  issuerId,
  leafFingerprint: "fp",
  iat: 1,
  claims: {},
  disclosureNames: [],
  copies: usedBy.map((u, i) => ({
    keyRef: `${id}.${i}`,
    cnf: { kty: "EC", crv: "P-256", x: "x", y: "y" },
    combined: "c",
    usedBy: u,
  })),
  receivedAt: 1,
});
const state = (creds: StoredCredential[], passes: WalletState["passes"] = []): WalletState => ({
  version: 1,
  createdAt: 1,
  instanceId: "w",
  credentials: creds,
  presentationLog: [],
  passes,
  settings: { biometrics: false },
});

describe("D7 kopya planı", () => {
  it("bilinen doğrulayıcıya aynı kopya (WL5); yeni doğrulayıcıya kullanılmamış kopya", () => {
    const c = cred("a", [["rp1"], [], []]);
    expect(planCopy(c, "rp1")).toMatchObject({ kind: "sticky", keyRef: "a.0", remaining: 2 });
    expect(planCopy(c, "rp2")).toMatchObject({ kind: "fresh", keyRef: "a.1", remaining: 2 });
    expect(remainingCopies(c)).toBe(LOW_COPIES); // §4.3: 2 kaldı → bildirim eşiği
  });

  it("tükenme: yeni doğrulayıcı + kopya yok → yeniden kullanım adayı EN AZ görülen kopya; bilinen doğrulayıcı etkilenmez", () => {
    const c = cred("a", [["rp1", "rp2", "rp3"], ["rp4"], ["rp5", "rp6"]]);
    const p = planCopy(c, "rpNEW");
    expect(p.kind).toBe("exhausted");
    if (p.kind === "exhausted") expect(p.reuse).toEqual({ keyRef: "a.1", seenBy: ["rp4"] });
    expect(planCopy(c, "rp5")).toMatchObject({ kind: "sticky", keyRef: "a.2" }); // 0 kalan ama bilinen: sorun yok
  });

  it("yenileme: yeni belge eskisinin yerini alır; eski anahtarlar ve ona bağlı geçiş kartı kalkar; farklı tip reddedilir", () => {
    const old = cred("old", [["rp1"], ["rp2"]]);
    const neu = cred("new", [[], []]);
    const other = cred("dip", [[]], "urn:tamga:edu:DiplomaCredential:1");
    const s = state(
      [old, neu, other],
      [
        {
          passId: "p1",
          rpClientId: "rp",
          rpName: "Kampüs",
          terminalGroup: "g",
          credentialId: "old",
          keyRef: "old.0",
          cnfKid: "k",
          validUntil: 9e9,
          grantJws: "j",
          issuedAt: 1,
        },
      ],
    );
    const r = supersedeCredential(s, "old", "new");
    expect(r.state.credentials.map((c) => c.id)).toEqual(["new", "dip"]);
    expect(r.removedKeyRefs).toEqual(["old.0", "old.1"]);
    expect(r.removedPasses).toBe(1);
    expect(r.state.passes).toEqual([]);
    expect(() => supersedeCredential(s, "old", "dip")).toThrow(/same type/);
    expect(supersedeCredential(s, "yok", "new").removedKeyRefs).toEqual([]); // bilinmeyen → değişiklik yok
    // K2: yenileme niyeti yalnızca aynı tür + kurum için geçerli; yarıda kalan niyet ilgisiz belgeyi silmez
    expect(canSupersede(s, "old", "new")).toBe(true);
    expect(canSupersede(s, "old", "dip")).toBe(false); // farklı tür
    expect(canSupersede(s, undefined, "new")).toBe(false); // niyet yok
    expect(canSupersede(s, "new", "new")).toBe(false); // kendisi
    expect(canSupersede(s, "silinmis", "new")).toBe(false); // eski belge artık yok
  });
});

describe("silme", () => {
  it("belge silinince ona bağlı geçiş kartları da kalkar (anahtarı silinen kart imzalanamaz)", () => {
    const pass = (credentialId: string) =>
      ({ passId: "p-" + credentialId, credentialId, keyRef: "pk-" + credentialId }) as unknown as NonNullable<
        WalletState["passes"]
      >[number];
    const state = {
      version: 1,
      createdAt: 0,
      instanceId: "i",
      credentials: [cred("a", [[]]), cred("b", [[]])],
      presentationLog: [],
      passes: [pass("a"), pass("b")],
      settings: { biometrics: false },
    } as WalletState;
    const r = removeCredential(state, "a");
    expect(r.state.credentials.map((c) => c.id)).toEqual(["b"]);
    expect(r.state.passes!.map((p) => p.credentialId)).toEqual(["b"]);
    expect(r.keyRefs).toEqual(["a.0", "pk-a"]); // kopya + geçiş kartı anahtarı (yetim anahtar kalmaz)
  });
});

describe("depo şifrelemesi", () => {
  it("gidiş-dönüş; yanlış anahtar ve bozulmuş içerik reddedilir", async () => {
    const { sealText, openText } = await import("./seal.js");
    const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));
    const k = rnd(32);
    const s = sealText(k, '{"ad":"Ayşe","tckn":"10000000146"}', rnd);
    expect(s).not.toContain("Ayşe");
    expect(openText(k, s)).toContain("Ayşe");
    expect(() => openText(rnd(32), s)).toThrow();
    expect(() => openText(k, s.slice(0, -2) + (s.endsWith("A") ? "BB" : "AA"))).toThrow();
  });
});
