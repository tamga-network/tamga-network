/**
 * Geçiş kartı kaydı (ADR-0012 B): bir belge için kayıtlı doğrulayıcının "proximity" politikasını bul → cüzdan sunum isteğini
 * kendisi başlatır (C yolu ile aynı mekanizma) → onay ekranı → kabulde pass_grant gelir, Göster ekranı hazır olur.
 * Kullanım: bilet alındıktan sonra "Kapı geçişine hazırla" (D10), öğrenci belgesi için "Kampüs geçişi".
 * Demo sapması S-19 (09-DEMO-KURGU §6): pilotta kayıt isteğini RP açar (kayıt masası / kurum sayfası QR); cüzdan politika seçmez.
 */
import { router } from "expo-router";
import type { WalletState } from "@tamga-network/wallet-core";
import { scanToReview } from "@/present";
import type { Session } from "@/state/wallet";
import type { Trace } from "@/wallet";
import { t } from "@/i18n";

export interface Scenario {
  policy_id: string;
  purpose: string;
  /** Çeviriler (BCP 47 → metin); cüzdan kullanıcının dilini seçer. */
  purpose_localized?: Record<string, string>;
  vct_values: string[];
  claims: string[];
  proximity: boolean;
}
type SessionApi = { set: (patch: Partial<Session>) => void };

const DEFAULT_TRUST_BASE = "https://trust.tamga.network";
/** Referans doğrulayıcının tabanı: güven listesi adresinden türetilir (demo: http://<ip>:4004/trust → http://<ip>:4004). */
export const verifierBaseOf = (trustBase?: string) =>
  (trustBase ?? DEFAULT_TRUST_BASE).replace(/\/trust\/?$/, "").replace(/^https:\/\/trust\./, "https://verify.");

export async function fetchScenarios(base: string): Promise<Scenario[]> {
  return (await (await fetch(`${base}/policies`)).json()) as Scenario[];
}

/** Bu belge tipi için geçiş kartı veren politika (varsa). */
export async function findGatePolicy(base: string, vct: string): Promise<Scenario | null> {
  const list = await fetchScenarios(base);
  return list.find((p) => p.proximity && p.vct_values.includes(vct)) ?? null;
}

/** Sunum isteğini cüzdan başlatır; onay ekranına gider. `check`: C yolu (sonuç QR'ı gösterilir). */
export async function startScenario(
  state: WalletState,
  base: string,
  p: Scenario,
  session: SessionApi,
  setBusy: (v: string | null) => void,
  opts: { check?: boolean } = {},
) {
  setBusy(t("pass.preparing"));
  const trace: Trace = [];
  try {
    const res = await fetch(`${base}/presentations`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ policy_id: p.policy_id }),
    });
    const created = (await res.json().catch(() => ({}))) as { qr_payload?: string };
    if (!res.ok || !created.qr_payload) throw new Error(t("pass.openFailed", { status: res.status }));
    trace.push({ t: Date.now(), step: "Presentation request started by the wallet (ADR-0012)", detail: p.policy_id });
    const model = await scanToReview(state, created.qr_payload, trace);
    session.set({ trace, review: { model, check: opts.check } });
    router.push("/review");
  } finally {
    setBusy(null);
  }
}
