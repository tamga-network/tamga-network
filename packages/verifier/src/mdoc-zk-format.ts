/**
 * Format katmanı — sıfır bilgi ispatlı mdoc (`mso_mdoc_zk`, [[ADR-0032]], AB TS13). A adımları SD-JWT / mdoc ile aynı kodlarla;
 * belgenin kendisi gelmediği için A4–A7 (kurum imzası, özet bütünlüğü, cihaz imzası, geçerlilik) ispatın İÇİNDE denetlenir:
 *  A1 çözme · A8 docType · A2 msoX5chain · A3 yaprak → kök · A3b issuer_id · Z1 ispat (devre imzalı listede — ZK2; yalnız
 *  istenen öğeler — ZK3; zaman damgası tazeliği; Longfellow doğrulaması: kurum anahtarı + docType + değerler + oturum dökümü)
 * B–E ortak hatta. Durum listesi indeksi gelmez (ZK4) → D adımları "uygulanmaz"; ZK ile sunulan belge kısa ömürlüdür (K6).
 */
import { X509Certificate as NodeX509, webcrypto } from "node:crypto";
import { X509Certificate, cryptoProvider } from "@peculiar/x509";
import { b64uToBytes, computeIssuerId } from "@tamga-network/core";
import { dcApiSessionTranscript, oid4vpSessionTranscript, parseZkDeviceResponse } from "@tamga-network/mdoc";
import type { TrustSource } from "@tamga-network/trust";
import type { FormatResult } from "./mdoc-format.js";
import type { Step } from "./verify.js";
import { ZK_CODES, defaultZkBackend, isZkUnavailable, type ZkBackend } from "./zk/backend.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const toAB = (u8: Uint8Array): ArrayBuffer => new Uint8Array(u8).buffer as ArrayBuffer;

/** Yaprak sertifikadan "0x…" onaltılık P-256 koordinatları (Longfellow açık girdisi). */
function coords(leafDer: Uint8Array): { pkx: string; pky: string } {
  const jwk = new NodeX509(leafDer).publicKey.export({ format: "jwk" }) as { x?: string; y?: string; crv?: string };
  if (jwk.crv !== "P-256" || !jwk.x || !jwk.y) throw new Error("issuer key is not P-256");
  const hex = (b64u: string) => "0x" + Buffer.from(b64uToBytes(b64u)).toString("hex");
  return { pkx: hex(jwk.x), pky: hex(jwk.y) };
}

/** Longfellow zaman biçimi: "YYYY-MM-DDTHH:MM:SSZ" (20 karakter). */
const TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

