/** "Paylaştığım kurumlar": günlüğün doğrulayıcıya göre gruplanması (değer yok, yalnız alan adları). */
import { describe, it, expect } from "vitest";
import { sharedBefore, sharedWith, PROXIMITY_RP_KEY } from "./shared-with.js";
import type { WalletState } from "./store.js";

const state = {
  version: 1,
  createdAt: 0,
  instanceId: "i",
  credentials: [],
  presentationLog: [
    {
      ts: 10,
      clientId: "kariyer.example.edu.tr",
      vct: "urn:tamga:edu:DiplomaCredential:1",
      disclosed: ["degree"],
      outcome: "sent",
    },
    {
      ts: 30,
      clientId: "kariyer.example.edu.tr",
      vct: "urn:tamga:edu:DiplomaCredential:1",
      disclosed: ["degree", "graduation_date"],
      outcome: "sent",
    },
    {
      ts: 20,
      clientId: "kariyer.example.edu.tr",
      vct: "urn:tamga:edu:DiplomaCredential:1",
      disclosed: [],
      outcome: "declined",
    },
    { ts: 15, clientId: "x509_hash:abc", vct: "v", disclosed: [], outcome: "error" },
    { ts: 5, clientId: PROXIMITY_RP_KEY, vct: "org.iso.18013.5.1.mDL", disclosed: ["age_over_18"], outcome: "sent" },
  ],
  events: [
    { ts: 40, kind: "deletion_request", vct: "v", typeName: "", clientId: "kariyer.example.edu.tr", channel: "email" },
    { ts: 41, kind: "deleted", vct: "v", typeName: "T" },
  ],
  pseudonyms: [
    { rpKey: "site.example", index: 0, pseudonym: "p0", createdAt: 50, lastUsedAt: 60 },
    { rpKey: "site.example", index: 1, pseudonym: "p1", createdAt: 55, deletedAt: 56 },
  ],
  settings: { biometrics: false },
} as unknown as WalletState;

describe("paylaştığım kurumlar", () => {
  const parties = sharedWith(state);
  const byKey = Object.fromEntries(parties.map((p) => [p.key, p]));

  it("son etkinliği en yeni olan önce; takma adı olan site de listede", () => {
    expect(parties.map((p) => p.key)).toEqual([
      "site.example",
      "kariyer.example.edu.tr",
      "x509_hash:abc",
      PROXIMITY_RP_KEY,
    ]);
  });

  it("gönderim sayısı, son gönderim ve açıklanan alan adları (yalnız gönderilenler)", () => {
    const k = byKey["kariyer.example.edu.tr"];
    expect(k.sentCount).toBe(2);
    expect(k.lastSharedAt).toBe(30);
    expect(k.fields).toEqual(["degree", "graduation_date"]);
    expect(k.shares.map((s) => s.ts)).toEqual([30, 20, 10]);
    expect(k.requests.map((r) => r.kind)).toEqual(["deletion_request"]);
    expect(k.domain).toBe("kariyer.example.edu.tr");
  });

  it("alan adı yalnız çıplak alan adında; istemci kimliği ve yüz yüze okuyucu için yok", () => {
    expect(byKey["x509_hash:abc"].domain).toBeUndefined();
    expect(byKey["x509_hash:abc"].sentCount).toBe(0);
    expect(byKey[PROXIMITY_RP_KEY].domain).toBeUndefined();
  });

  it("silinmiş takma ad gösterilmez", () => {
    expect(byKey["site.example"].pseudonyms.map((p) => p.index)).toEqual([0]);
    expect(byKey["site.example"].shares).toEqual([]);
  });

  it("günlük boşsa liste boş", () => {
    expect(sharedWith({ ...state, presentationLog: [], events: [], pseudonyms: [] })).toEqual([]);
  });
});

describe("WL6 önceki paylaşım bildirimi (sharedBefore)", () => {
  const rp = "kariyer.example.edu.tr";
  const vct = "urn:tamga:edu:DiplomaCredential:1";

  it("daha önce açıklanan alanlar (en son paylaşılan önce) ve bu istekte ilk kez istenenler", () => {
    const r = sharedBefore(state, rp, ["degree", "student_number", "graduation_date", "student_number"]);
    expect(r.sentCount).toBe(2);
    expect(r.lastSharedAt).toBe(30);
    expect(r.fields).toEqual([
      { name: "degree", lastSharedAt: 30 },
      { name: "graduation_date", lastSharedAt: 30 },
    ]);
    expect(r.again).toEqual(["degree", "graduation_date"]);
    expect(r.firstTime).toEqual(["student_number"]);
  });

  it("reddedilen ve başarısız sunumlar sayılmaz; yalnız verilen doğrulayıcının günlüğü okunur", () => {
    const s = {
      ...state,
      presentationLog: [
        { ts: 1, clientId: rp, vct, disclosed: ["degree"], outcome: "declined" },
        { ts: 2, clientId: rp, vct, disclosed: ["degree"], outcome: "error" },
        { ts: 3, clientId: "baska.example", vct, disclosed: ["degree"], outcome: "sent" },
      ],
    } as unknown as WalletState;
    expect(sharedBefore(s, rp, ["degree"])).toEqual({ sentCount: 0, fields: [], again: [], firstTime: ["degree"] });
  });

  it("tür süzgeci: WL6 tür başınadır", () => {
    const s = {
      ...state,
      presentationLog: [
        ...state.presentationLog,
        {
          ts: 50,
          clientId: rp,
          vct: "urn:tamga:edu:StudentCredential:1",
          disclosed: ["student_number"],
          outcome: "sent",
        },
      ],
    } as unknown as WalletState;
    expect(sharedBefore(s, rp, ["student_number"]).again).toEqual(["student_number"]);
    const d = sharedBefore(s, rp, ["student_number"], { vct });
    expect(d.sentCount).toBe(2);
    expect(d.firstTime).toEqual(["student_number"]);
  });

  it("yüz yüze okuyucu ve cüzdandan cüzdana: kalıcı kimlik yok, önceki paylaşım dönmez", () => {
    expect(sharedBefore(state, PROXIMITY_RP_KEY, ["age_over_18"])).toEqual({
      sentCount: 0,
      fields: [],
      again: [],
      firstTime: ["age_over_18"],
    });
    const s = {
      ...state,
      presentationLog: [{ ts: 1, clientId: "w2w:person", vct: "v", disclosed: ["given_name"], outcome: "sent" }],
    } as unknown as WalletState;
    expect(sharedBefore(s, "w2w:person", ["given_name"]).sentCount).toBe(0);
  });

  it("değer döndürmez: çıktıda yalnız alan adları ve tarihler", () => {
    const s = {
      ...state,
      credentials: [{ id: "c", vct, claims: { degree: "GIZLI-DEGER" }, copies: [] }],
    } as unknown as WalletState;
    expect(JSON.stringify(sharedBefore(s, rp, ["degree"]))).not.toContain("GIZLI-DEGER");
  });
});
