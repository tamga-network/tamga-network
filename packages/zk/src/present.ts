/**
 * ZK sunumu (ADR-0032; AB TS13 §5): cüzdan önce bu oturum için olağan, cihaz imzalı DeviceResponse'u üretir (donanım anahtarı,
 * telefon kilidi onayı — WL11 aynen), sonra ispatçı bu yanıttan "belgede şu öğeler şu değerdedir" ispatını üretir. Doğrulayıcıya
 * yalnız ZkDocument gider: belge, MSO, cihaz anahtarı ve iptal listesi indeksi GİTMEZ (ZK3, ZK4).
 */
import { buildZkDeviceResponse, encode, type CborValue } from "@tamga-network/mdoc";
import { loadCircuit, selectCircuit } from "./circuits.js";
import type { ZkQuery } from "./request.js";
import { ZkError, type ZkCircuitEntry, type ZkCircuitSource, type ZkProveArgs, type ZkProver } from "./types.js";

export interface ZkPresentArgs {
  prover: ZkProver;
  circuits: ZkCircuitSource;
  /** Güven listesindeki devreler (`lotl.zk_circuits`). */
  trustedCircuits: readonly ZkCircuitEntry[] | undefined;
  /**
   * Doğrulayıcının kabul ettiği devre kimlikleri (DCQL `meta.zk_system_type[].params.circuit_hash`). Verilirse yalnız hem güven
   * listesinde hem bu listede olan devre kullanılır — doğrulayıcının kabul etmeyeceği ispat üretilmez.
   */
  acceptedCircuits?: readonly string[];
  query: ZkQuery;
  /** Bu oturumun cihaz imzalı DeviceResponse'u (cüzdanın olağan mdoc sunumu; doğrulayıcıya gönderilmez). */
  deviceResponse: Uint8Array;
  transcript: Uint8Array;
  /** Kurum yaprak sertifikası (+ zincir), DER; ZkDocument'e `msoX5chain` olarak girer. */
  issuerX5chain: Uint8Array[];
  /** Kurum anahtarı, P-256 sıkıştırılmamış nokta (65 bayt). */
  issuerKey: Uint8Array;
  /** Varsayılan: şimdi. */
  now?: Date;
}

const isoSeconds = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

/** İspatı üretir ve doğrulayıcıya gidecek ZK DeviceResponse'u döndürür. Yapılamıyorsa `ZkError` (cüzdan olağan yola döner — ZK5). */
export async function presentZk(a: ZkPresentArgs): Promise<Uint8Array> {
  if (!(await a.prover.available()))
    throw new ZkError("unavailable", "zero-knowledge proofs are not available on this device");
  const version = await a.prover.circuitVersion();
  const trusted = a.acceptedCircuits
    ? (a.trustedCircuits ?? []).filter((c) => a.acceptedCircuits!.includes(c.circuit_id))
    : a.trustedCircuits;
  const entry = selectCircuit(trusted, a.query.claims.length, version);
  const circuit = await loadCircuit(a.circuits, entry);
  const timestamp = isoSeconds(a.now ?? new Date());
  let proof: Uint8Array;
  try {
    proof = await a.prover.prove({
      circuitId: entry.circuit_id,
      circuit,
      deviceResponse: a.deviceResponse,
      transcript: a.transcript,
      docType: a.query.docType,
      claims: a.query.claims,
      now: timestamp,
      issuerKey: a.issuerKey,
    });
  } catch (e) {
    if (e instanceof ZkError) throw e;
    throw new ZkError("prove_failed", "the proof could not be created");
  }
  const elements: Record<string, CborValue> = {};
  for (const c of a.query.claims) elements[c.element] = c.value;
  return buildZkDeviceResponse({
    docType: a.query.docType,
    zkSystemId: entry.circuit_id,
    timestamp,
    disclosed: { namespace: a.query.claims[0].namespace, elements },
    msoX5chain: a.issuerX5chain,
    proof,
  });
}

/**
 * Arka uçların ortak girdi tamponu (Rust `prove_buffer`, packages/zk/rust/src/lib.rs): art arda `u32 LE uzunluk + bayt`.
 *   combined_hash(32) · circuit · device_response · transcript · pkx("0x…") · pky · now · doc_type · öğe sayısı (u32 LE)
 *   · her öğe için namespace · id · değerin CBOR'u
 */
export function encodeProveBuffer(a: ZkProveArgs): Uint8Array {
  if (a.issuerKey.length !== 65 || a.issuerKey[0] !== 0x04)
    throw new ZkError("unsupported_request", "issuer key must be an uncompressed P-256 point");
  const te = new TextEncoder();
  const fields: Uint8Array[] = [
    hexToBytes(a.circuitId),
    a.circuit,
    a.deviceResponse,
    a.transcript,
    te.encode("0x" + toHex(a.issuerKey.subarray(1, 33))),
    te.encode("0x" + toHex(a.issuerKey.subarray(33, 65))),
    te.encode(a.now),
    te.encode(a.docType),
    u32(a.claims.length),
  ];
  for (const c of a.claims) fields.push(te.encode(c.namespace), te.encode(c.element), encode(c.value));
  const out = new Uint8Array(fields.reduce((n, f) => n + 4 + f.length, 0));
  const dv = new DataView(out.buffer);
  let at = 0;
  for (const f of fields) {
    dv.setUint32(at, f.length, true);
    out.set(f, at + 4);
    at += 4 + f.length;
  }
  return out;
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
function u32(n: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}
function hexToBytes(h: string) {
  if (!/^[0-9a-f]{64}$/.test(h))
    throw new ZkError("unsupported_request", "circuit id must be 64 lowercase hex characters");
  return Uint8Array.from(h.match(/../g)!, (x) => parseInt(x, 16));
}
