/**
 * Deney (üretimde kullanılmaz): Tamga'nın kendi mdoc'u Longfellow ZK (mdoc_zk, devre sürümü 8) girdi kurallarına uyuyor mu?
 *
 * Longfellow ispatı henüz bu makinede derlenemiyor (C derleyicisi yok; README). Bu betik bunun yerine
 * @tamga-network/mdoc ile GERÇEK bir mdoc + DeviceResponse üretir ve devrenin kaynakta tanımlı bayt kurallarını
 * birebir uygular. Sabitler: longfellow-zk @ d5e6be7 (2026-09-30),
 *   rust/applications/mdoc_zk/proto/src/hash/constants.rs, .../mso_attribute/constants.rs,
 *   rust/applications/mdoc_zk/runtime/src/utils.rs (circuit_supports), .../circuits/src/cbor/mdoc.rs.
 * Anahtarlar deneye özeldir ve atılır; kişi verileri SAHTE.
 *
 *   npx tsx tools/zk-circuit/check-compat.ts        (tamga-network kökünden)
 */
import { randomBytes } from "node:crypto";
import {
  issueMdoc,
  buildDeviceResponse,
  deviceSign,
  oid4vpSessionTranscript,
  encode,
  decode,
  CborTag,
  p256,
  type CborValue,
} from "@tamga-network/mdoc";

// ---- Longfellow v8 sabitleri (kaynaktan birebir)
const K_MAX_SHA_BLOCKS = 40;
const K_COSE1_PREFIX = Uint8Array.from([0x84, 0x6a, ...Buffer.from("Signature1"), 0x43, 0xa1, 0x01, 0x26, 0x40, 0x59]);
const K_DOCTYPE_HEADER = Uint8Array.from([0x67, ...Buffer.from("docType")]);
const K_VALID_FROM = Uint8Array.from([0x69, ...Buffer.from("validFrom"), 0xc0, 0x74]);
const K_VALID_UNTIL = Uint8Array.from([0x6a, ...Buffer.from("validUntil"), 0xc0, 0x74]);
const K_DEVICE_KEY_INFO = Uint8Array.from([
  0x6d,
  ...Buffer.from("deviceKeyInfo"),
  0xa1,
  0x69,
  ...Buffer.from("deviceKey"),
  0xa4,
  0x01,
  0x02,
  0x20,
  0x01,
  0x21,
  0x58,
  0x20,
]);
const K_VALUE_DIGESTS = Uint8Array.from([0x6c, ...Buffer.from("valueDigests")]);
const K_MAX_ATTR_CBOR_LEN = 2 * 64 - 9; // 119: IssuerSignedItemBytes (tag24 dahil) iki SHA-256 bloğuna sığmalı
const K_ID_PAD = 32; // v7+: elementIdentifier CBOR'u 32 bayta kadar
const K_VALUE_PAD = 64; // v7+: elementValue CBOR'u 64 bayta kadar

const find = (hay: Uint8Array, needle: Uint8Array): number => Buffer.from(hay).indexOf(Buffer.from(needle));
const startsWith = (a: Uint8Array, b: Uint8Array) => b.every((x, i) => a[i] === x);

/** runtime/src/utils.rs circuit_supports: metin, bayt, tamsayı, bool, tag 1004 (14 bayt), tag 0 (22 bayt). */
function valueSupported(v: CborValue): { ok: boolean; why: string } {
  const b = encode(v);
  if (typeof v === "string" || v instanceof Uint8Array || typeof v === "number" || typeof v === "bigint")
    return { ok: true, why: "" };
  if (typeof v === "boolean") return { ok: true, why: "" };
  if (v instanceof CborTag) {
    if (v.tag === 1004) return { ok: b.length === 14, why: "full-date 14 bayt olmalı" };
    if (v.tag === 0) return { ok: b.length === 22, why: "tdate 22 bayt olmalı" };
  }
  return { ok: false, why: "desteklenmeyen CBOR türü" };
}

type Row = { check: string; ok: boolean; detail: string };

