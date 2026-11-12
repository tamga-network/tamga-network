/**
 * Kayıt kaynağının yayın öncesi denetimleri (src/source-checks.ts, 0.8.3 ikinci inceleme):
 *  - TL11: yalnız bilinen alanlar (bilinmeyen ve hesaplanan alan kaynakta hata — CI3), iletişim alanının biçimi
 *  - ADR-0075 RO5: `dns_name` kaynakta tek ve liste biçiminde
 *  - TL1: liste işletmecisi `provisional`, `on_behalf_of` dolu
 *  - ADR-0070 OP2: geçici işletmeci değeri yoksa gerçek ağda yayın durur; sandbox istisnası açık koşula bağlı
 * Gerçek, sandbox ve test kayıt defterleri SALT OKUNUR okunur: yeni denetimlerin hiçbiri onları reddetmez.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contactProblems,
  listOperatorProblems,
  lotlSourceFieldProblems,
  missingOperatorConfigProblems,
  normalizeDnsName,
  relyingPartyNameProblems,
  tlSourceFieldProblems,
} from "../src/source-checks.js";
import { checkProvisionalOperator } from "../src/provisional-operator.js";
import { checkRegistrations } from "../src/registration.js";
import { testInstitutionSource } from "../src/sandbox-institutions.js";

const APP = resolve(import.meta.dirname, "..");
const REGISTRIES = ["registry", "registry-sandbox", "test/fixtures/registry"] as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;
const read = (dir: string) => ({
  tl: JSON.parse(readFileSync(resolve(APP, dir, "tl-tr.source.json"), "utf8")) as Rec,
  lotl: JSON.parse(readFileSync(resolve(APP, dir, "lotl.source.json"), "utf8")) as Rec,
});
const operatorsOf = (tl: Rec, lotl: Rec): Array<[string, unknown]> => [
  ["tl operator", tl.operator],
  ["lotl operator", lotl.operator],
  ...(lotl.national_lists as Rec[])
    .filter((n) => n.operator !== undefined)
    .map((n): [string, unknown] => [`slot ${n.state_code}`, n.operator]),
];

describe("mevcut kayıt defterleri yeni denetimlerden geçer (salt okunur)", () => {
  for (const dir of REGISTRIES)
    it(`${dir}: bilinmeyen alan yok, adlar tek ve biçimli, işletmeci provisional, iletişim biçimli, işletmeci değeri kuralı`, () => {
      const { tl, lotl } = read(dir);
      expect(tlSourceFieldProblems(tl)).toEqual([]);
      expect(lotlSourceFieldProblems(lotl)).toEqual([]);
      expect(relyingPartyNameProblems(tl.relying_parties)).toEqual([]);
      expect(listOperatorProblems(operatorsOf(tl, lotl))).toEqual([]);
      for (const r of [...tl.issuers, ...tl.relying_parties, ...lotl.wallet_providers] as Rec[])
        expect(contactProblems(String(r.slug ?? r.dns_name ?? r.provider_id), r.contact)).toEqual([]);
      // kayıt verisi denetimi (iletişim biçimi dahil) hata üretmez
      expect(checkRegistrations(tl.relying_parties, tl.issuers).errors).toEqual([]);
      // ADR-0070 OP2: değer dosyası varsa olağan denetim; yoksa yalnız sandbox istisnası
      const env = (lotl.environment ?? "production") as "production" | "sandbox";
      const cfg = resolve(APP, dir, "provisional-operator.json");
      const listOps: Array<[string, unknown]> = [
        ["tl operator", tl.operator],
        ["lotl operator", lotl.operator],
      ];
      const problems = existsSync(cfg)
        ? checkProvisionalOperator(JSON.parse(readFileSync(cfg, "utf8")), {
            tlOperator: tl.operator,
            lotlOperator: lotl.operator,
            issuers: tl.issuers,
            relyingParties: tl.relying_parties,
          })
        : missingOperatorConfigProblems(env, listOps);
      expect(problems).toEqual([]);
      if (dir === "registry") expect(existsSync(cfg)).toBe(true); // gerçek ağda değer dosyası zorunlu
      if (dir === "registry-sandbox") expect(existsSync(cfg)).toBe(false); // sandbox: istisna yolu sınanıyor
    });

  it("sandbox'ta kendi kendine açılan test kurumu kaydı (ADR-0041) izin listesine uyar", () => {
    const rec = testInstitutionSource(
      {
        slug: "t-abc12345",
        name: "Deneme Kurumu",
        kind: "education",
        issuer_url: "https://issuer.sandbox.tamga.network/t-abc12345",
        status_list_base: "https://status.sandbox.tamga.network/",
      } as never,
      new Date("2026-11-11T00:00:00Z"),
    );
    expect(tlSourceFieldProblems({ issuers: [] }, [rec])).toEqual([]);
  });
});

describe("TL11: kaynakta bilinmeyen alan yayını durdurur (sessiz atma yok)", () => {
  const { tl, lotl } = read("test/fixtures/registry");
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

  it("kayıt, iç içe alan ve LOTL düzeyinde bilinmeyen alan adıyla bildirilir", () => {
    const t = clone(tl);
    t.issuers[0].contact_person = "x";
    t.issuers[0].contact = { ...t.issuers[0].contact, mobile: "x" };
    t.relying_parties[0].internal_note = "x";
    t.relying_parties[0].scopes[0].owner = "x";
    t.relying_parties[0].status_history[0].changed_by = "x";
    t.root_cas[0].comment = "x";
    t.extra = 1;
    const p = tlSourceFieldProblems(t);
    for (const k of ["contact_person", "mobile", "internal_note", "owner", "changed_by", "comment", "extra"])
      expect(
        p.some((x) => x.includes(`"${k}"`)),
        k,
      ).toBe(true);
    expect(p).toHaveLength(7);
    const l = clone(lotl);
    l.wallet_providers[0].account_manager = "x";
    l.national_lists[0].roles.registrar.owner = "x";
    l.operator.phone = "x";
    expect(lotlSourceFieldProblems(l)).toHaveLength(3);
  });

  it("CI3: hesaplanan alanlar kaynakta yazılamaz (client_id, rp_id, issuer_id, ca_id, parmak izleri)", () => {
    const t = clone(tl);
    t.relying_parties[0].client_id = "x509_hash:" + "A".repeat(43);
    t.relying_parties[0].rp_id = "0x00";
    t.relying_parties[0].access_cert_fingerprint_sha256 = "0".repeat(64);
    t.issuers[0].issuer_id = "0x00";
    t.issuers[0].cert_fingerprint_sha256 = "0".repeat(64);
    t.root_cas[0].ca_id = "0x00";
    const p = tlSourceFieldProblems(t);
    for (const k of [
      "client_id",
      "rp_id",
      "access_cert_fingerprint_sha256",
      "issuer_id",
      "cert_fingerprint_sha256",
      "ca_id",
    ])
      expect(
        p.some((x) => x.includes(`"${k}"`)),
        k,
      ).toBe(true);
  });

  it("iletişim alanı: https adresi, e-posta ve uluslararası telefon biçimi", () => {
    expect(
      contactProblems("k", { support_uri: "https://kurum.example/destek", email: "destek@kurum.example" }),
    ).toEqual([]);
    expect(contactProblems("k", { phone: "+90 212 000 00 00" })).toEqual([]);
    expect(contactProblems("k", undefined)).toEqual([]);
    expect(contactProblems("k", { support_uri: "http://kurum.example" })).toHaveLength(1);
    expect(contactProblems("k", { support_uri: "kurum.example/destek" })).toHaveLength(1);
    expect(contactProblems("k", { email: "Ad Soyad <ad@kurum.example>" })).toHaveLength(1);
    expect(contactProblems("k", { email: "destek at kurum" })).toHaveLength(1);
    expect(contactProblems("k", { phone: "0212 000 00 00" })).toHaveLength(1);
    // yayın denetimi: biçimsiz iletişim tarihe bakılmadan hata
    const rp = { ...clone(tl.relying_parties[0]), contact: { email: "yok" } };
    expect(checkRegistrations([rp], []).errors.some((e) => /contact\.email/.test(e))).toBe(true);
  });
});

describe("ADR-0075 RO5: dns_name kaynakta tek ve liste biçiminde", () => {
  const rp = (dns_name: string) => ({ dns_name });
  it("yinelenen ad (harf büyüklüğü ve sondaki nokta sayılmadan) reddedilir", () => {
    expect(relyingPartyNameProblems([rp("shop.example"), rp("other.example")])).toEqual([]);
    expect(relyingPartyNameProblems([rp("shop.example"), rp("shop.example")]).join()).toMatch(
      /iki kayıtta \(1\. ve 2\.\)/,
    );
    expect(relyingPartyNameProblems([rp("shop.example"), rp("Shop.Example")]).join()).toMatch(/iki kayıtta/);
    expect(relyingPartyNameProblems([rp("shop.example"), rp("x.example"), rp("shop.example.")]).join()).toMatch(
      /iki kayıtta \(1\. ve 3\.\)/,
    );
    expect(normalizeDnsName(" Shop.Example.. ")).toBe("shop.example");
  });
  it("sonda nokta ve alan adı olmayan yazım reddedilir", () => {
    expect(relyingPartyNameProblems([rp("shop.example.")]).join()).toMatch(/sonda nokta/);
    for (const bad of [".shop.example", "shop..example", "shop example", "shop_1.example", "https://shop.example"])
      expect(relyingPartyNameProblems([rp(bad)]), bad).toHaveLength(1);
  });
});

describe("TL1: liste işletmecisi", () => {
  it("designated, eksik durum ya da boş on_behalf_of ile yayın yapılmaz", () => {
    const ok = { name: "Tamga Network", status: "provisional", on_behalf_of: "TR national authority" };
    expect(listOperatorProblems([["tl operator", ok]])).toEqual([]);
    expect(listOperatorProblems([["tl operator", { ...ok, status: "designated" }]]).join()).toMatch(/provisional/);
    expect(listOperatorProblems([["tl operator", { ...ok, on_behalf_of: "  " }]]).join()).toMatch(/on_behalf_of/);
    expect(listOperatorProblems([["tl operator", { name: "x" }]])).toHaveLength(2);
    expect(listOperatorProblems([["lotl operator", undefined]]).join()).toMatch(/operator yok/);
  });
});

describe("ADR-0070 OP2: geçici işletmeci değeri yoksa", () => {
  const op = (name: string): Array<[string, unknown]> => [
    ["tl operator", { name }],
    ["lotl operator", { name }],
  ];
  it("gerçek ağ kayıt defterinde yayın durur (önce: denetim sessizce atlanıyordu)", () => {
    expect(missingOperatorConfigProblems("production", op("Tamga Network")).join()).toMatch(
      /provisional-operator\.json yok/,
    );
    expect(missingOperatorConfigProblems("production", op("Tamga Network Sandbox (TEST)"))).toHaveLength(1);
  });
  it("sandbox istisnası yalnız (TEST) işaretli liste işletmecisi adıyla", () => {
    expect(missingOperatorConfigProblems("sandbox", op("Tamga Network Sandbox (TEST)"))).toEqual([]);
    expect(missingOperatorConfigProblems("sandbox", op("Tamga Network"))).toHaveLength(2);
    expect(missingOperatorConfigProblems("sandbox", op("Başka Bir İşletmeci A.Ş."))).toHaveLength(2);
    // "(TEST)" işareti yetmez: ad tam olarak kuraldaki ad olmalı
    expect(missingOperatorConfigProblems("sandbox", op("Başka Bir İşletmeci (TEST)"))).toHaveLength(2);
    expect(missingOperatorConfigProblems("sandbox", op("Tamga Network Sandbox (TEST) "))).toHaveLength(2);
  });
});
