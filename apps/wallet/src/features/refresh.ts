/**
 * D7 — kullanıcı-başlatmalı kopya yenileme (SPEC-WALLET-0001 §4.3). WL7: otomatik yenileme YOK — cüzdan arka planda kuruma gitmez,
 * çünkü kurum belgenin ne zaman ve ne sıklıkla kullanıldığını öğrenirdi. Yenileme = aynı kurumdan aynı belgeyi yeniden istemek
 * (kurum: cüzdan-başlatmalı ihraç akışı; kimlik: kimlik doğrulaması yeniden). Yeni belge gelince eskisinin yerini alır.
 */
import { router } from "expo-router";
import {
  IDENTITY_VCT,
  canSupersede,
  changedClaimNames,
  supersedeCredential,
  type StoredCredential,
  type WalletState,
} from "@tamga-network/wallet-core";
import { keys, walletStore } from "@/platform";
import { contactKindOf, loadDirectory } from "@/issuance";
import type { Session } from "@/state/wallet";
import { t } from "@/i18n";

/** ARF ISSU_59: yeniden alınan belgede değeri değişen, eklenen ya da kalkan alanlar (kullanıcıya gösterilir). */
export function changedClaims(prev?: StoredCredential, next?: StoredCredential): string[] {
  if (!prev || !next) return [];
  return changedClaimNames(prev.claims, next.claims); // teknik alanlar (cnf, iat, exp …) sayılmaz
}

/** Biletler satıcıdan yeniden alınır (tek kullanım); diğer belgeler kurumdan yenilenir. */
export const canRefresh = (c: StoredCredential) => !c.vct.includes("Ticket");

/** Yenileme akışını başlatır: hedef kurumun "belge iste" ekranına ya da kimlik doğrulamasına gider. */
export async function startRefresh(
  state: WalletState,
  cred: StoredCredential,
  session: { set: (patch: Partial<Session>) => void },
) {
  // Yenileme niyeti ekrana giden bağlantının parametresinde taşınır (yerel belge id'si; kişisel veri değil). Kullanıcı akışı
  // yarıda bırakırsa niyet de kaybolur — ortak oturum değişkeninde kalıp ilgisiz bir sonraki belgeyi silmez (iç inceleme K2).
  const kind = contactKindOf(cred.vct);
  if (kind) {
    router.push({ pathname: "/contact", params: { kind, refresh: cred.id } });
    return;
  }
  if (cred.vct === IDENTITY_VCT) {
    router.push({ pathname: "/identity", params: { refresh: cred.id } });
    return;
  }
  const dir = await loadDirectory(state); // imzası doğrulanmış güven listesinden (S-13)
  const e = dir.find((d) => d.issuerId === cred.issuerId); // adres değil kurum kimliği (LAN'da adresler farklı)
  if (!e) throw new Error(t("refresh.noIssuer"));
  session.set({ directory: dir });
  router.push({ pathname: "/institutions/[slug]", params: { slug: e.slug, refresh: cred.id } });
}

/**
 * Yeni belge alındıktan sonra: yenilenen belge varsa eskisi kaldırılır, anahtarları silinir, ona bağlı geçiş kartları düşer.
 * `refreshOf` yoksa durum aynen döner.
 */
export async function applyRefresh(
  state: WalletState,
  refreshOf: string | undefined,
  newId: string,
): Promise<{ state: WalletState; removedPasses: number; changed: string[] }> {
  // Güvence: yalnızca aynı tür + aynı kurumdan gelen belge eskisinin yerini alır; aksi hâlde hiçbir şey silinmez.
  if (!refreshOf || !canSupersede(state, refreshOf, newId)) return { state, removedPasses: 0, changed: [] };
  const changed = changedClaims(
    state.credentials.find((c) => c.id === refreshOf),
    state.credentials.find((c) => c.id === newId),
  );
  const r = supersedeCredential(state, refreshOf, newId);
  for (const k of r.removedKeyRefs) await keys.delete(k).catch(() => {});
  await walletStore.save(r.state);
  return { state: r.state, removedPasses: r.removedPasses, changed };
}
