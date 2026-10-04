/** Donanım anahtarı sağlayıcısı: yerel arka uç varsa yeni anahtar orada; yoksa yazılım; eski yazılım anahtarları çalışır. */
import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import {
  HardwareKeyProvider,
  MemoryKeyStore,
  SoftwareKeyProvider,
  b64,
  b64Decode,
  isKeyInvalidated,
  newPassKeyRef,
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

describe("HardwareKeyProvider — cihaz doğrulaması (a3)", () => {
  /**
   * Pencereli sahte arka uç: `user_auth` anahtarlar yalnız pencere açıkken imzalar (kapalıyken ERR_USER_NOT_AUTHENTICATED);
   * `device_unlocked` anahtarlar her zaman. `weakOnce`: ilk doğrulama zayıf biyometri gibi geçer ama pencereyi açmaz (Android < 30).
   */
  function gated(answer = true, weakOnce = false) {
    const inner = fakeNative("strongbox");
    const calls: Array<{ reason: string; credentialOnly: boolean }> = [];
    const policies = new Map<string, string>();
    let windowOpen = false;
    let weak = weakOnce;
    const n: NativeKeyBackend = {
      ...inner,
      info: async () => ({ storage: "strongbox", platform: "android", userAuth: "biometric" }),
      generate: async (ref, challenge, policy) => {
        policies.set(ref, policy ?? "user_auth");
        return inner.generate(ref, challenge);
      },
      authenticate: async (reason, _cancel, credentialOnly) => {
        calls.push({ reason, credentialOnly: !!credentialOnly });
        if (weak && !credentialOnly) {
          weak = false;
          return true; // zayıf biyometri: istem geçti, anahtar açılmadı
        }
        windowOpen = answer;
        return answer;
      },
      sign: async (ref, d) => {
        if (policies.get(ref) === "user_auth" && !windowOpen)
          throw Object.assign(new Error("key: user not authenticated"), { code: "ERR_USER_NOT_AUTHENTICATED" });
        return inner.sign(ref, d);
      },
    };
    return { n, calls, policies, close: () => void (windowOpen = false) };
  }
  const data = new Uint8Array([1, 2, 3]);

  it("authenticate tek istem; sonrasında imza sormadan; pencere kapanınca sign bir kez yeniden sorar", async () => {
    const g = gated();
    const kp = new HardwareKeyProvider(g.n, new SoftwareKeyProvider(new MemoryKeyStore()), {
      platform: "android 15",
      authReason: () => "Belgeyi göstermek için onayla",
    });
    const jwk = await kp.generate("k1");
    expect(g.policies.get("k1")).toBe("user_auth"); // varsayılan: belge anahtarı
    expect(await kp.authenticate("Sunumu onayla")).toBe(true);
    expect(g.calls.map((c) => c.reason)).toEqual(["Sunumu onayla"]);
    expect(verifyEs256(await kp.sign("k1", data), data, jwk)).toBe(true);
    expect(verifyEs256(await kp.sign("k1", data), data, jwk)).toBe(true);
    expect(g.calls).toHaveLength(1); // pencere açık: ek istem yok
    g.close();
    expect(verifyEs256(await kp.sign("k1", data), data, jwk)).toBe(true);
    expect(g.calls.map((c) => c.reason)).toEqual(["Sunumu onayla", "Belgeyi göstermek için onayla"]);
    expect(await kp.userAuth()).toBe("biometric");
  });

  it("kişi vazgeçerse imza atılmaz; hata olduğu gibi geçer", async () => {
    const g = gated(false);
    const kp = new HardwareKeyProvider(g.n, new SoftwareKeyProvider(new MemoryKeyStore()), { platform: "android 15" });
    await kp.generate("k1");
    expect(await kp.authenticate("x")).toBe(false);
    await expect(kp.sign("k1", data)).rejects.toMatchObject({ code: "ERR_USER_NOT_AUTHENTICATED" });
    expect(g.calls.map((c) => c.reason)).toEqual(["x", ""]);
  });

  it("zayıf biyometri anahtarı açmadıysa bir kez de cihaz parolasıyla sorar (Android < 30)", async () => {
    const g = gated(true, true);
    const kp = new HardwareKeyProvider(g.n, new SoftwareKeyProvider(new MemoryKeyStore()), { platform: "android 9" });
    const jwk = await kp.generate("k1");
    expect(verifyEs256(await kp.sign("k1", data), data, jwk)).toBe(true);
    expect(g.calls.map((c) => c.credentialOnly)).toEqual([false, true]);
  });

  it("sunum onayı zayıf biyometriyle geçtiyse imza anında doğrudan cihaz parolası — toplam iki istem, üç değil", async () => {
    const g = gated(true, true);
    const kp = new HardwareKeyProvider(g.n, new SoftwareKeyProvider(new MemoryKeyStore()), { platform: "android 9" });
    const jwk = await kp.generate("k1");
    expect(await kp.authenticate("Sunumu onayla")).toBe(true); // zayıf biyometri: geçti, anahtar açılmadı
    expect(verifyEs256(await kp.sign("k1", data), data, jwk)).toBe(true);
    expect(g.calls.map((c) => c.credentialOnly)).toEqual([false, true]);
  });

  it("parola istemi de iptal edilirse yeniden sorulmaz", async () => {
    const g = gated(false, true);
    const kp = new HardwareKeyProvider(g.n, new SoftwareKeyProvider(new MemoryKeyStore()), { platform: "android 9" });
    await kp.generate("k1");
    expect(await kp.authenticate("x")).toBe(true);
    await expect(kp.sign("k1", data)).rejects.toMatchObject({ code: "ERR_USER_NOT_AUTHENTICATED" });
    expect(g.calls).toHaveLength(2);
  });

  it("iOS: imza anındaki sistem istemi iptal edildi (ERR_USER_CANCELED) → ikinci istem yok", async () => {
    const g = gated();
    const canceled: NativeKeyBackend = {
      ...g.n,
      sign: async () => {
        throw Object.assign(new Error("canceled"), { code: "ERR_USER_CANCELED" });
      },
    };
    const kp = new HardwareKeyProvider(canceled, new SoftwareKeyProvider(new MemoryKeyStore()), { platform: "ios 18" });
    await kp.generate("k1");
    await expect(kp.sign("k1", data)).rejects.toMatchObject({ code: "ERR_USER_CANCELED" });
    expect(g.calls).toHaveLength(0);
  });

  it("interactive:false / quiet(): istem çıkmaz, auth_required döner; pencere açıkken ve istemsiz anahtarlarda imzalar", async () => {
    const g = gated();
    const kp = new HardwareKeyProvider(g.n, new SoftwareKeyProvider(new MemoryKeyStore()), { platform: "android 15" });
    const jwk = await kp.generate("k1");
    const unit = await kp.generate("wallet.unit", undefined, { policy: "device_unlocked" });
    expect(g.policies.get("wallet.unit")).toBe("device_unlocked");
    const quiet = kp.quiet();
    await expect(quiet.sign("k1", data)).rejects.toMatchObject({ code: "auth_required" });
    expect(g.calls).toHaveLength(0); // hiç istem yok
    expect(verifyEs256(await quiet.sign("wallet.unit", data), data, unit)).toBe(true); // protokol anahtarı: sessiz
    expect(await kp.authenticate("x")).toBe(true);
    expect(verifyEs256(await quiet.sign("k1", data), data, jwk)).toBe(true); // pencere açık: sessiz imza
    expect(g.calls).toHaveLength(1);
  });

  it("kalıcı geçersiz anahtar (kilit / biyometri değişti) → key_invalidated; istem tekrarlanmaz", async () => {
    const g = gated();
    const broken: NativeKeyBackend = {
      ...g.n,
      sign: async () => {
        throw Object.assign(new Error("key permanently invalidated"), { code: "ERR_KEY_INVALIDATED" });
      },
    };
    const kp = new HardwareKeyProvider(broken, new SoftwareKeyProvider(new MemoryKeyStore()), {
      platform: "android 15",
    });
    await kp.generate("k1");
    const err = await kp.sign("k1", data).catch((e: unknown) => e);
    expect(isKeyInvalidated(err)).toBe(true);
    expect(g.calls).toHaveLength(0);
    await expect(kp.quiet().sign("k1", data)).rejects.toMatchObject({ code: "key_invalidated" });
  });

  it("geçiş kartı anahtarı device_unlocked: pencere kapalıyken kart jetonu istemsiz imzalanır (WL13)", async () => {
    const g = gated();
    const kp = new HardwareKeyProvider(g.n, new SoftwareKeyProvider(new MemoryKeyStore()), { platform: "android 15" });
    const ref = newPassKeyRef(() => new Uint8Array(9).fill(7));
    const jwk = await kp.generate(ref, undefined, { policy: "device_unlocked" });
    expect(g.policies.get(ref)).toBe("device_unlocked");
    expect(verifyEs256(await kp.quiet().sign(ref, data), data, jwk)).toBe(true);
    expect(g.calls).toHaveLength(0);
  });

  it("yerel modül yoksa authenticate null → uygulama kendi PIN/biyometri onayına döner", async () => {
    const kp = new HardwareKeyProvider(null, new SoftwareKeyProvider(new MemoryKeyStore()), { platform: "expo go" });
    expect(await kp.authenticate("x")).toBeNull();
    expect(await kp.userAuth()).toBeUndefined();
    const plain = new HardwareKeyProvider(fakeNative(), new SoftwareKeyProvider(new MemoryKeyStore()), {
      platform: "ios",
    });
    expect(await plain.authenticate("x")).toBeNull(); // eski arka uç: doğrulama işlevi yok
  });
});
