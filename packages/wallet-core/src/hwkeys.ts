/**
 * Donanım anahtarı sağlayıcısı (P4 / ARF WUA_16a, SPEC-WALLET-0001 WL1/WL3). Yerel arka uç (iOS Secure Enclave, Android
 * StrongBox/TEE — uygulamanın `TamgaKeys` modülü) varsa YENİ anahtarlar orada üretilir; yoksa yazılım anahtarı (sapma S-9).
 * Arka uçta bulunmayan eski anahtarlar yazılım deposundan kullanılmaya devam eder (geçiş kodu yok; ADR-0029).
 * Köprüdeki ikili veri standart base64; imza ham r||s.
 */
import { b64, b64Decode, b64u } from "./b64.js";
import type { KeyAttestation, KeyProvider, KeyStorage, PublicJwk } from "./keys.js";

export type HardwareStorage = "secure_enclave" | "strongbox" | "tee" | "software" | "none";
export interface NativeKeyBackend {
  info(): Promise<{ storage: HardwareStorage; platform: string }>;
  generate(
    ref: string,
    challenge: string | null,
  ): Promise<{ x: string; y: string; storage: HardwareStorage; attestation?: string[] }>;
  publicKey(ref: string): Promise<{ x: string; y: string } | null>;
  sign(ref: string, dataB64: string): Promise<string>;
  delete(ref: string): Promise<void>;
  /** iOS App Attest (P4-2): yeni App Attest anahtarı + kanıt; clientDataHash base64 (SHA-256) */
  appAttest?(clientDataHashB64: string): Promise<{ key_id: string; attestation: string }>;
}

const jwkOf = (p: { x: string; y: string }): PublicJwk => ({
  kty: "EC",
  crv: "P-256",
  x: b64u(b64Decode(p.x)),
  y: b64u(b64Decode(p.y)),
});
const storageOf = (s: HardwareStorage): KeyStorage =>
  s === "secure_enclave" || s === "strongbox" || s === "tee" ? s : "software";

export class HardwareKeyProvider implements KeyProvider {
  private info: Promise<{ storage: HardwareStorage; platform: string } | null>;
  /** Android anahtar kanıtı zincirleri (ref → DER base64[]); cüzdan sağlayıcıya kanıt olarak gider */
  private evidence = new Map<string, string[]>();

  constructor(
    private native: NativeKeyBackend | null,
    private software: KeyProvider,
    private opts: { platform: string },
  ) {
    this.info = native ? native.info().catch(() => null) : Promise.resolve(null);
  }

  private async backend(): Promise<NativeKeyBackend | null> {
    const i = await this.info;
    return i && i.storage !== "none" ? this.native : null;
  }

  async generate(ref: string, challenge?: Uint8Array): Promise<PublicJwk> {
    const n = await this.backend();
    if (!n) return this.software.generate(ref);
    const r = await n.generate(ref, challenge ? b64(challenge) : null);
    if (r.attestation?.length) this.evidence.set(ref, r.attestation);
    return jwkOf(r);
  }

  async publicKey(ref: string): Promise<PublicJwk | null> {
    const n = await this.backend();
    const p = n ? await n.publicKey(ref) : null;
    return p ? jwkOf(p) : this.software.publicKey(ref);
  }

  async sign(ref: string, data: Uint8Array): Promise<Uint8Array> {
    const n = await this.backend();
    if (n && (await n.publicKey(ref))) return b64Decode(await n.sign(ref, b64(data)));
    return this.software.sign(ref, data);
  }

  async delete(ref: string): Promise<void> {
    const n = await this.backend();
    if (n) await n.delete(ref).catch(() => undefined);
    this.evidence.delete(ref);
    await this.software.delete(ref);
  }

  async attestation(): Promise<KeyAttestation> {
    const i = await this.info;
    if (!i || i.storage === "none") return this.software.attestation();
    const storage = storageOf(i.storage);
    return { storage, level: storage === "tee" ? "W2" : "W3", platform: this.opts.platform };
  }

  /** Android anahtar kanıtı (varsa): cüzdan sağlayıcı doğrular ve anahtar kanıtında (KA) seviyeyi belirler. */
  keyEvidence(ref: string): string[] | undefined {
    return this.evidence.get(ref);
  }
}
