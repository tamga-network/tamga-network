/**
 * ADR-0083 (kapalı): çip okuma adresinin ayrıştırılması (köken ve yol denetimi), ham verinin `/chip/submit`'e taşınması
 * (başlıklar, gövde biçimi), hata eşlemesi ve `next` köken denetimi. Veri sahtedir; cüzdan çip verisini yorumlamaz (CV4).
 */
import { describe, it, expect } from "vitest";
import { MemoryKeyStore, SoftwareKeyProvider } from "./keys.js";
import { b64u, b64uDecode, b64uToUtf8 } from "./b64.js";
import type { Http } from "./http.js";
import type { WuaRecord } from "./wua.js";
import {
  CHIP_READER_ICAO9303,
  CHIP_READER_PARAM,
  chipReadRequestOf,
  submitChipRead,
  type ChipReadPayload,
  type ChipReadRequest,
} from "./chip.js";

const AS = "https://id.tamga.network";
const challenge = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
const c = b64u(challenge);
const handle = "par_9fK2x.AbCdEfGhIjKlMnOpQrStUv";
const readUrl = `${AS}/chip/read?r=${handle}&c=${c}`;

describe("chip — sabitler", () => {
  it("PAR alanı ve değeri", () => {
    expect(CHIP_READER_PARAM).toBe("chip_reader");
    expect(CHIP_READER_ICAO9303).toBe("icao9303");
  });
});

describe("chipReadRequestOf", () => {
  it("geçerli adres: submitUrl aynı kök + /chip/submit, tutamaç olduğu gibi, sınama 8 bayt", () => {
    const r = chipReadRequestOf(readUrl, AS);
    expect(r).toBeDefined();
    expect(r!.submitUrl).toBe(`${AS}/chip/submit`);
    expect(r!.handle).toBe(handle);
    expect(Array.from(r!.challenge)).toEqual(Array.from(challenge));
    expect(r!.aud).toBe(AS);
  });

  it("parametre sırası ve parça (#) önemli değil; sondaki eğik çizgili yetkilendirme sunucusu", () => {
    const r = chipReadRequestOf(`${AS}/chip/read?c=${c}&r=${handle}#x`, `${AS}/`);
    expect(r?.handle).toBe(handle);
    expect(r?.aud).toBe(AS);
  });

  it("yol önekli yetkilendirme sunucusu: önek korunur", () => {
    const base = "https://sandbox.tamga.network/id";
    const r = chipReadRequestOf(`${base}/chip/read?r=${handle}&c=${c}`, base);
    expect(r?.submitUrl).toBe(`${base}/chip/submit`);
    expect(chipReadRequestOf(`https://sandbox.tamga.network/chip/read?r=${handle}&c=${c}`, base)).toBeUndefined();
  });

  it("köken büyük/küçük harf duyarsız", () => {
    expect(chipReadRequestOf(`https://ID.Tamga.Network/chip/read?r=${handle}&c=${c}`, AS)).toBeDefined();
  });

  it("başka köken, başka şema, başka port → undefined", () => {
    expect(chipReadRequestOf(`https://evil.example/chip/read?r=${handle}&c=${c}`, AS)).toBeUndefined();
    expect(chipReadRequestOf(`http://id.tamga.network/chip/read?r=${handle}&c=${c}`, AS)).toBeUndefined();
    expect(chipReadRequestOf(`https://id.tamga.network:8443/chip/read?r=${handle}&c=${c}`, AS)).toBeUndefined();
    expect(chipReadRequestOf(`https://id.tamga.network.evil.example/chip/read?r=${handle}&c=${c}`, AS)).toBeUndefined();
    expect(chipReadRequestOf(`https://id.tamga.network@evil.example/chip/read?r=${handle}&c=${c}`, AS)).toBeUndefined();
  });

  it("yol tam /chip/read değilse → undefined", () => {
    for (const p of ["/chip/read/", "/chip/reader", "/x/chip/read", "/chip/submit", "/CHIP/READ", "/chip/read/../read"])
      expect(chipReadRequestOf(`${AS}${p}?r=${handle}&c=${c}`, AS)).toBeUndefined();
  });

  it("r ya da c eksik, biçimsiz ya da iki kez verilmiş → undefined", () => {
    expect(chipReadRequestOf(`${AS}/chip/read?c=${c}`, AS)).toBeUndefined();
    expect(chipReadRequestOf(`${AS}/chip/read?r=${handle}`, AS)).toBeUndefined();
    expect(chipReadRequestOf(`${AS}/chip/read?r=nodot&c=${c}`, AS)).toBeUndefined();
    expect(chipReadRequestOf(`${AS}/chip/read?r=par.short&c=${c}`, AS)).toBeUndefined();
    expect(chipReadRequestOf(`${AS}/chip/read?r=a:b.AbCdEfGhIjKlMnOpQr&c=${c}`, AS)).toBeUndefined();
    expect(chipReadRequestOf(`${AS}/chip/read?r=${handle}&c=${b64u(new Uint8Array(9))}`, AS)).toBeUndefined();
    expect(chipReadRequestOf(`${AS}/chip/read?r=${handle}&c=AAAA+AAAAAA`, AS)).toBeUndefined();
    expect(chipReadRequestOf(`${AS}/chip/read?r=${handle}&r=${handle}&c=${c}`, AS)).toBeUndefined();
    expect(chipReadRequestOf(`${AS}/chip/read?r=%E0%A4%A&c=${c}`, AS)).toBeUndefined();
  });

  it("yetkilendirme sunucusu URL değilse → undefined", () => {
    expect(chipReadRequestOf(readUrl, "id.tamga.network")).toBeUndefined();
  });
});

