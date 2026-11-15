#!/usr/bin/env node
/**
 * 16 KB sayfa boyutu denetimi (Android 15+; Google Play 64 bit şartı) — bağımlılıksız ELF program başlığı okuyucusu.
 * Android geliştirici belgesi "Support 16 KB page sizes" iki koşul ister:
 *   1) her PT_LOAD segmentinin hizası (p_align) en az 16384 (2**14);
 *   2) GNU_RELRO yazılabilir verilerle aynı LOAD segmentini paylaşıyorsa sonu (VirtAddr + MemSiz) 16 KB'ye bölünür ya da
 *      RELRO, içinde bulunduğu LOAD segmentinin sonuna kadar uzanır (yoksa 16 KB cihazda o sayfa salt okunur olur, SIGSEGV).
 * Yalnız little-endian ELF32/ELF64 (Android ABI'lerinin hepsi). Sorun yoksa boş dizi döner.
 *   node scripts/elf-align.mjs <dosya.so> [...]     (çıkış kodu 1 = uyumsuz)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const PAGE_16K = 0x4000;
const PT_LOAD = 1;
const PT_GNU_RELRO = 0x6474e552;

/** ELF program başlıkları: { type, offset, vaddr, filesz, memsz, align } (sayılar BigInt değil, Number). */
export function programHeaders(buf) {
  if (buf.length < 52 || buf.readUInt32BE(0) !== 0x7f454c46) throw new Error("ELF değil");
  const is64 = buf[4] === 2;
  if (buf[5] !== 1) throw new Error("yalnız little-endian ELF desteklenir");
  const n = (o) => (is64 ? Number(buf.readBigUInt64LE(o)) : buf.readUInt32LE(o));
  const phoff = n(is64 ? 0x20 : 0x1c);
  const phentsize = buf.readUInt16LE(is64 ? 0x36 : 0x2a);
  const phnum = buf.readUInt16LE(is64 ? 0x38 : 0x2c);
  const out = [];
  for (let i = 0; i < phnum; i++) {
    const b = phoff + i * phentsize;
    const type = buf.readUInt32LE(b);
    out.push(
      is64
        ? { type, offset: n(b + 8), vaddr: n(b + 16), filesz: n(b + 32), memsz: n(b + 40), align: n(b + 48) }
        : { type, offset: n(b + 4), vaddr: n(b + 8), filesz: n(b + 16), memsz: n(b + 20), align: n(b + 28) },
    );
  }
  return { is64, headers: out };
}

/** 16 KB uyumsuzluklarının açıklamaları (boş = uyumlu). */
export function checkElf16k(buf) {
  const { headers } = programHeaders(buf);
  const loads = headers.filter((h) => h.type === PT_LOAD);
  const bad = [];
  if (!loads.length) bad.push("LOAD segmenti yok");
  for (const h of loads)
    if (h.align < PAGE_16K) bad.push(`LOAD vaddr 0x${h.vaddr.toString(16)} hizası 0x${h.align.toString(16)} < 0x4000`);
  for (const r of headers.filter((h) => h.type === PT_GNU_RELRO)) {
    const end = r.vaddr + r.memsz;
    if (end % PAGE_16K === 0) continue;
    const load = loads.find((l) => r.vaddr >= l.vaddr && r.vaddr < l.vaddr + l.memsz);
    if (load && load.vaddr + load.memsz === end) continue; // RELRO segmentin sonuna kadar: arkasında yazılabilir veri yok
    bad.push(`GNU_RELRO sonu 0x${end.toString(16)} 16 KB'ye bölünmüyor ve arkasında yazılabilir veri var`);
  }
  return bad;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let fail = false;
  for (const f of process.argv.slice(2)) {
    const bad = checkElf16k(readFileSync(f));
    const aligns = programHeaders(readFileSync(f))
      .headers.filter((h) => h.type === PT_LOAD)
      .map((h) => "0x" + h.align.toString(16));
    console.log(
      `${bad.length ? "✗" : "✓"} ${f}  LOAD align: ${aligns.join(", ")}${bad.length ? "  — " + bad.join("; ") : ""}`,
    );
    if (bad.length) fail = true;
  }
  process.exit(fail ? 1 : 0);
}
