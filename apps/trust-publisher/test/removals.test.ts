/**
 * TL2 — listeden kayıt çıkarma denetimi (src/removals.ts): önceki yayımlanmış sürümdeki kayıt yeni listede yoksa yayın durur;
 * yalnız kayıt defterindeki onaylı, sayıları birebir tutan çıkarma kaydıyla yayımlanır ve CHANGELOG satırı ad taşımaz.
 * Gerçek kayıt defteri: çıkarma kaydı (`registry/removals.json`) biçimi ve kaynakta test kurumu kalmadığı.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { removalChangelogLine, removedRecords } from "../src/removals.js";

const prev = {
  issuers: [{ issuer_id: "0xa1" }, { issuer_id: "0xa2" }, { issuer_id: "0xa3" }],
  relying_parties: [
    { rp_id: "r1", dns_name: "verify.example", terminal_groups: [{ group_id: "g1" }, { group_id: "g2" }] },
    { rp_id: "r2", dns_name: "old.example" },
  ],
};
const next = {
  issuers: [{ issuer_id: "0xa2" }],
  relying_parties: [{ rp_id: "r1-renewed", dns_name: "Verify.Example" }],
};
const approved = [
  {
    list: "tl-tr",
    date: "2026-11-11",
    issuers: 2,
    relying_parties: 1,
    terminal_groups: 2,
    note: "test records removed",
  },
];

describe("TL2: listeden kayıt çıkarma", () => {
  it("sayım: çıkan belge veren, doğrulayıcı (alan adıyla; sertifika yenilemesi çıkarma değil) ve kapı grubu", () => {
    expect(removedRecords(prev, next)).toEqual({ issuers: 2, relying_parties: 1, terminal_groups: 2 });
    expect(removedRecords(prev, prev)).toEqual({ issuers: 0, relying_parties: 0, terminal_groups: 0 });
    expect(removedRecords(null, next)).toEqual({ issuers: 0, relying_parties: 0, terminal_groups: 0 }); // ilk yayın
    // yeni kayıt eklemek çıkarma değildir
    expect(removedRecords(next, prev)).toEqual({ issuers: 0, relying_parties: 0, terminal_groups: 0 });
  });

  it("çıkarma yoksa satır yok; onaysız çıkarma yayını durdurur; sayılar birebir tutmalı", () => {
    expect(removalChangelogLine("tl-tr", removedRecords(prev, prev), [])).toBeNull();
    const counts = removedRecords(prev, next);
    expect(() => removalChangelogLine("tl-tr", counts, [])).toThrow(/TL2.*DURDU/);
    expect(() => removalChangelogLine("tl-tr", counts, undefined)).toThrow(/TL2/);
    expect(() => removalChangelogLine("tl-tr", counts, [{ ...approved[0], issuers: 3 }])).toThrow(/TL2/);
    expect(() => removalChangelogLine("tl-tr", counts, [{ ...approved[0], list: "tl-kz" }])).toThrow(/TL2/);
    expect(() => removalChangelogLine("tl-tr", counts, [{ ...approved[0], note: "x" }])).toThrow(/TL2/);
    // tek kayıt bile onaysız çıkamaz (kaynaktan yanlışlıkla silinen kurum)
    expect(() =>
      removalChangelogLine("tl-tr", { issuers: 1, relying_parties: 0, terminal_groups: 0 }, approved),
    ).toThrow(/TL2/);
  });

  it("onaylı çıkarma: CHANGELOG satırı sayıları ve gerekçeyi taşır, kimlik ve ad taşımaz", () => {
    const line = removalChangelogLine("tl-tr", removedRecords(prev, next), approved)!;
    expect(line).toMatch(/^records removed from tl-tr: 2 issuer\(s\), 1 relying part\(y\/ies\), 2 terminal group\(s\)/);
    expect(line).toContain("test records removed");
    expect(line).toContain("earlier list versions remain in the archive");
    expect(line).not.toMatch(/0xa1|0xa3|old\.example|g1|g2/);
  });

  it("gerçek kayıt defteri: çıkarma kaydı geçerli; kaynakta test kurumu ve kurumuna bağlı kapı grubu kalmadı", () => {
    const reg = resolve(import.meta.dirname, "../registry");
    const removals = JSON.parse(readFileSync(resolve(reg, "removals.json"), "utf8")) as typeof approved;
    for (const r of removals) {
      expect(r.note).toMatch(/^[\x20-\x7e]{8,200}$/);
      expect(Object.keys(r).sort()).toEqual(["date", "issuers", "list", "note", "relying_parties", "terminal_groups"]);
    }
    expect(
      removalChangelogLine("tl-tr", { issuers: 2, relying_parties: 1, terminal_groups: 2 }, removals),
    ).not.toBeNull();
    const src = JSON.parse(readFileSync(resolve(reg, "tl-tr.source.json"), "utf8")) as {
      operator: { status: string; on_behalf_of: string };
      issuers: Array<{ slug: string; status: string }>;
      relying_parties: Array<{ dns_name: string; status: string; terminal_groups?: unknown[] }>;
    };
    // gerçek listede iptal edilmiş test kaydı yok: kalan her kayıt etkin
    expect(src.issuers.map((i) => [i.slug, i.status])).toEqual([["tamga-id", "ACTIVE"]]);
    expect(src.relying_parties.map((r) => [r.dns_name, r.status])).toEqual([["verify.tamga.network", "ACTIVE"]]);
    expect(src.relying_parties.every((r) => !r.terminal_groups?.length)).toBe(true);
    // geçici işletmeci kaydı yerinde (ADR-0070)
    expect(src.operator.status).toBe("provisional");
    expect(src.operator.on_behalf_of.length).toBeGreaterThan(0);
  });
});
