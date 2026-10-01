/**
 * KeyProvider — SPEC-WALLET-0001 §2 / docs/delivery/12 §1.
 *  Holder anahtarları credential kopyası başına üretilir (PR6/WL5), asla seed'den türetilmez (WL1), dışa aktarılmaz.
 *  Demo: SoftwareKeyProvider (P-256, @noble) + KeyStore (uygulama: expo-secure-store) — sapma S-9, WUA'da "software" beyan edilir.
 *  Pilot: SecureEnclaveKeyProvider / StrongBoxKeyProvider aynı arayüzü uygular; iş mantığı değişmez.
 */
import { p256 } from "@noble/curves/nist.js";
import { randomBytes as nobleRandom } from "@noble/hashes/utils.js";
import { b64u, b64uDecode } from "./b64.js";

export interface PublicJwk {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
}
export type KeyStorage = "software" | "tee" | "secure_enclave" | "strongbox" | "wscd";
export interface KeyAttestation {
  storage: KeyStorage;
  level: "W1" | "W2" | "W3";
  platform: string;
}

export interface KeyProvider {
  /** `challenge`: donanım sağlayıcıda anahtar kanıtı (Android key attestation) için; yazılımda yok sayılır */
  generate(ref: string, challenge?: Uint8Array): Promise<PublicJwk>;
  publicKey(ref: string): Promise<PublicJwk | null>;
  /** ES256 imzası: raw r||s (64 bayt). Veri ham baytlardır; sağlayıcı SHA-256'yı kendisi uygular. */
  sign(ref: string, data: Uint8Array): Promise<Uint8Array>;
  delete(ref: string): Promise<void>;
  attestation(): Promise<KeyAttestation>;
}

/** Özel anahtar sarmalayıcısı — uygulama tarafında expo-secure-store; testte bellek. Değer opak dizedir. */
export interface KeyStore {
  get(ref: string): Promise<string | null>;
  set(ref: string, value: string): Promise<void>;
  delete(ref: string): Promise<void>;
}
export class MemoryKeyStore implements KeyStore {
  private m = new Map<string, string>();
  async get(ref: string) {
    return this.m.get(ref) ?? null;
  }
  async set(ref: string, v: string) {
    this.m.set(ref, v);
  }
  async delete(ref: string) {
    this.m.delete(ref);
  }
}

export function rawToJwk(raw65: Uint8Array): PublicJwk {
  if (raw65.length !== 65 || raw65[0] !== 4) throw new Error("P-256 public key must be uncompressed (65 bytes)");
  return { kty: "EC", crv: "P-256", x: b64u(raw65.subarray(1, 33)), y: b64u(raw65.subarray(33, 65)) };
}
export function jwkToRaw(jwk: PublicJwk): Uint8Array {
  const out = new Uint8Array(65);
  out[0] = 4;
  out.set(b64uDecode(jwk.x), 1);
  out.set(b64uDecode(jwk.y), 33);
  return out;
}
export const sameJwk = (a: PublicJwk, b: PublicJwk) => a.x === b.x && a.y === b.y;

export class SoftwareKeyProvider implements KeyProvider {
  constructor(
    private store: KeyStore,
    private opts: { randomBytes?: (n: number) => Uint8Array; platform?: string } = {},
  ) {}
  private key = (ref: string) => `tamga.holder.${ref}`;
  async generate(ref: string): Promise<PublicJwk> {
    if (await this.store.get(this.key(ref))) throw new Error(`anahtar zaten var: ${ref}`);
    const rnd = this.opts.randomBytes ?? nobleRandom;
    let sk: Uint8Array;
    do {
      sk = rnd(32);
    } while (!p256.utils.isValidSecretKey(sk));
    await this.store.set(this.key(ref), b64u(sk));
    return rawToJwk(p256.getPublicKey(sk, false));
  }
  async publicKey(ref: string): Promise<PublicJwk | null> {
    const v = await this.store.get(this.key(ref));
    return v ? rawToJwk(p256.getPublicKey(b64uDecode(v), false)) : null;
  }
  async sign(ref: string, data: Uint8Array): Promise<Uint8Array> {
    const v = await this.store.get(this.key(ref));
    if (!v) throw new Error(`key not found: ${ref}`);
    return p256.sign(data, b64uDecode(v), { prehash: true, lowS: true, format: "compact" });
  }
  async delete(ref: string) {
    await this.store.delete(this.key(ref));
  }
  async attestation(): Promise<KeyAttestation> {
    return { storage: "software", level: "W1", platform: this.opts.platform ?? "unknown" };
  }
}

/** ES256 doğrulama (raw r||s). WebCrypto/jose imzaları lowS normalize etmez → lowS: false. */
export function verifyEs256(signature: Uint8Array, data: Uint8Array, pub: PublicJwk | Uint8Array): boolean {
  const raw = pub instanceof Uint8Array ? pub : jwkToRaw(pub);
  try {
    return p256.verify(signature, data, raw, { prehash: true, lowS: false, format: "compact" });
  } catch {
    return false;
  }
}