function checkMdoc(label: string, docType: string, ns: string, claims: Record<string, CborValue>, withStatus: boolean) {
  const issuerSk = p256.utils.randomSecretKey();
  const deviceSk = p256.utils.randomSecretKey();
  const deviceKeyRaw = p256.getPublicKey(deviceSk, false);
  const now = Math.floor(Date.now() / 1000);
  const t0 = performance.now();
  const issued = issueMdoc({
    docType,
    namespaces: { [ns]: claims },
    deviceKeyRaw,
    issuerSk,
    x5chain: [randomBytes(420)], // sertifika baytları devre girdisi değil (issuer açık anahtarı ayrı verilir)
    signed: now,
    validFrom: now,
    validUntil: now + 30 * 86400,
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
    ...(withStatus ? { status: { idx: 4711, uri: "https://status.tamga.network/0123456789abcdef" } } : {}),
  });
  const transcript = oid4vpSessionTranscript("x509_san_dns:verify.tamga.network", "n-0123456789", "https://verify.tamga.network/vp/response");
  const devSig = deviceSign(transcript, docType, deviceSk);
  const deviceResponse = buildDeviceResponse({ docType, issuerSigned: issued.issuerSigned, deviceSignature: devSig });
  const tIssue = performance.now() - t0;

  const rows: Row[] = [];
  const is = decode(issued.issuerSigned) as Map<string, CborValue>;
  const issuerAuth = is.get("issuerAuth") as CborValue[];
  const protectedBstr = issuerAuth[0] as Uint8Array;
  const payload = issuerAuth[2] as Uint8Array; // = encode(tag24(bstr(MSO)))
  const tbs = encode(["Signature1", protectedBstr, new Uint8Array(0), payload]);

  rows.push({
    check: "COSE Sig_structure öneki (yalnız {1:-7}, boş aad, 2 bayt uzunluklu yük)",
    ok: startsWith(tbs, K_COSE1_PREFIX),
    detail: Buffer.from(tbs.slice(0, 18)).toString("hex"),
  });
  const blocks = Math.ceil((tbs.length + 9) / 64);
  rows.push({
    check: `MSO imza girdisi ≤ ${K_MAX_SHA_BLOCKS} SHA-256 bloğu`,
    ok: blocks <= K_MAX_SHA_BLOCKS,
    detail: `${tbs.length} bayt → ${blocks} blok`,
  });
  rows.push({ check: "MSO: docType anahtarı", ok: find(payload, K_DOCTYPE_HEADER) >= 0, detail: "" });
  rows.push({ check: "MSO: validFrom = tag0 + 20 karakter", ok: find(payload, K_VALID_FROM) >= 0, detail: "" });
  rows.push({ check: "MSO: validUntil = tag0 + 20 karakter", ok: find(payload, K_VALID_UNTIL) >= 0, detail: "" });
  rows.push({
    check: "MSO: deviceKeyInfo = {deviceKey: {1:2,-1:1,-2,-3}} (tam bayt dizisi)",
    ok: find(payload, K_DEVICE_KEY_INFO) >= 0,
    detail: "",
  });
  rows.push({ check: "MSO: valueDigests anahtarı", ok: find(payload, K_VALUE_DIGESTS) >= 0, detail: "" });

  // Öznitelik başına: hangisi ZK ile açıklanabilir?
  const items = ((is.get("nameSpaces") as Map<string, CborValue>).get(ns) as CborTag[]) ?? [];
  const attrs: { id: string; itemLen: number; idLen: number; valLen: number; ok: boolean; why: string }[] = [];
  for (const it of items) {
    const itemBytes = encode(it); // #6.24(bstr) — özetlenen baytların tamamı
    const m = decode(it.value as Uint8Array) as Map<string, CborValue>;
    const id = m.get("elementIdentifier") as string;
    const val = m.get("elementValue") as CborValue;
    const idLen = encode(id).length;
    const valLen = encode(val).length;
    const sup = valueSupported(val);
    const why = [
      itemBytes.length > K_MAX_ATTR_CBOR_LEN ? `kayıt ${itemBytes.length} > ${K_MAX_ATTR_CBOR_LEN} bayt` : "",
      idLen > K_ID_PAD ? `ad ${idLen} > ${K_ID_PAD}` : "",
      valLen > K_VALUE_PAD ? `değer ${valLen} > ${K_VALUE_PAD}` : "",
      sup.ok ? "" : sup.why,
      (m.get("random") as Uint8Array).length < 16 ? "random < 16" : "",
    ]
      .filter(Boolean)
      .join("; ");
    attrs.push({ id, itemLen: itemBytes.length, idLen, valLen, ok: !why, why });
  }
  return {
    label,
    docType,
    ns,
    rows,
    attrs,
    sizes: {
      issuerSigned: issued.issuerSigned.length,
      deviceResponse: deviceResponse.length,
      msoPayload: payload.length,
    },
    tIssueMs: tIssue,
  };
}

// Sahte kimlik verisi — Tamga kimlik belgesinin gerçek alan kümesi (FW-RB-0005), gerçek kişi değil
const tamgaIdentity: Record<string, CborValue> = {
  given_name: "AYŞE",
  family_name: "YILMAZ",
  birth_date: "1990-05-14",
  nationality: "TR",
  personal_administrative_number: "10000000146", // sahte (test) numara
  document_type: "ID_CARD",
  document_number_hash: "sha256-" + Buffer.from(randomBytes(32)).toString("base64url"),
  issuing_country: "TR",
  document_chip_verified: false,
  verification_method: "remote-document-liveness-face",
  age_over_18: true,
};
const isoAge: Record<string, CborValue> = { age_over_18: true, age_over_21: true, issuing_country: "TR" };

const results = [
  checkMdoc(
    "A — Tamga kimlik belgesi (bugünkü)",
    "urn:tamga:id:IdentityAttestation:1",
    "tamga.id.1",
    tamgaIdentity,
    true,
  ),
  checkMdoc(
    "B — ISO ad alanı / mDL docType (karşılaştırma)",
    "org.iso.18013.5.1.mDL",
    "org.iso.18013.5.1",
    isoAge,
    false,
  ),
];

for (const r of results) {
  console.log(`\n## ${r.label}\n   docType=${r.docType}  namespace=${r.ns}`);
  console.log(
    `   boyut: issuerSigned ${r.sizes.issuerSigned} B · DeviceResponse ${r.sizes.deviceResponse} B · MSO yükü ${r.sizes.msoPayload} B · üretim ${r.tIssueMs.toFixed(1)} ms`,
  );
  for (const row of r.rows)
    console.log(`   ${row.ok ? "✓" : "✗"} ${row.check}${row.detail ? `  (${row.detail})` : ""}`);
  console.log("   öznitelik                         kayıt  ad  değer  ZK ile açılabilir");
  for (const a of r.attrs)
    console.log(
      `   ${a.id.padEnd(32)} ${String(a.itemLen).padStart(5)} ${String(a.idLen).padStart(3)} ${String(a.valLen).padStart(6)}  ${a.ok ? "evet" : "HAYIR — " + a.why}`,
    );
}
const allStruct = results.every((r) => r.rows.every((x) => x.ok));
console.log(`\nYapısal uyum (iki belge): ${allStruct ? "TAMAM" : "EKSİK"}`);
