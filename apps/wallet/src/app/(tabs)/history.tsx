/**
 * Geçmiş: sunumlar (kime, hangi alanlar, sonuç; başarısızlar dahil) + ihraçlar + silmeler. Yalnızca bu telefonda (WL4).
 * ARF DASH_06a: kayda uzun basınca onayla silinir; DASH_07: başlıktan dışa aktarım (paylaş).
 */
import React from "react";
import { Alert, View } from "react-native";
import { deleteLogEntries } from "@tamga-network/wallet-core";
import { LOG_EXPORT_ALLOWED } from "@/features/migration";
import { friendlyError, save } from "@/wallet";
import { dpaChannels, reportToDpa, requestDeletion, rpChannels, rpRecordFor, type Channel } from "@/features/rights";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, EmptyState, Pill, Screen, T, useTheme } from "@/ui";
import { activityOf, useWallet } from "@/state/wallet";
import { fmtDateTimeOf, useI18n } from "@/i18n";

const META = {
  presented: { icon: "paper-plane", label: "hist.presented", tone: "success" },
  declined: { icon: "close-circle", label: "hist.declined", tone: "neutral" },
  failed: { icon: "alert-circle", label: "hist.failed", tone: "warn" },
  deleted: { icon: "trash", label: "hist.deleted", tone: "neutral" },
  deletion_request: { icon: "mail-unread", label: "hist.deletionRequest", tone: "info" },
  dpa_report: { icon: "flag", label: "hist.dpaReport", tone: "warn" },
  pseudonym_created: { icon: "person-circle", label: "hist.pseudonymCreated", tone: "info" },
  pseudonym_deleted: { icon: "person-remove", label: "hist.pseudonymDeleted", tone: "neutral" },
  issued: { icon: "download", label: "hist.issued", tone: "info" },
  identity: { icon: "id-card", label: "hist.identity", tone: "gold" },
} as const;

export default function History() {
  const t = useTheme();
  const { state, setState } = useWallet();
  const { t: tx } = useI18n();
  const items = activityOf(state);
  /** TS7 / TS8: paylaşım kaydından silme talebi ya da şikâyet — kanal kayıttan (web / e-posta / telefon) */
  const pick = (title: string, chans: Channel[], go: (c: Channel) => Promise<void>) => {
    if (!chans.length) return Alert.alert(title, tx("rights.noChannel"));
    Alert.alert(title, tx("rights.chooseChannel"), [
      ...chans.slice(0, 2).map((c) => ({ text: `${tx(`rights.ch.${c.kind}`)}`, onPress: () => void go(c) })),
      { text: tx("common.cancel"), style: "cancel" as const },
    ]);
  };
  const rights = async (title: string, entry: NonNullable<ReturnType<typeof activityOf>[number]["entry"]>) => {
    if (!state) return;
    let rec = null;
    try {
      rec = await rpRecordFor(state, entry.clientId);
    } catch (e) {
      return Alert.alert(tx("rights.failed"), friendlyError(e));
    }
    const name = rec?.trade_name ?? rec?.legal_name ?? title;
    Alert.alert(name, tx("rights.menuText"), [
      {
        text: tx("rights.delete"),
        onPress: () =>
          pick(tx("rights.delete"), rpChannels(rec?.contact), async (c) =>
            setState(await requestDeletion(state, entry, name, c)),
          ),
      },
      {
        text: tx("rights.report"),
        onPress: () =>
          pick(tx("rights.report"), dpaChannels(rec?.supervisory_authority), async (c) =>
            setState(await reportToDpa(state, entry, name, rec?.supervisory_authority, c)),
          ),
      },
      { text: tx("common.cancel"), style: "cancel" },
    ]);
  };
  return (
    <Screen
      title={tx("nav.history")}
      subtitle={tx("hist.subtitle")}
      action={
        state && items.length && LOG_EXPORT_ALLOWED
          ? {
              icon: "share-outline",
              label: tx("hist.export"),
              // ADR-0027: parolalı TS10 dosyası (taşıma ekranındaki "Geçmişi dışa aktar")
              onPress: () => router.push("/migration"),
            }
          : undefined
      }
    >
      {items.length ? (
        <Button
          variant="secondary"
          icon="business-outline"
          title={tx("sw.open")}
          onPress={() => router.push("/shared")}
        />
      ) : null}
      {items.length ? (
        items.map((a, i) => {
          const m = META[a.kind];
          const id = a.credentialId;
          return (
            <Card
              key={i}
              onPress={
                id
                  ? () => router.push({ pathname: "/credential/[id]", params: { id } })
                  : state && a.entry
                    ? () => void rights(a.title, a.entry!)
                    : undefined
              }
              onLongPress={
                state && a.logTs?.length
                  ? () =>
                      Alert.alert(tx("hist.deleteTitle"), tx("hist.deleteText"), [
                        { text: tx("common.cancel"), style: "cancel" },
                        {
                          text: tx("hist.deleteConfirm"),
                          style: "destructive",
                          onPress: async () => setState(await save(deleteLogEntries(state, a.logTs!))),
                        },
                      ])
                  : undefined
              }
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons
                  name={m.icon}
                  size={22}
                  color={
                    a.kind === "declined" || a.kind === "deleted" ? t.muted : a.kind === "failed" ? t.warn : t.accent
                  }
                />
                <View style={{ flex: 1 }}>
                  <T variant="heading" numberOfLines={1}>
                    {a.title}
                  </T>
                  <T variant="secondary" tone="muted">
                    {fmtDateTimeOf(a.ts)}
                  </T>
                </View>
                <Pill text={tx(m.label)} tone={m.tone} />
              </View>
              <T variant="secondary" tone="muted">
                {a.detail}
              </T>
            </Card>
          );
        })
      ) : (
        <EmptyState icon="time-outline" title={tx("hist.emptyTitle")} text={tx("hist.emptyText")} />
      )}
    </Screen>
  );
}
