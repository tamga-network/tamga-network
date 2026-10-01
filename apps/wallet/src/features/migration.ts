/**
 * AB TS10 taşıma dosyası: işlem günlüğü + yeniden alınacak belgelerin listesi, parolayla şifreli (PBES2 + A128GCM).
 * Belge değerleri ve anahtarlar dosyaya girmez; yeni cüzdanda belgeler kurumlardan yeniden alınır (cihaza bağlı anahtar taşınmaz).
 * Doğrulayıcı/kurum bilgileri imzası doğrulanmış güven listesinden; liste alınamazsa bilinen kadarıyla yazılır.
 */
import {
  applyMigration,
  decryptTs10Async,
  encryptTs10Async,
  fetchHttp,
  fetchTrustSource,
  ts10LookupFromTrust,
  ts10MigrationData,
  ts10TransactionLog,
  type Ts10Lookup,
  type Ts10MigrationData,
  type WalletState,
} from "@tamga-network/wallet-core";
import { TRUST_PINS } from "@/trust-anchor";
import { randomBytes } from "@/platform";

const DEFAULT_TRUST_BASE = "https://trust.tamga.network";
/** ADR-0027 / D-WALLET-2: günlük yalnız kişinin başlattığı, parolalı dosyada cihazdan çıkar (SPEC-WALLET-0001 WL4). */
export const LOG_EXPORT_ALLOWED = true;

export async function exportMigration(state: WalletState, password: string): Promise<string> {
  const base = state.settings.trustBase ?? DEFAULT_TRUST_BASE;
  let lookup: Ts10Lookup = {};
  try {
    const { source } = await fetchTrustSource(base, fetchHttp, { pins: TRUST_PINS });
    lookup = ts10LookupFromTrust(source, `${base.replace(/\/$/, "")}/tl-tr.jws`);
  } catch {
    /* çevrim dışı: kayıt bilgileri olmadan */
  }
  // PBKDF2 async: arayüz "hazırlanıyor" gösterirken donmaz
  return encryptTs10Async(ts10MigrationData(state, lookup, { includeLog: LOG_EXPORT_ALLOWED }), password, {
    randomBytes,
  });
}

/** Dosyayı açar (parola denetimi); uygulama henüz bir şey yazmaz — kişiye günlüğü geri yüklemek isteyip istemediği sorulur. */
export async function openMigration(text: string, password: string): Promise<Ts10MigrationData> {
  return decryptTs10Async<Ts10MigrationData>(text, password);
}

export function importMigration(
  state: WalletState,
  data: Ts10MigrationData,
  restoreLog: boolean,
): { state: WalletState; toReissue: Ts10MigrationData["listOfCredentials"] } {
  return applyMigration(state, data, { restoreLog });
}

/** ARF DASH_07 / TS10 §4.1: yalnız işlem günlüğü, parolalı JWE. */
export async function exportTransactionLog(state: WalletState, password: string): Promise<string> {
  const base = state.settings.trustBase ?? DEFAULT_TRUST_BASE;
  let lookup: Ts10Lookup = {};
  try {
    const { source } = await fetchTrustSource(base, fetchHttp, { pins: TRUST_PINS });
    lookup = ts10LookupFromTrust(source, `${base.replace(/\/$/, "")}/tl-tr.jws`);
  } catch {
    /* çevrim dışı */
  }
  return encryptTs10Async(ts10TransactionLog(state, lookup), password, { randomBytes });
}