export async function verifyMdocZkFormat(
  presentation: string,
  opt: {
    clientId: string;
    nonce: string;
    responseUri: string;
    origin?: string;
    encJwkThumbprint?: Uint8Array;
    stateCode: string;
    now: number;
    rootCertsDer: Uint8Array[];
    expectedDocTypes: string[];
    /** Politikanın istediği öğe adları (ZK3: ispat yalnız bunları açıklar). */
    requestedElements: string[];
    /** İstenen ad alanı (politika `namespace`). */
    namespace?: string;
    trust: TrustSource;
    /** İspat zaman damgası ile doğrulayıcı saati arasında izin verilen fark (sn). */
    maxSkewSec: number;
    backend?: ZkBackend;
  },
): Promise<FormatResult> {
  const fail = (s: Step, r: string): FormatResult => ({ ok: false, failedStep: s, reason: r });
  // A1 — DeviceResponse (zkDocuments) çözme
  let z: ReturnType<typeof parseZkDeviceResponse>;
  try {
    z = parseZkDeviceResponse(b64uToBytes(presentation));
  } catch (e) {
    return fail("A1", `ZK DeviceResponse could not be decoded: ${(e as Error).message}`);
  }
  // A8 — docType politikada mı
  if (!opt.expectedDocTypes.includes(z.docType)) return fail("A8", `docType not in policy: ${z.docType}`);
  // A2/A3 — kurum sertifikası, verilen köklerden birine zincirlenmeli; ispatın açık girdisi bu sertifikanın anahtarıdır
  const leafDer = z.msoX5chain[0];
  let leaf: X509Certificate;
  try {
    leaf = new X509Certificate(toAB(leafDer));
  } catch (e) {
    return fail("A2", `msoX5chain leaf unreadable: ${(e as Error).message}`);
  }
  try {
    let chained = false;
    for (const rootDer of opt.rootCertsDer) {
      const root = new X509Certificate(toAB(rootDer));
      if (leaf.issuer !== root.subject) continue;
      if (await leaf.verify({ publicKey: root.publicKey, signatureOnly: true })) {
        chained = true;
        break;
      }
    }
    if (!chained) return fail("A3", "msoX5chain leaf does not chain to any of the given roots");
  } catch (e) {
    return fail("A3", `chain: ${(e as Error).message}`);
  }
  // Belgenin imza anı gizli (ZK): sertifika ispat anında geçerli olmalı (kurum anahtarı o an kullanılabilir)
  if (opt.now * 1000 < leaf.notBefore.getTime() || opt.now * 1000 > leaf.notAfter.getTime())
    return fail("A3", "issuer certificate not valid at presentation time");
  const issuerId = computeIssuerId(opt.stateCode, leafDer); // A3b

  // Z1 — devre imzalı listede (ZK2)
  const circuit = opt.trust.zkCircuit?.(z.zkSystemId) ?? null;
  if (!circuit) return fail("Z1", "ZK circuit not in the signed trusted list (ZK2)");
  // Derinlemesine savunma: güven kaynağı zaten yalnız ACTIVE devre verir; yine de askıdaki/emekli devre kabul edilmez
  if (circuit.status !== "ACTIVE") return fail("Z1", `ZK circuit is not active (${circuit.status}) (ZK2)`);
  // Z1 — zaman damgası: biçim + doğrulayıcı saatine yakınlık (oturum dökümü zaten bu isteğe bağlı; damga devrede "şimdi")
  if (!TS_RE.test(z.timestamp)) return fail("Z1", "ZK timestamp format invalid");
  const tsSec = Math.floor(new Date(z.timestamp).getTime() / 1000);
  if (!Number.isFinite(tsSec) || Math.abs(tsSec - opt.now) > opt.maxSkewSec)
    return fail("Z1", "ZK timestamp outside the allowed window");
  // Z1 — ZK3: yalnız istenen öğeler, istenen ad alanında; devrenin öznitelik sayısıyla aynı
  const names = Object.keys(z.disclosed.elements);
  if (opt.namespace && z.disclosed.namespace !== opt.namespace) return fail("Z1", "ZK namespace not requested");
  const extra = names.filter((n) => !opt.requestedElements.includes(n));
  if (extra.length) return fail("Z1", `ZK proof discloses elements that were not requested: ${extra.join(",")} (ZK3)`);
  if (names.length !== circuit.attributes) return fail("Z1", "ZK attribute count does not match the circuit");

  // Z1 — ispat: kurum anahtarı + docType + açıklanan değerler + bu oturumun dökümü (cihaz imzası) — Longfellow
  let pk: { pkx: string; pky: string };
  try {
    pk = coords(leafDer);
  } catch (e) {
    return fail("A3", (e as Error).message);
  }
  const transcript = opt.origin
    ? dcApiSessionTranscript(opt.origin, opt.nonce, opt.encJwkThumbprint ?? null)
    : oid4vpSessionTranscript(opt.clientId, opt.nonce, opt.responseUri, opt.encJwkThumbprint ?? null);
  let code: number;
  try {
    code = await (opt.backend ?? defaultZkBackend()).verify({
      circuitId: circuit.circuit_id,
      circuitSha256: circuit.sha256,
      pkx: pk.pkx,
      pky: pk.pky,
      transcript,
      timestamp: z.timestamp,
      docType: z.docType,
      attributes: names.map((n) => ({ namespace: z.disclosed.namespace, id: n, cbor: z.elementCbor[n] })),
      proof: z.proof,
    });
  } catch (e) {
    // Doğrulayıcı tarafı eksik/bozuk (devre dosyası yok, WASM manifestle tutmuyor ya da yüklenemiyor): sunumun suçu değil →
    // DOĞRULANAMADI (AP2). İspatın kendisinden doğan işleme hatası RED kalır.
    if (isZkUnavailable(e))
      return {
        ok: false,
        failedStep: "Z1",
        reason: `ZK verifier unavailable: ${(e as Error).message}`,
        indeterminate: "SDK_VERSION_MISMATCH",
      };
    return fail("Z1", `ZK proof could not be processed: ${(e as Error).message}`);
  }
  if (code !== 0) return fail("Z1", `ZK proof rejected: ${ZK_CODES[code] ?? `code ${code}`}`);

  const claims: Record<string, unknown> = { ...z.disclosed.elements };
  return {
    ok: true,
    format: "mso_mdoc_zk",
    issuerId,
    vct: z.docType,
    vctIntegrity: null,
    // İmza anı gizli: C1/C2 sunum anına göre (kurum ve şema yetkisi ŞİMDİ geçerli olmalı — iat'tan sıkı)
    iat: tsSec,
    claims,
    disclosedClaimNames: names,
    aDone: ["A1", "A2", "A3", "A3b", "A8", "Z1"],
    // A4–A7 ispatın içinde (Z1 kapsar); A3c CRL/OCSP dev PKI'da yok; A3d cihaz anahtarı gizli (K7)
    aSkipped: ["A3c", "A3d", "A4", "A5", "A6", "A7"],
  };
}
