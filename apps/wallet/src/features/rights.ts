/**
 * Kullanıcı hakları (ARF konu 48 / 50; AB TS7 / TS8): doğrulayıcıdan veri silme talebi ve şüpheli isteği veri koruma kurumuna
 * bildirme. AB modeli yeni bir teknik arayüz kurmaz: cüzdan kayıttaki kanalı (web / e-posta / telefon) hazır metinle açar ve bunu
 * günlüğe yazar. Kanallar imzalı güven listesindeki kayıttan (ADR-0024); kayıtta kurum yoksa ulusal kurum (KVKK). Metinde alan
 * ADLARI olur, değerler olmaz.
 */
import { Linking } from "react-native";
import {
  fetchHttp,
  fetchRpRecord,
  type PresentationLogEntry,
  type RpRecord,
  type SupervisoryAuthorityInfo,
  type WalletState,
} from "@tamga-network/wallet-core";
import { TRUST_PINS } from "@/trust-anchor";
import { walletStore } from "@/platform";
import { t } from "@/i18n";

const DEFAULT_TRUST_BASE = "https://trust.tamga.network";

/** Türkiye'de kişisel verileri koruma kurumu — kayıtta kurum yoksa (kayıtsız doğrulayıcı) kullanılır. */
export const NATIONAL_DPA: SupervisoryAuthorityInfo = {
  name: "Kişisel Verileri Koruma Kurumu (KVKK)",
  country: "TR",
  info_uri: "https://www.kvkk.gov.tr",
};

export interface Channel {
  kind: "web" | "email" | "phone";
  value: string;
}

export function rpChannels(contact: RpRecord["contact"] | undefined): Channel[] {
  const out: Channel[] = [];
  if (contact?.support_uri?.startsWith("https://")) out.push({ kind: "web", value: contact.support_uri });
  if (contact?.email) out.push({ kind: "email", value: contact.email });
  if (contact?.phone) out.push({ kind: "phone", value: contact.phone });
  return out;
}
export function dpaChannels(a: SupervisoryAuthorityInfo | undefined): Channel[] {
  const d = a ?? NATIONAL_DPA;
  const out: Channel[] = [];
  const web = d.form_uri ?? d.info_uri;
  if (web?.startsWith("https://")) out.push({ kind: "web", value: web });
  if (d.email) out.push({ kind: "email", value: d.email });
  if (d.phone) out.push({ kind: "phone", value: d.phone });
  return out;
}

/** Günlükteki bir paylaşımın doğrulayıcı kaydı (imzalı güven listesinden). */
export async function rpRecordFor(state: WalletState, clientId: string): Promise<RpRecord | null> {
  return fetchRpRecord(state.settings.trustBase ?? DEFAULT_TRUST_BASE, clientId, fetchHttp, TRUST_PINS);
}

/** E-posta ekindeki makine okunur özet (RPT_DPA_04): kim, ne zaman, hangi alanlar — değer yok. */
const summaryOf = (e: Pick<PresentationLogEntry, "ts" | "clientId" | "vct" | "disclosed" | "outcome">) =>
  JSON.stringify(
    {
      verifier: e.clientId,
      time: new Date(e.ts).toISOString(),
      credential_type: e.vct,
      fields: e.disclosed,
      outcome: e.outcome,
    },
    null,
    1,
  );

export async function openChannel(c: Channel, subject: string, body: string) {
  const url =
    c.kind === "web"
      ? c.value
      : c.kind === "email"
        ? `mailto:${c.value}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        : `tel:${c.value.replace(/\s+/g, "")}`;
  await Linking.openURL(url);
}

/** TS7: silme talebi — kanalı açar ve günlüğe yazar (DATA_DLT_05/06). */
export async function requestDeletion(
  state: WalletState,
  entry: PresentationLogEntry,
  rpName: string,
  c: Channel,
): Promise<WalletState> {
  await openChannel(
    c,
    t("rights.delSubject", { name: rpName }),
    t("rights.delBody", { name: rpName, summary: summaryOf(entry) }),
  );
  return logEvent(state, { kind: "deletion_request", entry, channel: c.kind });
}

/** TS8: şüpheli isteği veri koruma kurumuna bildirir (RPT_DPA_02a/05). */
export async function reportToDpa(
  state: WalletState,
  entry: Pick<PresentationLogEntry, "ts" | "clientId" | "vct" | "disclosed" | "outcome">,
  rpName: string,
  authority: SupervisoryAuthorityInfo | undefined,
  c: Channel,
): Promise<WalletState> {
  await openChannel(
    c,
    t("rights.dpaSubject", { name: rpName }),
    t("rights.dpaBody", { name: rpName, summary: summaryOf(entry) }),
  );
  return logEvent(state, { kind: "dpa_report", entry, channel: c.kind, authority: (authority ?? NATIONAL_DPA).name });
}

async function logEvent(
  state: WalletState,
  p: {
    kind: "deletion_request" | "dpa_report";
    entry: Pick<PresentationLogEntry, "clientId" | "vct">;
    channel: Channel["kind"];
    authority?: string;
  },
): Promise<WalletState> {
  const next: WalletState = {
    ...state,
    events: [
      ...(state.events ?? []),
      {
        ts: Date.now(),
        kind: p.kind,
        vct: p.entry.vct,
        typeName: "",
        clientId: p.entry.clientId,
        channel: p.channel,
        ...(p.authority ? { authority: p.authority } : {}),
      },
    ],
  };
  await walletStore.save(next);
  return next;
}
