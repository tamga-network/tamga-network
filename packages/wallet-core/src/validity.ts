/**
 * Saklanan belgenin cüzdanda gösterilecek geçerlilik durumu (kart rozeti ve sunum seçimi için; ağ çağrısı yok).
 *
 *  - `not_yet_valid`: belge alındı ama geçerliliği ileride başlıyor (`nbf`; ARF 4.6.6 "Issued" durumu). Saklanır, kartta başlangıç
 *    tarihiyle gösterilir, başlangıca kadar sunulmaz (doğrulayıcı da A7'de reddeder).
 *  - `issuer_suspended`: belgeyi veren kurum güven listesinde ŞU AN askıda ([[ADR-0088]] SI1). Belge silinmez, kartta uyarıyla
 *    gösterilir; doğrulayıcılar askı sürdükçe reddeder. Askı kalkınca belge kendiliğinden yeniden `valid` olur (iptal değildir).
 *    Yalnız `trust` verilirse değerlendirilir; güven listesi denetlenemezse (`UNKNOWN`) bu durum gösterilmez.
 *  - `revoked` / `suspended`: belgenin kendi iptal listesindeki son bilinen durum (`status.value`) ya da yerel iptal.
 *  - `expired`: `exp` geçti.
 * Öncelik: revoked → expired → issuer_suspended → suspended → not_yet_valid → valid.
 */
import type { TrustSource } from "@tamga-network/trust/core";
import { NOT_YET_VALID_SKEW_SEC } from "./sdjwt.js";
import type { StoredCredential } from "./store.js";

export type CredentialValidityState =
  "valid" | "not_yet_valid" | "expired" | "revoked" | "suspended" | "issuer_suspended";

export interface CredentialValidity {
  state: CredentialValidityState;
  /** geçerlilik başlangıcı (`nbf`, Unix sn) — `not_yet_valid` kartında gösterilir */
  validFrom?: number;
  /** geçerlilik bitişi (`exp`, Unix sn) */
  validUntil?: number;
  /** sunulabilir mi (yalnız `valid`) */
  presentable: boolean;
}

/** Belgenin geçerliliği ileride mi başlıyor (`nbf` > şimdi + saat payı). */
export function isNotYetValid(cred: Pick<StoredCredential, "nbf">, nowSec: number): boolean {
  return cred.nbf !== undefined && cred.nbf > nowSec + NOT_YET_VALID_SKEW_SEC;
}

export function credentialValidity(
  cred: StoredCredential,
  opt: { now?: number; trust?: Pick<TrustSource, "isIssuerSuspended"> } = {},
): CredentialValidity {
  const now = opt.now ?? Math.floor(Date.now() / 1000);
  const times = {
    ...(cred.nbf !== undefined ? { validFrom: cred.nbf } : {}),
    ...(cred.exp !== undefined ? { validUntil: cred.exp } : {}),
  };
  const state: CredentialValidityState =
    cred.revokedLocally || cred.status?.value === "revoked"
      ? "revoked"
      : cred.exp !== undefined && cred.exp <= now
        ? "expired"
        : opt.trust?.isIssuerSuspended?.(cred.issuerId) === "YES"
          ? "issuer_suspended"
          : cred.status?.value === "suspended"
            ? "suspended"
            : isNotYetValid(cred, now)
              ? "not_yet_valid"
              : "valid";
  return { state, ...times, presentable: state === "valid" };
}
