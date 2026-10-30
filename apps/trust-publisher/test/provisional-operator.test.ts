/**
 * ADR-0070 OP2 — geçici işletmecinin tek değeri: kendi kayıtları değerle birebir, liste işletmecisi "Tamga Network".
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkProvisionalOperator, type ProvisionalOperator } from "../src/provisional-operator.js";

const REG = resolve(import.meta.dirname, "../registry");
const read = (f: string) => JSON.parse(readFileSync(resolve(REG, f), "utf8"));
const cfg = read("provisional-operator.json") as ProvisionalOperator;

describe("ADR-0070 checkProvisionalOperator", () => {
  it("gerçek ağın kayıt kaynağı tek değerle uyumlu", () => {
    const tl = read("tl-tr.source.json");
    const lotl = read("lotl.source.json");
    expect(
      checkProvisionalOperator(cfg, {
        tlOperator: tl.operator,
        lotlOperator: lotl.operator,
        issuers: tl.issuers,
        relyingParties: tl.relying_parties,
      }),
    ).toEqual([]);
  });
  it("farklı ad, numara ya da adres yayını durdurur; liste işletmecisi geçici işletmecinin adını alamaz", () => {
    const own = {
      slug: "tamga-id",
      status: "ACTIVE",
      identifiers: [{ scheme: "TR-VKN", value: "TR0000000000", note: "provisional operator (geçici işletmeci)" }],
      operator: { name: "Başka Şirket", status: "provisional", on_behalf_of: cfg.on_behalf_of },
      postal_address: { ...cfg.postal_address, locality: "Ankara" },
    };
    const errs = checkProvisionalOperator(cfg, {
      tlOperator: { name: cfg.name },
      issuers: [own],
      relyingParties: [],
    });
    expect(errs.join("\n")).toMatch(/liste işletmecisi adı/);
    expect(errs.join("\n")).toMatch(/operator.name farklı/);
    expect(errs.join("\n")).toMatch(/kimlik numarası/);
    expect(errs.join("\n")).toMatch(/postal_address.locality/);
  });
  it("geçici işletmeci notu olmayan kayıt (kurum) ve geri çekilmiş kayıt denetlenmez", () => {
    expect(
      checkProvisionalOperator(cfg, {
        issuers: [
          { slug: "bubilet", identifiers: [{ scheme: "TR-VKN", value: "TR1" }] },
          { slug: "old", status: "REVOKED", identifiers: [{ scheme: "X", value: "Y", note: "provisional operator" }] },
        ],
        relyingParties: [],
      }),
    ).toEqual([]);
  });
});
