// SPEC-BC-0001 §9 — depolama düzeni karşılaştırması (yükseltme güvenliği).
//
// solc `storageLayout` çıktısını AST kimliklerinden arındırıp (normalize) taban çizgisiyle (contracts/storage-layout/*.json,
// depoda) karşılaştırır. Kurallar (OpenZeppelin yükseltme kurallarının sıralı-depolama + __gap karşılığı):
//   1) Taban çizgisindeki her değişken (aynı kontratta, aynı adla) AYNI slot ve offset'te, UYUMLU tipte kalır.
//      Silmek, yeniden adlandırmak, sırasını ya da tipini değiştirmek hatadır.
//   2) `__gap` küçülebilir ama BİTİŞİ aynı kalır (yeni değişken gap'in başına eklenir, gap aynı sayıda azaltılır).
//   3) Yeni değişken yalnız eski bir __gap'in içine ya da taban çizgisinin sonundan sonraya düşebilir.
//   4) Tip uyumu: aynı kodlama ve boyut; yapı (struct) üyeleri önek olarak korunur. Yapıya üye eklemek yalnız
//      mapping DEĞERİ olan yapıda serbesttir (yeni slot'lar başka kayıtla çakışmaz); doğrudan depolanan ya da dizi
//      elemanı olan yapıda boyut değişirse hatadır.
// Harici bağımlılık yok; Hardhat 3 artifact'larının `buildInfoId` alanından build-info çıktısını bulur.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** AST kimliğini tip adından atar: t_struct(Issuer)1234_storage → t_struct(Issuer)_storage. Dizi uzunluğuna dokunmaz. */
export function canonicalType(id) {
  return id.replace(/(t_(?:struct|enum|contract|userDefinedValueType)\([^()]*\))\d+/g, "$1");
}

/** solc storageLayout → AST kimliksiz, karşılaştırılabilir biçim. */
export function normalizeLayout(layout) {
  const storage = (layout.storage ?? []).map((v) => ({
    contract: v.contract.split(":").pop(),
    label: v.label,
    slot: Number(v.slot),
    offset: v.offset,
    type: canonicalType(v.type),
  }));
  const types = {};
  for (const [id, t] of Object.entries(layout.types ?? {})) {
    const n = { encoding: t.encoding, label: t.label, numberOfBytes: Number(t.numberOfBytes) };
    if (t.key) n.key = canonicalType(t.key);
    if (t.value) n.value = canonicalType(t.value);
    if (t.base) n.base = canonicalType(t.base);
    if (t.members)
      n.members = t.members.map((m) => ({
        label: m.label,
        slot: Number(m.slot),
        offset: m.offset,
        type: canonicalType(m.type),
      }));
    types[canonicalType(id)] = n;
  }
  return { storage, types };
}

const slotsOf = (types, v) => Math.max(1, Math.ceil((types[v.type]?.numberOfBytes ?? 32) / 32));

function typeErrors(bTypes, cTypes, bId, cId, ctx, path, out) {
  const b = bTypes[bId];
  const c = cTypes[cId];
  if (!b || !c) {
    if (bId !== cId) out.push(`${path}: tip ${bId} → ${cId}`);
    return;
  }
  if (b.encoding !== c.encoding) {
    out.push(`${path}: kodlama ${b.encoding} → ${c.encoding} (${bId} → ${cId})`);
    return;
  }
  if (b.encoding === "mapping") {
    if (b.key !== c.key) out.push(`${path}: mapping anahtarı ${b.key} → ${c.key}`);
    typeErrors(bTypes, cTypes, b.value, c.value, "mappingValue", `${path}[değer]`, out);
    return;
  }
  if (b.encoding === "dynamic_array") {
    typeErrors(bTypes, cTypes, b.base, c.base, "arrayElem", `${path}[]`, out);
    return;
  }
  if (b.members) {
    if (!c.members) {
      out.push(`${path}: yapı → yapı değil (${cId})`);
      return;
    }
    if (c.members.length < b.members.length) out.push(`${path}: yapı üyesi silindi (${bId})`);
    b.members.forEach((bm, i) => {
      const cm = c.members[i];
      if (!cm) return;
      if (bm.label !== cm.label || bm.slot !== cm.slot || bm.offset !== cm.offset)
        out.push(
          `${path}.${bm.label}: üye yeri/adı değişti (${bm.label}@${bm.slot}:${bm.offset} → ${cm.label}@${cm.slot}:${cm.offset})`,
        );
      else typeErrors(bTypes, cTypes, bm.type, cm.type, "inplace", `${path}.${bm.label}`, out);
    });
    if (c.numberOfBytes !== b.numberOfBytes && ctx !== "mappingValue")
      out.push(
        `${path}: yapı boyutu ${b.numberOfBytes} → ${c.numberOfBytes} bayt (yalnız mapping değeri olan yapı büyüyebilir)`,
      );
    return;
  }
  // Basit / statik dizi / bytes-string: birebir aynı olmalı (statik dizi uzunluğu tip adında).
  if (bId !== cId || b.numberOfBytes !== c.numberOfBytes) out.push(`${path}: tip ${bId} → ${cId}`);
}

