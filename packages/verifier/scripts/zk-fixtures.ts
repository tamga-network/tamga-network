/**
 * ADR-0032 Aşama 3 — `mso_mdoc_zk` testleri için GERÇEK fikstürler üretir (Rust ispatçısı gerekir; testler gerektirmez).
 *
 *   TAMGA_ZK_BIN=<tamga-zk ikilisi> npx tsx packages/verifier/scripts/zk-fixtures.ts     (tamga-network kökünden)
 *   İkili: tools/zk-circuit (README "Derleme"); varsayılan ~/tools/lf-target-native/release/tamga-zk(.exe)
 *
 * Üretilen (packages/verifier/src/zk/fixtures/): root.der (deneme kök CA), issuer.der (kurum yaprağı, köke zincirli),
 * other-issuer.der (aynı köke zincirli BAŞKA kurum — yanlış anahtar testi), valid.cbor (ZK DeviceResponse: age_over_18 = true),
 * session.json (oturum + zaman damgası + devre); ADR-0044: zk-copy.cbor + session-zk-copy.json (aynı kurumun ZK kopyası —
 * docType ShortLivedIdentityAttestation, ≤ 24 saat, durum listesi yok). Anahtarlar bellekte üretilir ve ATILIR — depoya yalnız
 * sertifikalar girer. Kişi verileri SAHTE. Belge: urn:tamga:id:IdentityAttestation:1 / tamga.id.1 (MSO'da durum listesi var;
 * ispat açmaz — ZK4).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import {
  buildDeviceResponse,
  buildZkDeviceResponse,
  deviceSign,
  issueMdoc,
  oid4vpSessionTranscript,
  p256,
} from "@tamga-network/mdoc";

cryptoProvider.set(webcrypto as unknown as Crypto);
const subtle = webcrypto.subtle;
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../src/zk/fixtures");
const BIN =
  process.env.TAMGA_ZK_BIN ??
  join(homedir(), "tools", "lf-target-native", "release", process.platform === "win32" ? "tamga-zk.exe" : "tamga-zk");
const CIRCUIT_ID = "5a8938159603876eb537a117cfe9e2eaec5a01a042b316a8e57e52e4bb3c9291";
const CIRCUIT = resolve(dirname(fileURLToPath(import.meta.url)), `../src/zk/circuits/${CIRCUIT_ID}.zst`);
const rnd = (n: number) => new Uint8Array(randomBytes(n));
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const b64u = (b: Uint8Array) => Buffer.from(b).toString("base64url");
const iso = (s: number) => new Date(s * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;

/** noble ham özel anahtar → WebCrypto açık anahtar (sertifika öznesi). */
async function pubKeyOf(sk: Uint8Array): Promise<CryptoKey> {
  const raw = p256.getPublicKey(sk, false);
  return subtle.importKey("raw", raw, ALG, true, ["verify"]);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const now = Math.floor(Date.now() / 1000);
  const notBefore = new Date((now - 86400) * 1000);
  const notAfter = new Date((now + 20 * 365 * 86400) * 1000);

  // Deneme kök CA + iki kurum yaprağı (anahtarlar atılır)
  const rootKeys = (await subtle.generateKey(ALG, false, ["sign", "verify"])) as CryptoKeyPair;
  const rootName = "CN=Tamga ZK Test Root (fixtures only),O=Tamga Network Test,C=TR";
  const root = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: rootName,
    notBefore,
    notAfter,
    keys: rootKeys,
    signingAlgorithm: ALG,
  });
  const leafFor = async (sk: Uint8Array, cn: string, serial: string) =>
    X509CertificateGenerator.create({
      serialNumber: serial,
      subject: `CN=${cn},O=Tamga Network Test,C=TR`,
      issuer: rootName,
      notBefore,
      notAfter,
      publicKey: await pubKeyOf(sk),
      signingKey: rootKeys.privateKey,
      signingAlgorithm: ALG,
    });
  const issuerSk = p256.utils.randomSecretKey();
  const issuer = await leafFor(issuerSk, "Tamga ZK Test Issuer", "02");
  const other = await leafFor(p256.utils.randomSecretKey(), "Tamga ZK Other Issuer", "03");
  const issuerDer = new Uint8Array(issuer.rawData);

  // Belge (sahte kişi) — cihaz anahtarı da atılır
  const deviceSk = p256.utils.randomSecretKey();
  const docType = "urn:tamga:id:IdentityAttestation:1";
  const namespace = "tamga.id.1";
  const issued = issueMdoc({
    docType,
    namespaces: {
      [namespace]: {
        given_name: "Ayşe",
        family_name: "Deneme",
        birth_date: "2000-01-01",
        nationality: "TR",
        age_over_18: true,
      },
    },
    deviceKeyRaw: p256.getPublicKey(deviceSk, false),
    issuerSk,
    x5chain: [issuerDer],
    signed: now - 120,
    validFrom: now - 120,
    validUntil: now + 20 * 365 * 86400,
    randomBytes: rnd,
    status: { idx: 4711, uri: "https://status.tamga.network/0123456789abcdef" },
  });
  const session = {
    clientId: "x509_san_dns:verify.tamga.network",
    nonce: "n-" + hex(rnd(8)),
    responseUri: "https://verify.tamga.network/vp/response",
  };
  const transcript = oid4vpSessionTranscript(session.clientId, session.nonce, session.responseUri);
  const dr = buildDeviceResponse({
    docType,
    issuerSigned: issued.issuerSigned,
    deviceSignature: deviceSign(transcript, docType, deviceSk),
  });
  const timestamp = iso(now);
  const pubRaw = p256.getPublicKey(issuerSk, false);

  // İspat (Longfellow, deneyin ikilisi)
  const dir = mkdtempSync(join(tmpdir(), "tamga-zk-fx-"));
  const prove = (deviceResponse: Uint8Array, dt: string, tag: string): Uint8Array => {
    writeFileSync(join(dir, `${tag}.mdoc.bin`), deviceResponse);
    writeFileSync(join(dir, "t.bin"), transcript);
    writeFileSync(
      join(dir, `${tag}.m.json`),
      JSON.stringify({
        docType: dt,
        namespace,
        attribute: "age_over_18",
        valueCborHex: "f5",
        now: timestamp,
        pkx: "0x" + hex(pubRaw.slice(1, 33)),
        pky: "0x" + hex(pubRaw.slice(33, 65)),
      }),
    );
    const out = execFileSync(
      BIN,
      [
        "prove",
        CIRCUIT,
        join(dir, `${tag}.mdoc.bin`),
        join(dir, "t.bin"),
        join(dir, `${tag}.m.json`),
        join(dir, `${tag}.p.bin`),
      ],
      { encoding: "utf8" },
    );
    console.log(`prove (${tag}):`, out.trim());
    const proof = new Uint8Array(readFileSync(join(dir, `${tag}.p.bin`)));
    return buildZkDeviceResponse({
      docType: dt,
      zkSystemId: CIRCUIT_ID,
      timestamp,
      disclosed: { namespace, elements: { age_over_18: true } },
      msoX5chain: [issuerDer],
      proof,
    });
  };
  // ADR-0044: aynı kurumun ZK kopyası — ayrı tür (kısa ömür işareti), yalnız age_over_18, ≤ 24 saat, durum listesi yok
  const zkCopyDocType = "urn:tamga:id:ShortLivedIdentityAttestation:1";
  const copyDeviceSk = p256.utils.randomSecretKey();
  const copy = issueMdoc({
    docType: zkCopyDocType,
    namespaces: { [namespace]: { age_over_18: true } },
    deviceKeyRaw: p256.getPublicKey(copyDeviceSk, false),
    issuerSk,
    x5chain: [issuerDer],
    signed: now - 120,
    validFrom: now - 120,
    validUntil: now - 120 + 24 * 3600,
    randomBytes: rnd,
  });
  const copyDr = buildDeviceResponse({
    docType: zkCopyDocType,
    issuerSigned: copy.issuerSigned,
    deviceSignature: deviceSign(transcript, zkCopyDocType, copyDeviceSk),
  });
  try {
    const zkResponse = prove(dr, docType, "main");
    const zkCopyResponse = prove(copyDr, zkCopyDocType, "copy");
    writeFileSync(join(OUT, "zk-copy.cbor"), zkCopyResponse);
    writeFileSync(
      join(OUT, "session-zk-copy.json"),
      JSON.stringify(
        {
          ...session,
          timestamp,
          now,
          docType: zkCopyDocType,
          namespace,
          circuitId: CIRCUIT_ID,
          presentationBytes: zkCopyResponse.length,
        },
        null,
        2,
      ) + "\n",
    );
    writeFileSync(join(OUT, "root.der"), new Uint8Array(root.rawData));
    writeFileSync(join(OUT, "issuer.der"), issuerDer);
    writeFileSync(join(OUT, "other-issuer.der"), new Uint8Array(other.rawData));
    writeFileSync(join(OUT, "valid.cbor"), zkResponse);
    writeFileSync(
      join(OUT, "session.json"),
      JSON.stringify(
        { ...session, timestamp, now, docType, namespace, circuitId: CIRCUIT_ID, presentationBytes: zkResponse.length },
        null,
        2,
      ) + "\n",
    );
    console.log(`fixtures → ${OUT} (presentation ${zkResponse.length} B, b64u ${b64u(zkResponse).length} chars)`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

await main();
