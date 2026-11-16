/**
 * ADR-0069 — liste yayıncısının `terminal_groups[]` denetimi (TG1 tek kimlik, TG2 etkin grupta kurum + politika).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { activeGroupsOfInstitution, checkTerminalGroups, groupWithdrawalWarnings } from "../src/terminal-groups.js";

const NOW = new Date("2026-10-29T00:00:00Z");
const issuers = [{ slug: "example-events" }, { slug: "example-university" }, { slug: "eski-kurum", status: "REVOKED" }];
const group = (o: Record<string, unknown> = {}) => ({
  group_id: "example-events-gate",
  institution_id: "example-events",
  allowed_policies: ["event-ticket"],
  valid_from: "2026-10-01T00:00:00Z",
  ...o,
});
const rp = (groups: unknown, dns = "verify.sandbox.tamga.network") => ({ dns_name: dns, terminal_groups: groups });

describe("ADR-0069 checkTerminalGroups", () => {
  it("geçerli grup ve grupsuz doğrulayıcı hatasız", () => {
    expect(checkTerminalGroups([rp([group()]), { dns_name: "x.example" }], issuers, NOW)).toEqual([]);
  });
  it("etkin grupta kurum ve politika zorunlu; kurum listede olmalı (belge veren slug'ı ya da doğrulayıcı dns_name'i)", () => {
    const e1 = checkTerminalGroups([rp([group({ institution_id: undefined, allowed_policies: [] })])], issuers, NOW);
    expect(e1.join(" ")).toMatch(/institution_id zorunlu/);
    expect(e1.join(" ")).toMatch(/allowed_policies/);
    expect(checkTerminalGroups([rp([group({ institution_id: "yok-boyle" })])], issuers, NOW).join(" ")).toMatch(
      /listede bir kurum değil/,
    );
    // doğrulayıcının kendisi de kurum olabilir
    expect(
      checkTerminalGroups([rp([group({ institution_id: "verify.sandbox.tamga.network" })])], issuers, NOW),
    ).toEqual([]);
  });
  it("K12 (kontrol 2026-11-03): etkin grup ACTIVE olmayan kuruma (REVOKED belge veren ya da SUSPENDED doğrulayıcı) bağlanamaz; geri çekilmiş grup bağlanabilir", () => {
    const e1 = checkTerminalGroups([rp([group({ institution_id: "eski-kurum" })])], issuers, NOW);
    expect(e1.join(" ")).toMatch(/"eski-kurum" REVOKED/);
    const susp = { dns_name: "susp.example", status: "SUSPENDED" };
    expect(
      checkTerminalGroups([rp([group({ institution_id: "susp.example" })]), susp], issuers, NOW).join(" "),
    ).toMatch(/SUSPENDED/);
    // kurumu geri çekilmiş grup `valid_until` ile geri çekilir: hatasız (tarih kaydı)
    expect(
      checkTerminalGroups(
        [rp([group({ institution_id: "eski-kurum", valid_until: "2026-10-04T00:00:00Z" })])],
        issuers,
        NOW,
      ),
    ).toEqual([]);
  });
  it("geri çekilmiş grup eski biçimle kalabilir (tarih kaydı)", () => {
    const old = {
      group_id: "example-university-campus",
      label: "eski",
      valid_from: "2026-09-25T00:00:00Z",
      valid_until: "2026-10-04T00:00:00Z",
    };
    expect(checkTerminalGroups([rp([old])], issuers, NOW)).toEqual([]);
  });
  it("TG1: grup kimliği listede iki kez; sertifika parmak izi iki grupta; bozuk biçim", () => {
    const fp = "a".repeat(64);
    const dup = checkTerminalGroups(
      [rp([group({ cert_fingerprints: [fp] })]), rp([group({ cert_fingerprints: [fp] })], "other.example")],
      issuers,
      NOW,
    ).join(" ");
    expect(dup).toMatch(/iki kez/);
    expect(dup).toMatch(/parmak izi/);
    expect(checkTerminalGroups([rp([group({ group_id: "Kapı A" })])], issuers, NOW).join(" ")).toMatch(/biçimi/);
    expect(checkTerminalGroups([rp("dizi değil")], issuers, NOW).join(" ")).toMatch(/dizi/);
  });
  it("kayıt defterleri (sandbox, test, gerçek ağ) denetimden geçer", () => {
    for (const dir of ["registry-sandbox", "test/fixtures/registry", "registry"]) {
      const tl = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", dir, "tl-tr.source.json"), "utf8")) as {
        issuers: Array<Record<string, unknown>>;
        relying_parties: Array<Record<string, unknown>>;
      };
      expect(checkTerminalGroups(tl.relying_parties, tl.issuers, NOW), dir).toEqual([]);
    }
  });
});

describe("Y9 kurumu askıya almadan önce kapı gruplarının geri çekilmesi", () => {
  const rps = [
    rp([group(), group({ group_id: "example-events-old", valid_until: "2026-10-04T00:00:00Z" })]),
    rp([group({ group_id: "uni-gate", institution_id: "example-university" })], "other.example"),
  ];
  it("yalnız kuruma bağlı ve geri çekilmemiş gruplar listelenir", () => {
    expect(activeGroupsOfInstitution(rps, "example-events", NOW)).toEqual([
      { dns_name: "verify.sandbox.tamga.network", group_id: "example-events-gate" },
    ]);
    expect(activeGroupsOfInstitution(rps, "yok-boyle", NOW)).toEqual([]);
  });
  it("askı / iptal / emeklilikte uyarı ve end-use komutu; ACTIVE'e dönüşte ve grupsuz kurumda uyarı yok", () => {
    const w = groupWithdrawalWarnings(rps, "example-events", "SUSPENDED", NOW).join(" | ");
    expect(w).toMatch(/1 etkin kapı grubu/);
    expect(w).toContain("end-use verify.sandbox.tamga.network example-events-gate");
    expect(w).toMatch(/ADR-0088/);
    expect(groupWithdrawalWarnings(rps, "example-university", "REVOKED", NOW).join(" ")).toContain(
      "end-use other.example uni-gate",
    );
    expect(groupWithdrawalWarnings(rps, "example-events", "ACTIVE", NOW)).toEqual([]);
    expect(groupWithdrawalWarnings(rps, "yok-boyle", "SUSPENDED", NOW)).toEqual([]);
  });
  it("uyarı söylediğini yapar: grubu geri çekmeden askı yayın denetiminden geçmez, çekince geçer", () => {
    const suspended = [{ slug: "example-events", status: "SUSPENDED" }, { slug: "example-university" }];
    expect(checkTerminalGroups(rps, suspended, NOW).join(" ")).toMatch(/SUSPENDED/);
    const withdrawn = [
      rp([
        group({ valid_until: NOW.toISOString() }),
        group({ group_id: "example-events-old", valid_until: "2026-10-04T00:00:00Z" }),
      ]),
      rps[1],
    ];
    expect(checkTerminalGroups(withdrawn, suspended, NOW)).toEqual([]);
  });
});
