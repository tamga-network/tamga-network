/**
 * Liste ↔ zincir kimlik ve özet dönüşümleri (beta ↔ zincir eşdeğerliği; ADR-0073 K3/K4; ADR-0074 K1). Saf; ağ yok.
 *   issuer_id / ca_id = keccak256(devlet kodu ‖ sertifika SHA-256)   (kontrat: keccak256(abi.encodePacked(bytes2, bytes32)))
 *   schema_id         = keccak256(vct)
 *   rpId              = keccak256(utf8(dns_name))                    (ADR-0073 K4 / CE4)
 *   listId            = keccak256(issuerId ‖ utf8(list_uri))          (StatusListRegistry.listIdOf)
 *   ayrıntı özeti     = SHA-256(RFC 8785 kanonik JSON)               (ADR-0074 K1)
 */
import { createHash } from "node:crypto";
import { keccak256Hex, utf8 } from "@tamga-network/trust";

export const ZERO32 = "0x" + "0".repeat(64);
const hexBytes = (h: string) => Buffer.from(h.replace(/^0x/, ""), "hex");

export const keccakText = (s: string) => keccak256Hex(utf8(s));
export const rpIdOf = (dnsName: string) => keccakText(dnsName.toLowerCase());
export const schemaIdOf = (vct: string) => keccakText(vct);
export const groupIdOf = (groupId: string) => keccakText(groupId);

/** "TR" → 0x5452 (bytes2). */
export function bytes2(cc: string): string {
  if (!/^[A-Z]{2}$/.test(cc)) throw new Error(`chain: devlet kodu iki büyük harf olmalı: ${cc}`);
  return "0x" + Buffer.from(cc, "ascii").toString("hex");
}
/** 0x5452 → "TR" (0x0000 → ""). */
export function stateOf(b2: string): string {
  const h = b2.replace(/^0x/, "");
  return /^0+$/.test(h) ? "" : Buffer.from(h, "hex").toString("ascii");
}

/** Parmak izi (64 hex) → bytes32. */
export const fpToBytes32 = (fp: string) => {
  if (!/^[0-9a-f]{64}$/i.test(fp)) throw new Error(`chain: parmak izi 64 onaltılık olmalı: ${fp.slice(0, 16)}`);
  return "0x" + fp.toLowerCase();
};
export const bytes32ToFp = (b: string) => b.replace(/^0x/, "").toLowerCase();

/** keccak256(state ‖ fp) — kurum ve kök sertifika kimliği. */
export function idFromFingerprint(cc: string, fp: string): string {
  return keccak256Hex(new Uint8Array([...Buffer.from(cc, "ascii"), ...hexBytes(fp)]));
}

export function listIdOf(issuerId: string, listUri: string): string {
  return keccak256Hex(new Uint8Array([...hexBytes(issuerId), ...Buffer.from(listUri, "utf8")]));
}
/** Doğrulayıcının D5 araması: liste adresinin son yol parçası, 64 haneye dolgulu (packages/verifier steps.ts ile aynı). */
export function listLookupIdOf(listUri: string): string {
  const seg = listUri.split("/").pop() ?? "";
  return "0x" + seg.padStart(64, "0");
}

/** SRI `sha256-<base64>` → bytes32 ve geri (ADR-0073 K3: aynı SHA-256 baytları). */
export function sriToBytes32(sri: string): string {
  const m = /^sha256-([A-Za-z0-9+/]+=*)$/.exec(sri);
  if (!m) throw new Error(`chain: SRI özeti beklenmiyor: ${sri.slice(0, 20)}`);
  const b = Buffer.from(m[1], "base64");
  if (b.length !== 32) throw new Error("chain: SRI özeti 32 bayt değil");
  return "0x" + b.toString("hex");
}
export const bytes32ToSri = (b: string) => `sha256-${hexBytes(b).toString("base64")}`;

/** `sha256:<hex>` → bytes32 ve geri (çapa günlüğü biçimi). */
export function tagToBytes32(tag: string): string {
  const m = /^sha256:([0-9a-f]{64})$/i.exec(tag);
  if (!m) throw new Error(`chain: sha256:<hex> özeti beklenmiyor: ${tag.slice(0, 20)}`);
  return "0x" + m[1].toLowerCase();
}
export const bytes32ToTag = (b: string) => `sha256:${b.replace(/^0x/, "").toLowerCase()}`;

/** RFC 8785 (JCS) — bu verideki türler için (metin, tam sayı, mantıksal, null, dizi, nesne): anahtarlar UTF-16 sırasıyla. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v === "boolean" || typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new Error("canonicalJson: sonlu olmayan sayı");
    return JSON.stringify(v);
  }
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
  }
  throw new Error(`canonicalJson: desteklenmeyen tür ${typeof v}`);
}
/** Ayrıntı özeti: kanonik JSON'un SHA-256'sı (bytes32). Boş blok (bütün alanlar yok) → sıfır. */
export function detailsHash(block: Record<string, unknown>): string {
  if (Object.values(block).every((x) => x === undefined)) return ZERO32;
  return "0x" + createHash("sha256").update(canonicalJson(block), "utf8").digest("hex");
}

/** ISO tarih → epoch saniye (aşağı yuvarlanır; liste `sec()` ile aynı). */
export const sec = (iso: string) => Math.floor(Date.parse(iso) / 1000);
export const isoOf = (s: number) => new Date(s * 1000).toISOString();
