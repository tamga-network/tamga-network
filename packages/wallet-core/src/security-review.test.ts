/**
 * Güvenlik incelemesi 2026-11-18 (API tuzakları ve cüzdan çekirdeği): imzalı metadata istenince imzasız yanıt reddi (C6-Ö7), adresle
 * çekilen teklifte ve kurum uçlarında https (C3-K2), DPoP `jti` yedeğinin kriptografik rastgeleliği (C3-K3), içe aktarılan taşıma
 * dosyasında `x_tamga` biçim denetimi (C3-K8). Kişisel veri yok.
 */
import { describe, it, expect, vi } from "vitest";
import { fetchIssuerMetadata, resolveOffer } from "./oid4vci.js";
import { dpopProof } from "./dpop.js";
import { decodeJwt } from "./jws.js";
import { SoftwareKeyProvider, MemoryKeyStore } from "./keys.js";
import { applyMigration, type Ts10MigrationData } from "./ts10.js";
import { newState } from "./store.js";
import type { Http } from "./http.js";

const ISS = "https://issuer.tamga.network/example-university";
const md = (over: Record<string, unknown> = {}) => ({
  credential_issuer: ISS,
  credential_endpoint: `${ISS}/credential`,
  nonce_endpoint: `${ISS}/nonce`,
  credential_configurations_supported: {},
  ...over,
});
const json =
  (body: unknown): Http =>
  async () =>
    ({ status: 200, text: async () => JSON.stringify(body) }) as never;

describe("C6-Ö7: imzalı metadata istenince imzasız yanıt kullanılmaz", () => {
  it("signerFingerprints verilip kurum JSON döndürürse hata; verilmezse JSON kabul", async () => {
    await expect(fetchIssuerMetadata(ISS, json(md()), { signerFingerprints: ["ab".repeat(32)] })).rejects.toThrow(
      /unsigned metadata/,
    );
    expect((await fetchIssuerMetadata(ISS, json(md()))).credential_endpoint).toBe(`${ISS}/credential`);
  });
});

describe("C3-K2: adresle çekilen teklif ve kurum uçları https", () => {
  it("https teklif adresinden gelen teklifin credential_issuer'ı http ise reddedilir", async () => {
    const offer = { credential_issuer: "http://issuer.tamga.network/x", credential_configuration_ids: ["urn:x"] };
    await expect(resolveOffer({ offerUri: "https://issuer.tamga.network/offer/1" }, json(offer))).rejects.toThrow(
      /must use https/,
    );
    const ok = { ...offer, credential_issuer: ISS };
    expect((await resolveOffer({ offerUri: "https://issuer.tamga.network/offer/1" }, json(ok))).credential_issuer).toBe(
      ISS,
    );
    // yerel geliştirme: http teklif adresi (yalnız parseOffer'ın açık izniyle gelir) → yerel http kurum kabul, genel http değil
    const lan = { ...offer, credential_issuer: "http://192.168.1.20:4001/x" };
    expect((await resolveOffer({ offerUri: "http://192.168.1.20:4001/offer/1" }, json(lan))).credential_issuer).toBe(
      lan.credential_issuer,
    );
    await expect(resolveOffer({ offerUri: "http://192.168.1.20:4001/offer/1" }, json(offer))).rejects.toThrow(
      /must use https/,
    );
  });
  it("https kurumun http belge / nonce ucu reddedilir; yerel http kurumun yerel uçları kabul", async () => {
    await expect(
      fetchIssuerMetadata(ISS, json(md({ credential_endpoint: "http://issuer.tamga.network/c" }))),
    ).rejects.toThrow(/credential_endpoint must use https/);
    await expect(fetchIssuerMetadata(ISS, json(md({ nonce_endpoint: "http://evil.example/n" })))).rejects.toThrow(
      /nonce_endpoint must use https/,
    );
    const LAN = "http://192.168.1.20:4001/x";
    const lanMd = md({
      credential_issuer: LAN,
      credential_endpoint: `${LAN}/credential`,
      nonce_endpoint: `${LAN}/nonce`,
    });
    expect((await fetchIssuerMetadata(LAN, json(lanMd))).nonce_endpoint).toBe(`${LAN}/nonce`);
  });
});

describe("C3-K3: DPoP jti yedeği kriptografik rastgele", () => {
  it("randomBytes verilmezse Math.random kullanılmaz; jti 16 bayt, her kanıtta farklı", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const jwk = await keys.generate("d");
    const spy = vi.spyOn(Math, "random");
    const a = await dpopProof({ keys, ref: "d", jwk }, "POST", "https://issuer.tamga.network/token");
    const b = await dpopProof({ keys, ref: "d", jwk }, "POST", "https://issuer.tamga.network/token");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    const ja = decodeJwt(a).payload.jti as string;
    expect(Buffer.from(ja, "base64url")).toHaveLength(16);
    expect(ja).not.toBe(decodeJwt(b).payload.jti);
  });
});

describe("C3-K8: içe aktarılan taşıma dosyasında x_tamga biçimi denetlenir", () => {
  it("biçimi bozuk günlük satırı, olay ve ayar alınmaz; doğru olanlar alınır", () => {
    const good = { ts: 1, clientId: "verify.tamga.network", vct: "urn:x", disclosed: ["a"], outcome: "sent" };
    const ev = { ts: 2, kind: "deleted", vct: "urn:x", typeName: "X" };
    const data = {
      listOfCredentials: "bozuk",
      x_tamga: {
        presentationLog: [
          good,
          { ...good, ts: "1" },
          { ...good, outcome: "hacked" },
          null,
          "x",
          { ...good, disclosed: [1] },
        ],
        events: [ev, { ...ev, kind: "unknown" }, { ...ev, channel: "fax" }, 5],
        settings: { autoRefresh: "yes", theme: "<script>" },
      },
    } as unknown as Ts10MigrationData;
    const base = newState("w");
    const r = applyMigration(base, data);
    expect(r.state.presentationLog).toEqual([good]);
    expect(r.state.events).toEqual([ev]);
    expect(r.state.settings).toEqual(base.settings);
    expect(r.toReissue).toEqual([]);
    // x_tamga hiç nesne değilse yalnız boş geri yükleme
    const r2 = applyMigration(base, { x_tamga: [1, 2] } as unknown as Ts10MigrationData);
    expect(r2.state.presentationLog).toEqual([]);
    // geçerli ayar alınır
    const r3 = applyMigration(base, { x_tamga: { settings: { autoRefresh: false, theme: "dark" } } } as never);
    expect(r3.state.settings).toMatchObject({ autoRefresh: false, theme: "dark" });
  });
});
