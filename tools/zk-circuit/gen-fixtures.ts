/**
 * Deney (üretimde kullanılmaz): Longfellow ZK ispatı için GERÇEK Tamga mdoc girdileri üretir.
 * @tamga-network/mdoc ile mdoc + DeviceResponse (cihaz imzası OpenID4VP SessionTranscript'e bağlı) üretilir; anahtarlar
 * deneye özeldir ve atılır, kişi verileri SAHTE. Çıktı: tools/zk-circuit/out/<senaryo>/ (gitignore).
 *
 *   npx tsx tools/zk-circuit/gen-fixtures.ts     (tamga-network kökünden)
 *
 * Senaryolar:
 *   tamga      — urn:tamga:id:IdentityAttestation:1, namespace tamga.id.1, MSO'da status var, age_over_18 = true
 *   iso        — org.iso.18013.5.1.mDL, namespace org.iso.18013.5.1 (karşılaştırma), age_over_18 = true
 *   tamga-false— tamga, age_over_18 = false (ispat "true" için üretilemez/doğrulanmaz olmalı)
 * Her senaryoda ayrıca: tampered.bin (DeviceResponse'ta age_over_18 değeri true→false, imza/özet bozulur),
 * transcript-other.bin (başka nonce), meta-wrongkey.json (başka issuer anahtarı).
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { issueMdoc, buildDeviceResponse, deviceSign, oid4vpSessionTranscript, p256 } from "@tamga-network/mdoc";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "out");
const rnd = (n: number) => new Uint8Array(randomBytes(n));
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const iso = (s: number) => new Date(s * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

function pk(sk: Uint8Array) {
  const raw = p256.getPublicKey(sk, false); // 04 || X || Y
  return { pkx: "0x" + hex(raw.slice(1, 33)), pky: "0x" + hex(raw.slice(33, 65)) };
}

function scenario(name: string, docType: string, ns: string, age: boolean, withStatus: boolean) {
  const dir = join(OUT, name);
  mkdirSync(dir, { recursive: true });
  const issuerSk = p256.utils.randomSecretKey();
  const deviceSk = p256.utils.randomSecretKey();
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, string | boolean> = {
    given_name: "Ayşe",
    family_name: "Deneme",
    birth_date: "2000-01-01",
    nationality: "TR",
    age_over_18: age,
  };
  const issued = issueMdoc({
    docType,
    namespaces: { [ns]: claims },
    deviceKeyRaw: p256.getPublicKey(deviceSk, false),
    issuerSk,
    x5chain: [rnd(420)],
    signed: now - 60,
    validFrom: now - 60,
    validUntil: now + 30 * 86400,
    randomBytes: rnd,
    ...(withStatus ? { status: { idx: 4711, uri: "https://status.tamga.network/0123456789abcdef" } } : {}),
  });
  const clientId = "x509_san_dns:verify.tamga.network";
  const responseUri = "https://verify.tamga.network/vp/response";
  const nonce = "n-" + hex(rnd(8));
  const transcript = oid4vpSessionTranscript(clientId, nonce, responseUri);
  const other = oid4vpSessionTranscript(clientId, "n-" + hex(rnd(8)), responseUri);
  const dr = buildDeviceResponse({
    docType,
    issuerSigned: issued.issuerSigned,
    deviceSignature: deviceSign(transcript, docType, deviceSk),
  });

  // Değeri kurcala: "age_over_18" + "elementValue" + true(0xf5) → false(0xf4). Özet artık MSO ile tutmaz.
  const buf = Buffer.from(dr);
  const at = buf.indexOf(Buffer.from("age_over_18"));
  const ev = buf.indexOf(Buffer.from("elementValue"), at - 80 > 0 ? at - 80 : 0);
  const tampered = Buffer.from(buf);
  let tamperedOk = false;
  for (const i of [ev + 12, at + 11]) {
    if (tampered[i] === 0xf5) {
      tampered[i] = 0xf4;
      tamperedOk = true;
      break;
    }
  }

  const meta = {
    docType,
    namespace: ns,
    attribute: "age_over_18",
    valueCborHex: "f5",
    now: iso(now),
    ...pk(issuerSk),
    session: { clientId, nonce, responseUri },
  };
  writeFileSync(join(dir, "mdoc.bin"), dr);
  writeFileSync(join(dir, "transcript.bin"), transcript);
  writeFileSync(join(dir, "transcript-other.bin"), other);
  if (tamperedOk) writeFileSync(join(dir, "tampered.bin"), tampered);
  writeFileSync(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
  writeFileSync(
    join(dir, "meta-wrongkey.json"),
    JSON.stringify({ ...meta, ...pk(p256.utils.randomSecretKey()) }, null, 2),
  );
  console.log(
    `${name.padEnd(12)} DeviceResponse ${dr.length} B · transcript ${transcript.length} B · tampered ${tamperedOk ? "evet" : "BULUNAMADI"}`,
  );
}

scenario("tamga", "urn:tamga:id:IdentityAttestation:1", "tamga.id.1", true, true);
scenario("iso", "org.iso.18013.5.1.mDL", "org.iso.18013.5.1", true, false);
scenario("tamga-false", "urn:tamga:id:IdentityAttestation:1", "tamga.id.1", false, true);
