// @tamga-network/zk Android kütüphaneleri için 16 KB sayfa boyutu denetimi (packages/zk/scripts/elf-align.mjs): yapay ELF64 /
// ELF32 başlıklarıyla LOAD hizası ve GNU_RELRO kuralları (Android geliştirici belgesi "Support 16 KB page sizes" örnekleri).
import { describe, expect, it } from "vitest";
import { checkElf16k, programHeaders } from "../packages/zk/scripts/elf-align.mjs";

type Ph = { type: number; offset: number; vaddr: number; filesz: number; memsz: number; align: number };
const LOAD = 1;
const RELRO = 0x6474e552;

function elf(phs: Ph[], is64 = true): Buffer {
  const ehsize = is64 ? 64 : 52;
  const phentsize = is64 ? 56 : 32;
  const buf = Buffer.alloc(ehsize + phs.length * phentsize);
  buf.writeUInt32BE(0x7f454c46, 0);
  buf[4] = is64 ? 2 : 1;
  buf[5] = 1;
  if (is64) {
    buf.writeBigUInt64LE(BigInt(ehsize), 0x20);
    buf.writeUInt16LE(phentsize, 0x36);
    buf.writeUInt16LE(phs.length, 0x38);
  } else {
    buf.writeUInt32LE(ehsize, 0x1c);
    buf.writeUInt16LE(phentsize, 0x2a);
    buf.writeUInt16LE(phs.length, 0x2c);
  }
  phs.forEach((p, i) => {
    const b = ehsize + i * phentsize;
    buf.writeUInt32LE(p.type, b);
    if (is64) {
      buf.writeBigUInt64LE(BigInt(p.offset), b + 8);
      buf.writeBigUInt64LE(BigInt(p.vaddr), b + 16);
      buf.writeBigUInt64LE(BigInt(p.filesz), b + 32);
      buf.writeBigUInt64LE(BigInt(p.memsz), b + 40);
      buf.writeBigUInt64LE(BigInt(p.align), b + 48);
    } else {
      buf.writeUInt32LE(p.offset, b + 4);
      buf.writeUInt32LE(p.vaddr, b + 8);
      buf.writeUInt32LE(p.filesz, b + 16);
      buf.writeUInt32LE(p.memsz, b + 20);
      buf.writeUInt32LE(p.align, b + 28);
    }
  });
  return buf;
}
const ph = (type: number, vaddr: number, memsz: number, align: number): Ph => ({
  type,
  offset: vaddr,
  vaddr,
  filesz: memsz,
  memsz,
  align,
});

describe("zk elf-align: 16 KB sayfa boyutu", () => {
  it("4 KB hizalı LOAD reddedilir (ELF64 ve ELF32)", () => {
    for (const is64 of [true, false]) {
      const bad = checkElf16k(elf([ph(LOAD, 0, 0x1000, 0x1000), ph(LOAD, 0x2000, 0x100, 0x1000)], is64));
      expect(bad).toHaveLength(2);
      expect(bad[0]).toMatch(/0x1000 < 0x4000/);
    }
  });

  it("16 KB hizalı, RELRO'suz kütüphane geçer", () => {
    const b = elf([ph(LOAD, 0, 0x680, 0x4000), ph(LOAD, 0x4680, 0x1d8, 0x4000)]);
    expect(checkElf16k(b)).toEqual([]);
    expect(programHeaders(b).headers.map((h: Ph) => h.align)).toEqual([0x4000, 0x4000]);
  });

  it("RELRO sonu 16 KB'ye bölünmüyor ve arkasında yazılabilir veri var → reddedilir (belge örnek 1)", () => {
    const b = elf([ph(LOAD, 0, 0xcfaf0, 0x4000), ph(LOAD, 0xdfaf0, 0x4510, 0x4000), ph(RELRO, 0xdfaf0, 0x1510, 1)]);
    expect(checkElf16k(b).join()).toMatch(/GNU_RELRO/);
  });

  it("RELRO sonu 16 KB'ye bölünüyor → geçer (örnek 2)", () => {
    const b = elf([ph(LOAD, 0, 0xcfaf0, 0x4000), ph(LOAD, 0xdfaf0, 0x3510, 0x4000), ph(RELRO, 0xdfaf0, 0x510, 1)]);
    expect(checkElf16k(b)).toEqual([]);
  });

  it("RELRO kendi LOAD segmentinin sonuna kadar → geçer (örnek 4)", () => {
    const b = elf([ph(LOAD, 0, 0x680, 0x4000), ph(LOAD, 0x4680, 0x980, 0x4000), ph(RELRO, 0x4680, 0x980, 1)]);
    expect(checkElf16k(b)).toEqual([]);
  });

  it("ELF olmayan dosya hata verir", () => {
    expect(() => checkElf16k(Buffer.alloc(64))).toThrow(/ELF değil/);
  });
});