async function setup(reply: { status: number; body: unknown }) {
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  await keys.generate("wua.k");
  const wua = { jwt: "wia.jwt", sub: "inst-1", exp: 2_000_000_000, keyRef: "wua.k" } as WuaRecord;
  const calls: Array<{ url: string; method?: string; body?: string; headers?: Record<string, string> }> = [];
  const http: Http = async (url, init) => {
    calls.push({ url, method: init?.method, body: init?.body, headers: init?.headers });
    return {
      status: reply.status,
      text: async () => (typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body)),
    };
  };
  return { keys, wua, calls, http };
}

const bytes = (n: number, fill: number) => new Uint8Array(n).fill(fill);
const fullPayload: ChipReadPayload = {
  sod: bytes(40, 1),
  dg1: bytes(10, 2),
  dg2: bytes(50, 3),
  dg11: bytes(12, 4),
  dg14: bytes(14, 5),
  dg15: bytes(15, 6),
  aaSignature: bytes(64, 7),
  cardAccess: bytes(9, 8),
};
const req = () => chipReadRequestOf(readUrl, AS) as ChipReadRequest;
let rnd = 0;
const randomBytes = (n: number) => new Uint8Array(n).map(() => rnd++ & 0xff);

describe("submitChipRead", () => {
  it("POST /chip/submit: JSON + cüzdan kanıtı başlıkları (aud = yetkilendirme sunucusu), gövde base64url", async () => {
    const s = await setup({ status: 200, body: { next: `${AS}/chip/continue?r=x` } });
    const out = await submitChipRead({
      request: req(),
      payload: fullPayload,
      keys: s.keys,
      wua: s.wua,
      http: s.http,
      randomBytes,
      now: 1_800_000_000,
    });
    expect(out).toEqual({ next: `${AS}/chip/continue?r=x` });
    expect(s.calls).toHaveLength(1);
    const call = s.calls[0];
    expect(call.url).toBe(`${AS}/chip/submit`);
    expect(call.method).toBe("POST");
    expect(call.headers?.["content-type"]).toBe("application/json");
    expect(call.headers?.["oauth-client-attestation"]).toBe("wia.jwt");
    const pop = call.headers?.["oauth-client-attestation-pop"] as string;
    const claims = JSON.parse(b64uToUtf8(pop.split(".")[1])) as { aud: string };
    expect(claims.aud).toBe(AS);
    const body = JSON.parse(call.body as string) as Record<string, string>;
    expect(Object.keys(body).sort()).toEqual(
      ["aa_signature", "card_access", "dg1", "dg11", "dg14", "dg15", "dg2", "handle", "sod"].sort(),
    );
    expect(body.handle).toBe(handle);
    expect(Array.from(b64uDecode(body.sod))).toEqual(Array.from(fullPayload.sod));
    expect(Array.from(b64uDecode(body.dg2))).toEqual(Array.from(fullPayload.dg2));
    expect(Array.from(b64uDecode(body.aa_signature))).toEqual(Array.from(fullPayload.aaSignature!));
    expect(Array.from(b64uDecode(body.card_access))).toEqual(Array.from(fullPayload.cardAccess!));
    for (const v of Object.values(body)) expect(v).toMatch(/^[A-Za-z0-9_.-]+$/); // dolgusuz base64url
  });

  it("isteğe bağlı alanlar yoksa gövdede de yok", async () => {
    const s = await setup({ status: 200, body: { next: `${AS}/chip/continue` } });
    await submitChipRead({
      request: req(),
      payload: { sod: fullPayload.sod, dg1: fullPayload.dg1, dg2: fullPayload.dg2 },
      keys: s.keys,
      wua: s.wua,
      http: s.http,
      randomBytes,
    });
    expect(Object.keys(JSON.parse(s.calls[0].body as string)).sort()).toEqual(["dg1", "dg2", "handle", "sod"]);
  });

  it("4xx/5xx → issuer_error, iletide yalnız sunucunun hata kodu; veri iletiye girmez", async () => {
    for (const [status, body, expected] of [
      [400, { error: "invalid_request" }, "chip submit error: invalid_request"],
      [409, { error: "handle_used" }, "chip submit error: handle_used"],
      [500, "<html>oops</html>", "chip submit error: 500"],
      [400, { error: "Bad <script>" }, "chip submit error: 400"],
    ] as const) {
      const s = await setup({ status, body });
      const e = await submitChipRead({
        request: req(),
        payload: fullPayload,
        keys: s.keys,
        wua: s.wua,
        http: s.http,
        randomBytes,
      }).catch((x: unknown) => x);
      expect(e).toMatchObject({ code: "issuer_error", message: expected });
      expect((e as Error).message).not.toContain(b64u(fullPayload.dg1));
    }
  });

  it("next başka kökende ya da yoksa → hata", async () => {
    for (const body of [{ next: "https://evil.example/chip/continue" }, { next: 5 }, {}, { next: "/chip/continue" }]) {
      const s = await setup({ status: 200, body });
      await expect(
        submitChipRead({ request: req(), payload: fullPayload, keys: s.keys, wua: s.wua, http: s.http, randomBytes }),
      ).rejects.toMatchObject({ code: "issuer_error" });
    }
  });
});
