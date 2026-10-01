/**
 * ADR-0036 Part B — iç içe seçici açıklama (RFC 9901 §7.1), ortak kural @tamga-network/core/sd-structure:
 * nesne içi `_sd`, dizi öğesi `{"...": özet}`, özyineleme, sunumda yol seçimi (ata + alt alanlar), kötü yapı reddi.
 */
import { describe, it, expect } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import {
  decodeDisclosures,
  resolveSdPayload,
  selectDisclosuresForPaths,
  getClaimAtPath,
  SdStructureError,
} from "@tamga-network/core/sd-structure";

const b64u = (s: string | Uint8Array) => Buffer.from(s).toString("base64url");
const digest = (d: string) => b64u(createHash("sha256").update(d, "ascii").digest());
const decode = (d: string) => JSON.parse(Buffer.from(d, "base64url").toString("utf8"));
const disc = (arr: unknown[]) => {
  const d = b64u(JSON.stringify([b64u(randomBytes(16)), ...arr]));
  return { d, h: digest(d) };
};

function sample() {
  const city = disc(["locality", "İstanbul"]);
  const ctry = disc(["country", "TR"]);
  const addr = disc(["address", { _sd: [city.h, ctry.h], formatted: "visible" }]); // ata da disclosure (çok düzeyli)
  const n1 = disc(["TR"]);
  const n2 = disc(["AZ"]);
  const name = disc(["given_name", "Ayşe"]);
  const payload = {
    vct: "urn:eudi:pid:1",
    _sd_alg: "sha-256",
    _sd: [addr.h, name.h, "decoy-digest-not-matching-anything"],
    nationalities: [{ "...": n1.h }, { "...": n2.h }, "plain"],
  };
  return { payload, all: [city, ctry, addr, n1, n2, name] };
}

describe("iç içe seçici açıklama (RFC 9901 §7.1)", () => {
  it("nesne, ata disclosure'ı ve dizi öğeleri çözülür; yollar doğru; decoy özet yok sayılır", () => {
    const { payload, all } = sample();
    const dec = decodeDisclosures(
      all.map((x) => x.d),
      digest,
      decode,
    );
    const { claims, resolved } = resolveSdPayload(payload, dec);
    expect(claims).toEqual({
      vct: "urn:eudi:pid:1",
      address: { formatted: "visible", locality: "İstanbul", country: "TR" },
      given_name: "Ayşe",
      nationalities: ["TR", "AZ", "plain"],
    });
    expect(resolved.map((r) => r.path).sort()).toEqual(
      ["address", "address.country", "address.locality", "given_name", "nationalities[0]", "nationalities[1]"].sort(),
    );
    expect(getClaimAtPath(claims, "address.locality")).toBe("İstanbul");
    expect(getClaimAtPath(claims, "nationalities[1]")).toBe("AZ");
  });

  it("sunum seçimi: alt alan istenirse ata da açılır, kardeş açılmaz; dizi istenirse tüm öğeleri", () => {
    const { payload, all } = sample();
    const { resolved } = resolveSdPayload(
      payload,
      decodeDisclosures(
        all.map((x) => x.d),
        digest,
        decode,
      ),
    );
    const pick = selectDisclosuresForPaths(resolved, ["address.locality", "nationalities"]).map((d) => d.path);
    expect(pick.sort()).toEqual(["address", "address.locality", "nationalities[0]", "nationalities[1]"].sort());
    // yalnız seçilenlerle yeniden çözüm: country görünmez
    const chosen = all.filter((x) => resolved.find((r) => r.disclosure === x.d && pick.includes(r.path)));
    const r2 = resolveSdPayload(
      payload,
      decodeDisclosures(
        chosen.map((x) => x.d),
        digest,
        decode,
      ),
    );
    expect(r2.claims.address).toEqual({ formatted: "visible", locality: "İstanbul" });
    expect(() => selectDisclosuresForPaths(resolved, ["address.street"])).toThrow(SdStructureError);
  });

  it("kötü yapı: eşleşmeyen disclosure, iki kez kullanılan özet, yanlış tür disclosure, kök düzey yasak ad → hata", () => {
    const { payload, all } = sample();
    const enc = (xs: { d: string }[]) =>
      decodeDisclosures(
        xs.map((x) => x.d),
        digest,
        decode,
      );
    const stray = disc(["other", 1]);
    expect(() => resolveSdPayload(payload, enc([...all, stray]))).toThrow(/unmatched/);
    const twice = { ...payload, _sd: [...payload._sd, all[5].h] };
    expect(() => resolveSdPayload(twice, enc(all))).toThrow(/more than once/);
    const arrAsProp = disc(["TR"]);
    expect(() => resolveSdPayload({ _sd: [arrAsProp.h] }, enc([arrAsProp]))).toThrow(/array-element disclosure/);
    const status = disc(["status", { x: 1 }]);
    expect(() => resolveSdPayload({ _sd: [status.h] }, enc([status]), new Set(["status"]))).toThrow(
      /cannot be selectively/,
    );
    const proto = disc(["__proto__", { x: 1 }]);
    expect(() => resolveSdPayload({ a: { _sd: [proto.h] } }, enc([proto]))).toThrow(/cannot be selectively/);
  });
});
