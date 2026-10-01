/** AB TS10: işlem günlüğü ve taşıma nesnesi — veri modeli, PBES2-HS256+A128KW/A128GCM (jose ile çözülür), geri yükleme. */
import { describe, it, expect } from "vitest";
import { compactDecrypt, CompactEncrypt } from "jose";
import {
  applyMigration,
  decryptTs10,
  decryptTs10Async,
  encryptTs10Async,
  encryptTs10,
  newState,
  ts10Identifier,
  ts10MigrationData,
  ts10TransactionLog,
  Ts10DecryptError,
  type StoredCredential,
  type Ts10Lookup,
  type WalletState,
} from "./index.js";

const cred = (vct: string, issuerId: string, receivedAt: number): StoredCredential => ({
  id: `c-${vct}`,
  vct,
  typeName: "Student",
  issuer: "https://issuer.tamga.network/bilgi",
  issuerId,
  leafFingerprint: "f",
  iat: receivedAt / 1000,
  claims: { given_name: "SHOULD-NOT-LEAK" },
  disclosureNames: ["given_name"],
  copies: [{ keyRef: "k1", combined: "SECRET~", cnf: {} as never }] as never,
  receivedAt,
});

function state(): WalletState {
  const s = newState("inst");
  return {
    ...s,
    credentials: [cred("urn:tamga:edu:StudentCredential:1", "0xabc", Date.UTC(2026, 8, 1))],
    presentationLog: [
      {
        ts: Date.UTC(2026, 8, 2),
        clientId: "x509_san_dns:shop.example",
        vct: "urn:tamga:edu:StudentCredential:1",
        requested: ["is_enrolled", "given_name"],
        disclosed: ["is_enrolled"],
        outcome: "sent",
      },
      {
        ts: Date.UTC(2026, 8, 3),
        clientId: "x509_san_dns:shop.example",
        vct: "urn:tamga:edu:StudentCredential:1",
        disclosed: [],
        outcome: "declined",
      },
    ],
    events: [
      {
        ts: Date.UTC(2026, 8, 4),
        kind: "dpa_report",
        vct: "urn:tamga:edu:StudentCredential:1",
        typeName: "Student",
        authority: "KVKK",
      },
    ],
  };
}
const lookup: Ts10Lookup = {
  relyingParty: () => ({
    identifier: ts10Identifier([{ scheme: "TR-VKN", value: "1234567890" }]),
    name: "Shop",
    contact: ["TR", "https://shop.example/help"],
    registrarURL: "https://trust.tamga.network/tl-tr.jws",
    purpose: [{ lang: "en", content: "Student discount" }],
    privacyPolicy: "https://shop.example/privacy",
    dpaName: "KVKK",
    dpaCountry: "TR",
    dpaContact: ["https://www.kvkk.gov.tr"],
  }),
  issuer: () => ({
    name: "Bilgi",
    contact: ["TR"],
    issuerType: "NonQEAAProvider",
    supplyPointURL: "https://issuer.tamga.network/bilgi",
  }),
};

describe("TS10 işlem günlüğü", () => {
  it("sunum: istenen ≠ gönderilen, reddedilen NotCompleted; alım ve KVKK bildirimi; zamana göre", () => {
    const log = ts10TransactionLog(state(), lookup);
    expect(log.map((t) => t.transactionType)).toEqual([
      "CredentialIssuance",
      "Presentation",
      "Presentation",
      "DPAReport",
    ]);
    const p = log[1].presentation as Record<string, unknown>;
    expect(p).toMatchObject({
      interactingPartyIdentifier: { type: "http://data.europa.eu/eudi/id/TIN", identifier: "1234567890" },
      interactingPartyName: "Shop",
      interactingPartyType: "ServiceProvider",
      isIntermediary: false,
      dpaName: "KVKK",
      listOfClaimsRequested: [
        { credentialIdentifier: "urn:tamga:edu:StudentCredential:1", claims: ["is_enrolled", "given_name"] },
      ],
      listOfClaimsPresented: [{ credentialIdentifier: "urn:tamga:edu:StudentCredential:1", claims: ["is_enrolled"] }],
    });
    expect(log[1].time).toBe("2026-09-02T00:00:00");
    expect(log[2]).toMatchObject({ transactionResult: "NotCompleted" });
    expect((log[2].presentation as Record<string, unknown>).reasonOfNoncompletion).toBe("declined by user");
  });

  it("taşıma verisi: belge değeri ve anahtarı girmez", () => {
    const d = ts10MigrationData(state(), lookup, { includeLog: true });
    const text = JSON.stringify(d);
    expect(text).not.toContain("SHOULD-NOT-LEAK");
    expect(text).not.toContain("SECRET~");
    expect(d.listOfCredentials).toEqual([
      expect.objectContaining({
        credentialIdentifier: "urn:tamga:edu:StudentCredential:1",
        format: "dc+sd-jwt",
        supplyPointURL: "https://issuer.tamga.network/bilgi",
      }),
    ]);
    expect(d.nonDeviceBoundCredentials).toEqual([]);
  });
});

