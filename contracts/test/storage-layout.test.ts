/**
 * SPEC-BC-0001 §9 — depolama düzeni karşılaştırmasının kuralları (scripts/lib/storage-layout.mjs). Gerçek taban çizgisi
 * (storage-layout/IssuerRegistry.json) üzerinde güvenli ve güvensiz yükseltme değişiklikleri taklit edilir.
 * CI adımı: `npm run contracts:storage-check` (contracts:check içinde).
 */
import { expect } from "chai";
import { readFileSync } from "node:fs";

// @ts-expect-error — düz JS modülü (tip bildirimi yok), Node betikleriyle ortak
import { canonicalType, compareLayouts } from "../scripts/lib/storage-layout.mjs";

type Var = { contract: string; label: string; slot: number; offset: number; type: string };
type Layout = { storage: Var[]; types: Record<string, any> };

const baseline = (): Layout =>
  JSON.parse(readFileSync(new URL("../storage-layout/IssuerRegistry.json", import.meta.url), "utf8"));

const derivedGap = (l: Layout) => l.storage[l.storage.length - 1]!;
/** Türemiş kontratın gap'ini bir azaltılmış tip olarak ekler (uzunluk taban çizgisinden okunur). */
const shrunkGap = (l: Layout) => {
  const n = Number(/t_array\(t_uint256\)(\d+)_storage/.exec(derivedGap(l).type)![1]) - 1;
  const t = `t_array(t_uint256)${n}_storage`;
  l.types[t] = { encoding: "inplace", label: `uint256[${n}]`, numberOfBytes: n * 32, base: "t_uint256" };
  return t;
};

describe("Depolama düzeni karşılaştırması (SPEC-BC-0001 §9)", () => {
  it("aynı düzen uyumludur; AST kimliği atılır, dizi uzunluğu korunur", () => {
    expect(compareLayouts(baseline(), baseline())).to.deep.equal([]);
    expect(canonicalType("t_struct(Issuer)1234_storage")).to.equal("t_struct(Issuer)_storage");
    expect(canonicalType("t_array(t_uint256)46_storage")).to.equal("t_array(t_uint256)46_storage");
  });

  it("güvenli: yeni değişken gap'in başına, gap bir azaltılır", () => {
    const c = baseline();
    const shrunk = shrunkGap(c);
    const gap = derivedGap(c);
    c.storage.splice(c.storage.length - 1, 0, { ...gap, label: "_newThing", type: "t_address" });
    gap.slot += 1;
    gap.type = shrunk;
    expect(compareLayouts(baseline(), c)).to.deep.equal([]);
  });

  it("güvensiz: yeni değişken gap azaltılmadan eklenir (gap bitişi kayar)", () => {
    const c = baseline();
    const gap = derivedGap(c);
    c.storage.splice(c.storage.length - 1, 0, { ...gap, label: "_newThing", type: "t_address" });
    gap.slot += 1;
    const errors = compareLayouts(baseline(), c);
    expect(errors.join("\n")).to.match(/gap bitişi/);
  });

  it("güvensiz: mevcut değişkenlerin arasına ekleme (sonrakiler kayar)", () => {
    const c = baseline();
    const i = c.storage.findIndex((v) => v.label === "_issuers");
    for (const v of c.storage.slice(i)) v.slot += 1;
    c.storage.splice(i, 0, { contract: "IssuerRegistry", label: "_inserted", slot: 51, offset: 0, type: "t_address" });
    const errors = compareLayouts(baseline(), c);
    expect(errors.join("\n")).to.match(/_issuers: yer değişti/);
    expect(errors.join("\n")).to.match(/_inserted: yeni değişken mevcut düzenin içine/);
  });

  it("güvensiz: silme, yeniden adlandırma ve tip değişikliği", () => {
    const removed = baseline();
    removed.storage = removed.storage.filter((v) => v.label !== "_authList");
    expect(compareLayouts(baseline(), removed).join("\n")).to.match(/_authList: değişken silindi/);

    const retyped = baseline();
    retyped.storage.find((v) => v.label === "governance")!.type = "t_uint256";
    expect(compareLayouts(baseline(), retyped).join("\n")).to.match(/governance: tip t_address → t_uint256/);
  });

  it("mapping değeri olan yapıya sona üye eklemek serbest; dizi elemanı yapı büyüyemez; üye sırası değişirse hata", () => {
    const grow = (l: Layout, t: string) => {
      const st = l.types[t];
      st.members.push({ label: "extra", slot: st.numberOfBytes / 32, offset: 0, type: "t_uint256" });
      st.numberOfBytes += 32;
      return l;
    };
    // Issuer yalnız `_issuers` mapping değeri → büyüyebilir
    expect(compareLayouts(baseline(), grow(baseline(), "t_struct(Issuer)_storage"))).to.deep.equal([]);
    // SchemaAuth `_pastAuth` dizisinin elemanı da → büyürse dizi elemanları kayar
    const grown = compareLayouts(baseline(), grow(baseline(), "t_struct(SchemaAuth)_storage"));
    expect(grown.join(" | ")).to.match(/_pastAuth.*yapı boyutu/);

    const reordered = baseline();
    const m = reordered.types["t_struct(SchemaAuth)_storage"].members;
    [m[1].label, m[2].label] = [m[2].label, m[1].label];
    expect(compareLayouts(baseline(), reordered).join(" | ")).to.match(/üye yeri\/adı değişti/);
  });
});
