/**
 * Cihaz katmanı — wallet-core'un soyut arayüzlerinin Expo karşılıkları.
 *  KeyStore  → expo-secure-store (Keychain/Keystore; anahtar sarmalama — sapma S-9: özel anahtar JS'e açık)
 *  WalletStore → expo-file-system (Paths.document/wallet.json), AES-256-GCM ile şifreli; anahtar SecureStore'da, yalnızca bu
 *                cihazda (telefon yedeğine giden dosya okunamaz — S-11 kapandı)
 *  rastgelelik → expo-crypto getRandomValues (global polyfill yok)
 */
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import * as LocalAuthentication from "expo-local-authentication";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import {
  HardwareKeyProvider,
  SoftwareKeyProvider,
  TextWalletStore,
  b64u,
  b64uDecode,
  openText,
  sealText,
  utf8,
  type KeyStore,
  type SeedVault,
} from "@tamga-network/wallet-core";
import { sha256 } from "@noble/hashes/sha2.js";
import { t as tx } from "@/i18n";
import { TamgaKeys } from "../modules/tamga-keys";

const secureKey = (ref: string) => ref.replace(/[^A-Za-z0-9._-]/g, "_");

export class SecureKeyStore implements KeyStore {
  async get(ref: string) {
    return SecureStore.getItemAsync(secureKey(ref));
  }
  async set(ref: string, v: string) {
    await SecureStore.setItemAsync(secureKey(ref), v, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  async delete(ref: string) {
    await SecureStore.deleteItemAsync(secureKey(ref));
  }
}

export const randomBytes = (n: number): Uint8Array => Crypto.getRandomValues(new Uint8Array(n));

/**
 * ADR-0031: site başına takma ad tohumu — Keychain / Keystore'da, yalnız bu cihazda (yedeğe ve taşıma dosyasına girmez, LX2).
 * Mağaza derlemesinde donanım korumalı saklama (Z1). Kullanım anında PIN/biyometri sonrası okunur.
 */
const SEED_KEY = "tamga.pseudonym.seed";
export const seedVault: SeedVault = {
  get: () => SecureStore.getItemAsync(SEED_KEY),
  set: (seed) =>
    SecureStore.setItemAsync(SEED_KEY, seed, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  clear: () => SecureStore.deleteItemAsync(SEED_KEY),
};

/**
 * Anahtar sağlayıcı: mağaza/geliştirme derlemesinde donanım (Secure Enclave / StrongBox / TEE — yerel TamgaKeys modülü),
 * Expo Go'da yazılım (sapma S-9). Donanımda olmayan eski anahtarlar yazılımdan kullanılır.
 */
export const keys = new HardwareKeyProvider(
  TamgaKeys,
  new SoftwareKeyProvider(new SecureKeyStore(), {
    randomBytes,
    platform: `${Platform.OS} ${Platform.Version} (Expo Go)`,
  }),
  { platform: `${Platform.OS} ${Platform.Version}` },
);

const walletFile = () => new File(Paths.document, "wallet.json");
const STORE_KEY = "tamga.store.key";
async function storeKey(): Promise<Uint8Array> {
  const have = await SecureStore.getItemAsync(STORE_KEY);
  if (have) return b64uDecode(have);
  const k = randomBytes(32);
  await SecureStore.setItemAsync(STORE_KEY, b64u(k), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return k;
}
export const walletStore = new TextWalletStore(
  async () => {
    const f = walletFile();
    if (!f.exists) return null;
    const t = await f.text();
    // eski sürümün şifresiz dosyası bir kez okunur; ilk kayıtta şifreli yazılır
    return t.startsWith("{") ? t : openText(await storeKey(), t);
  },
  async (s) => {
    const f = walletFile();
    if (!f.exists) f.create();
    f.write(sealText(await storeKey(), s, randomBytes));
  },
);

// PIN — 6 hane; salt + SHA-256 özeti SecureStore'da (WL11: anahtarlara erişim kilidi; sunucuya gitmez)
const PIN_KEY = "tamga.pin";
export async function hasPin() {
  return !!(await SecureStore.getItemAsync(PIN_KEY));
}
export async function setPin(pin: string) {
  const salt = randomBytes(16);
  const h = b64u(sha256(new Uint8Array([...salt, ...utf8(pin)])));
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify({ salt: b64u(salt), h }), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
/**
 * PIN denemesi: art arda 5 yanlıştan sonra artan bekleme (30 sn, 1 dk, 2 dk … en çok 1 sa). Sayaç SecureStore'da — uygulamayı
 * kapatıp açmak sıfırlamaz. 6 haneli PIN'in (10⁶ olasılık) elle ya da otomatik denenerek bulunmasını pratik olmaktan çıkarır.
 */
const PIN_FAIL_KEY = "tamga.pin.fail";
const FREE_TRIES = 5;
export type PinCheck = { ok: true } | { ok: false; message: string };
export async function verifyPin(pin: string, now = Date.now()): Promise<PinCheck> {
  const raw = await SecureStore.getItemAsync(PIN_KEY);
  if (!raw) return { ok: false, message: tx("pin.notSet") };
  const fail = JSON.parse((await SecureStore.getItemAsync(PIN_FAIL_KEY)) ?? '{"n":0,"until":0}') as {
    n: number;
    until: number;
  };
  if (fail.until > now)
    return {
      ok: false,
      message: tx("pin.locked", { s: Math.ceil((fail.until - now) / 1000) }),
    };
  const { salt, h } = JSON.parse(raw) as { salt: string; h: string };
  if (b64u(sha256(new Uint8Array([...b64uDecode(salt), ...utf8(pin)]))) === h) {
    if (fail.n) await SecureStore.deleteItemAsync(PIN_FAIL_KEY).catch(() => {});
    return { ok: true };
  }
  const n = fail.n + 1;
  const wait = n < FREE_TRIES ? 0 : Math.min(3600, 30 * 2 ** (n - FREE_TRIES)) * 1000;
  await SecureStore.setItemAsync(PIN_FAIL_KEY, JSON.stringify({ n, until: now + wait }), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return { ok: false, message: wait ? tx("pin.wrongWait", { s: wait / 1000 }) : tx("pin.wrong") };
}
/**
 * ARF WIAM_15a: cihazda işletim sistemi ekran kilidi (parola/PIN/desen) açık olmalı — kilitsiz telefonda belge sunulmaz.
 * Denetlenemiyorsa (web, eski sürüm) engellemez.
 */
export async function deviceLockEnabled(): Promise<boolean> {
  try {
    return (await LocalAuthentication.getEnrolledLevelAsync()) !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return true;
  }
}
export async function biometricsAvailable() {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}
export async function biometricUnlock(reason: string) {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: tx("pin.useInstead"),
    disableDeviceFallback: true,
  });
  return r.success;
}
export const newInstanceId = () => Crypto.randomUUID();
export async function resetPin() {
  await SecureStore.deleteItemAsync(PIN_KEY).catch(() => {});
  await SecureStore.deleteItemAsync(PIN_FAIL_KEY).catch(() => {});
}
export async function resetWalletFile() {
  const f = walletFile();
  if (f.exists) f.delete();
  await SecureStore.deleteItemAsync(STORE_KEY).catch(() => {});
}
