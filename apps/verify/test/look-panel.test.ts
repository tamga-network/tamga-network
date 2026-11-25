import { describe, expect, it } from "vitest";
import type { Step, VerificationResult } from "@tamga-network/verifier";
import { lookPanel } from "../src/html.js";

// CL72 "Nereye baktık": beş kartın durumu sonuçtan türetilir; doğrulama mantığı değişmez.
const ALL: Step[] = (["T0", "A1", "A2", "A3", "A3b", "A3c", "A3d", "A4", "A5", "A6", "A7", "A8"] as Step[]).concat([
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
  "B6",
  "C1",
  "C2",
  "C3",
  "C4",
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "E1",
  "E2",
  "E3",
] as Step[]);
const res = (o: Partial<VerificationResult>) =>
  ({
    outcome: "ACCEPTED",
    failed_step: null,
    failed_reason: null,
    indeterminate_reason: null,
    checks_performed: ALL,
    ...o,
  }) as unknown as VerificationResult;
const states = (html: string) => [...html.matchAll(/class="lookcard (\w+)"/g)].map((m) => m[1]);

describe("lookPanel (Nereye baktık)", () => {
  it("kabul: beş kart da denetlendi, iki dilde başlık", () => {
    expect(states(lookPanel(res({}), "en"))).toEqual(["ok", "ok", "ok", "ok", "ok"]);
    expect(lookPanel(res({}), "en")).toContain("What we checked");
    expect(lookPanel(res({}), "tr")).toContain("Nereye baktık");
  });

  it("iptal edilmiş belge: Durum geçmedi, Yetki kısmen denetlendi", () => {
    const done = ALL.slice(0, ALL.indexOf("D6"));
    const html = lookPanel(res({ outcome: "REJECTED", failed_step: "D6", checks_performed: done }), "tr");
    // sıra: İmza, Liste, Yetki (B/C geçti, E'ye sıra gelmedi → Kısmen), Durum, Cihaz bağı
    expect(states(html)).toEqual(["ok", "ok", "partial", "fail", "ok"]);
    expect(html).toContain("Kısmen denetlendi");
    expect(html).toContain("Yapılan denetimler geçti; kalanlara sıra gelmedi.");
    expect(html).toContain("Kurum belgeyi iptal etmiş");
  });

  it("KB-JWT hatası: Cihaz bağı geçmedi; İmza ve Liste kısmen, Yetki ve Durum bakılmadı", () => {
    const done = ALL.slice(0, ALL.indexOf("A6"));
    expect(states(lookPanel(res({ outcome: "REJECTED", failed_step: "A6", checks_performed: done }), "en"))).toEqual([
      "partial",
      "partial",
      "skip",
      "skip",
      "fail",
    ]);
  });

  it("iptal listesine ulaşılamadı: Durum denetlenemedi", () => {
    const done = ALL.slice(0, ALL.indexOf("D1"));
    const html = lookPanel(
      res({
        outcome: "INDETERMINATE",
        failed_step: null,
        indeterminate_reason: "STATUS_UNREACHABLE",
        checks_performed: done,
      }),
      "en",
    );
    expect(states(html)[3]).toBe("indet");
    expect(html).toContain("Could not check");
  });

  it("durum metinle de yazılır (yalnız renk değil) ve kaçışlanır", () => {
    const html = lookPanel(
      res({ outcome: "REJECTED", failed_step: "A3", checks_performed: ["T0", "A1", "A2"] as Step[] }),
      "en",
    );
    expect(html).toContain("Failed");
    expect(html).not.toMatch(/<script|style=/);
  });
});
