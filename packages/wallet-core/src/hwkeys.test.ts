/** Donanım anahtarı sağlayıcısı: yerel arka uç varsa yeni anahtar orada; yoksa yazılım; eski yazılım anahtarları çalışır. */
import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import {
  HardwareKeyProvider,
  MemoryKeyStore,
  SoftwareKeyProvider,
  b64,
  b64Decode,
  verifyEs256,
  type NativeKeyBackend,
} from "./index.js";

/** Sahte donanım: anahtarlar bu nesnenin içinde kalır (Secure Enclave taklidi) */
function fakeNative(storage: "secure_enclave" | "strongbox" | "tee" | "none" = "secure_enclave"): NativeKeyBackend & {
  keys: Map<string, Uint8Array>;
} {
  const keys = new Map<string, Uint8Array>();
  const pub = (sk: Uint8Array) => {
    const raw = p256.getPublicKey(sk, false);
    return { x: b64(raw.subarray(1, 33)), y: b64(raw.subarray(33, 65)) };
  };
  return {
    keys,
    info: async () => ({ storage, platform: "test" }),
    generate: async (ref, challenge) => {
      if (keys.has(ref)) throw new Error("exists");
      const sk = p256.utils.randomSecretKey();
      keys.set(ref, sk);
      return { ...pub(sk), storage, ...(challenge ? { attestation: ["Y2VydA=="] } : {}) };
    },
    publicKey: async (ref) => (keys.has(ref) ? pub(keys.get(ref)!) : null),
    sign: async (ref, dataB64) =>
      b64(p256.sign(b64Decode(dataB64), keys.get(ref)!, { prehash: true, format: "compact" })),
    delete: async (ref) => void keys.delete(ref),
  };
}

describe("HardwareKeyProvider", () => {
  it("yeni anahtar donanımda; imza doğrulanır; seviye secure_enclave/W3", async () => {
    const native = fakeNative();
    const sw = new SoftwareKeyProvider(new MemoryKeyStore());
    const kp = new HardwareKeyProvider(native, sw, { platform: "ios 18" });
    const jwk = await kp.generate("k1");
    expect(native.keys.has("k1")).toBe(true);
    expect(await sw.publicKey("k1")).toBeNull();
    const data = new TextEncoder().encode("merhaba");
    expect(verifyEs256(await kp.sign("k1", data), data, jwk)).toBe(true);
    expect(await kp.attestation()).toMatchObject({ storage: "secure_enclave", level: "W3" });
  });

  it("donanımda olmayan eski yazılım anahtarı çalışmaya devam eder", async () => {
    const sw = new SoftwareKeyProvider(new MemoryKeyStore());
    const old = await sw.generate("eski");
    const kp = new HardwareKeyProvider(fakeNative(), sw, { platform: "x" });
    expect(await kp.publicKey("eski")).toEqual(old);
    const data = new Uint8Array([1, 2, 3]);
    expect(verifyEs256(await kp.sign("eski", data), data, old)).toBe(true);
  });

  it("yerel modül yoksa (Expo Go) ya da donanım yoksa yazılım", async () => {
    const sw = new SoftwareKeyProvider(new MemoryKeyStore());
    const a = new HardwareKeyProvider(null, sw, { platform: "x" });
    await a.generate("s1");
    expect(await sw.publicKey("s1")).not.toBeNull();
    expect((await a.attestation()).storage).toBe("software");
    const none = fakeNative("none");
    const b = new HardwareKeyProvider(none, sw, { platform: "x" });
    await b.generate("s2");
    expect(none.keys.size).toBe(0);
  });

  it("Android: challenge ile anahtar kanıtı saklanır; TEE seviyesi W2; silme her iki depodan", async () => {
    const native = fakeNative("tee");
    const sw = new SoftwareKeyProvider(new MemoryKeyStore());
    const kp = new HardwareKeyProvider(native, sw, { platform: "android 15" });
    await kp.generate("k2", new Uint8Array([9, 9]));
    expect(kp.keyEvidence("k2")).toEqual(["Y2VydA=="]);
    expect(await kp.attestation()).toMatchObject({ storage: "tee", level: "W2" });
    await kp.delete("k2");
    expect(native.keys.has("k2")).toBe(false);
    expect(kp.keyEvidence("k2")).toBeUndefined();
  });
});