/**
 * Taban çizgisi (b) ile güncel (c) normalize düzeni karşılaştırır.
 * @returns {string[]} hatalar (boş = uyumlu)
 */
export function compareLayouts(b, c) {
  const errors = [];
  // solc, kalıtılan değişkenleri de en türemiş kontrat adıyla verir; taban ve türemiş kontratın iki `__gap`'i aynı adı
  // taşır. Anahtar: ad + aynı adın kaçıncı geçişi (bildirim sırası kalıtım sırasıdır, değişmez).
  const keyed = (list) => {
    const seen = new Map();
    for (const v of list) {
      const n = seen.get(v.label) ?? 0;
      seen.set(v.label, n + 1);
      v._key = n === 0 ? `${v.contract}.${v.label}` : `${v.contract}.${v.label}#${n + 1}`;
    }
    return list;
  };
  keyed(b.storage);
  keyed(c.storage);
  const key = (v) => v._key;
  const cur = new Map(c.storage.map((v) => [key(v), v]));
  const base = new Map(b.storage.map((v) => [key(v), v]));
  const isGap = (v) => v.label.startsWith("__gap");
  const gaps = [];
  let baseEnd = 0;

  for (const bv of b.storage) {
    const bSlots = slotsOf(b.types, bv);
    baseEnd = Math.max(baseEnd, bv.slot + bSlots);
    const cv = cur.get(key(bv));
    if (!cv) {
      errors.push(`${key(bv)}: değişken silindi ya da adı değişti (slot ${bv.slot})`);
      continue;
    }
    if (isGap(bv)) {
      gaps.push({ contract: bv.contract, start: bv.slot, end: bv.slot + bSlots });
      const cEnd = cv.slot + slotsOf(c.types, cv);
      if (cEnd !== bv.slot + bSlots)
        errors.push(`${key(bv)}: gap bitişi ${bv.slot + bSlots} → ${cEnd} (yeni değişken kadar gap azaltılmalı)`);
      if (cv.slot < bv.slot) errors.push(`${key(bv)}: gap öne kaydı (slot ${bv.slot} → ${cv.slot})`);
      continue;
    }
    if (cv.slot !== bv.slot || cv.offset !== bv.offset)
      errors.push(`${key(bv)}: yer değişti (slot ${bv.slot}:${bv.offset} → ${cv.slot}:${cv.offset})`);
    typeErrors(b.types, c.types, bv.type, cv.type, "inplace", key(bv), errors);
  }

  for (const cv of c.storage) {
    if (base.has(key(cv))) continue;
    const start = cv.slot;
    const end = cv.slot + slotsOf(c.types, cv);
    const inGap = gaps.some((g) => g.contract === cv.contract && start >= g.start && end <= g.end);
    if (!inGap && start < baseEnd)
      errors.push(
        `${key(cv)}: yeni değişken mevcut düzenin içine eklendi (slot ${start}; yalnız gap içine ya da sona)`,
      );
  }
  return errors;
}

/** Hardhat 3 artifact'ı → o kontratın storageLayout'u (build-info çıktısından). */
export function readLayoutFromArtifacts(contractsRoot, sourcePath, name) {
  const artifactPath = join(contractsRoot, "artifacts", sourcePath, `${name}.json`);
  if (!existsSync(artifactPath)) throw new Error(`artifact yok: ${artifactPath} (önce derle)`);
  const art = JSON.parse(readFileSync(artifactPath, "utf8"));
  const outPath = join(contractsRoot, "artifacts", "build-info", `${art.buildInfoId}.output.json`);
  const out = JSON.parse(readFileSync(outPath, "utf8"));
  const layout = out.output?.contracts?.[art.inputSourceName]?.[name]?.storageLayout;
  if (!layout) throw new Error(`${name}: storageLayout çıktısı yok (hardhat.config.ts outputSelection)`);
  return layout;
}