describe("TS10 şifreleme (PBES2-HS256+A128KW / A128GCM)", () => {
  const pw = "doğru-parola-123";
  it("gidiş-dönüş; jose aynı parolayla çözer", async () => {
    const data = ts10MigrationData(state(), lookup, { includeLog: true });
    const jwe = encryptTs10(data, pw, { iterations: 2000 });
    expect(decryptTs10(jwe, pw)).toEqual(data);
    const { plaintext, protectedHeader } = await compactDecrypt(jwe, new TextEncoder().encode(pw.normalize("NFC")), {
      keyManagementAlgorithms: ["PBES2-HS256+A128KW"],
    });
    expect(protectedHeader).toMatchObject({ alg: "PBES2-HS256+A128KW", enc: "A128GCM", p2c: 2000 });
    expect(JSON.parse(new TextDecoder().decode(plaintext))).toEqual(data);
  });

  it("jose ile şifrelenmiş TS10 nesnesini çözer", async () => {
    const jwe = await new CompactEncrypt(new TextEncoder().encode(JSON.stringify({ ok: 1 })))
      .setProtectedHeader({ alg: "PBES2-HS256+A128KW", enc: "A128GCM", p2c: 1500 })
      .encrypt(new TextEncoder().encode(pw));
    expect(decryptTs10(jwe, pw)).toEqual({ ok: 1 });
  });

  it("yanlış parola, bozuk dosya, kısa parola, aşırı yineleme", () => {
    const jwe = encryptTs10({ a: 1 }, pw, { iterations: 1000 });
    expect(() => decryptTs10(jwe, "yanlis-parola")).toThrow(Ts10DecryptError);
    expect(() => decryptTs10(jwe.slice(0, -4) + "AAAA", pw)).toThrow(Ts10DecryptError);
    expect(() => encryptTs10({}, "kisa")).toThrow(/8 characters/);
    const [, ...rest] = jwe.split(".");
    const h = Buffer.from(
      JSON.stringify({ alg: "PBES2-HS256+A128KW", enc: "A128GCM", p2s: "AAAAAAAAAAAAAAAAAAAAAA", p2c: 1e9 }),
    ).toString("base64url");
    expect(() => decryptTs10([h, ...rest].join("."), pw)).toThrow(/iteration/);
  });
});

describe("geri yükleme", () => {
  it("günlük ve ayarlar gelir; belgeler gelmez, yeniden alınacaklar listesi döner", () => {
    const d = ts10MigrationData({ ...state(), settings: { ...state().settings, autoRefresh: false } }, lookup, {
      includeLog: true,
    });
    const fresh = newState("new");
    const r = applyMigration(fresh, d);
    expect(r.state.credentials).toEqual([]);
    expect(r.state.presentationLog).toHaveLength(2);
    expect(r.state.events).toHaveLength(1);
    expect(r.state.settings.autoRefresh).toBe(false);
    expect(r.toReissue.map((x) => x.credentialIdentifier)).toEqual(["urn:tamga:edu:StudentCredential:1"]);
  });
});

describe("TS10 async (arayüzü dondurmayan)", () => {
  it("async şifreler, sync çözer ve tersi", async () => {
    const pw = "async-parola-1";
    const a = await encryptTs10Async({ x: 1 }, pw, { iterations: 3000 });
    expect(decryptTs10(a, pw)).toEqual({ x: 1 });
    const b = encryptTs10({ y: 2 }, pw, { iterations: 3000 });
    expect(await decryptTs10Async(b, pw)).toEqual({ y: 2 });
    await expect(decryptTs10Async(b, "baska-parola")).rejects.toThrow(Ts10DecryptError);
  });
});

describe("günlük seçenekleri (ADR-0027)", () => {
  it("includeLog: false → yalnız belge listesi", () => {
    const d = ts10MigrationData(state(), lookup, { includeLog: false });
    expect(d.transactionLog).toEqual([]);
    expect(d.x_tamga.presentationLog).toEqual([]);
    expect(d.x_tamga.events).toEqual([]);
    expect(d.listOfCredentials).toHaveLength(1);
  });
});

describe("Mig_07b: günlüğü geri yükleme kişinin seçimi", () => {
  it("restoreLog: false → günlük gelmez, belge listesi gelir", () => {
    const d = ts10MigrationData(state(), lookup);
    expect(d.transactionLog.length).toBeGreaterThan(0);
    const r = applyMigration(newState("n"), d, { restoreLog: false });
    expect(r.state.presentationLog).toEqual([]);
    expect(r.toReissue).toHaveLength(1);
  });
});
