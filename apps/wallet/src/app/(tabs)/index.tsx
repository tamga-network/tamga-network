/** Ana sayfa: selamlama → kimlik kartı (sabit) → hızlı eylemler → sabitlenen belgeler → son işlemler. */
import React from "react";
import { Alert, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, CredentialCard, QuickAction, Screen, T, useTheme } from "@/ui";
import { activityOf, claimText, fmtDate, issuerNameOf, personNameOf, typeNameOf, useWallet } from "@/state/wallet";
import { identityOf, loadDirectory } from "@/issuance";
import { friendlyError } from "@/wallet";
import { LOW_COPIES, remainingCopies } from "@tamga-network/wallet-core";
import { canRefresh } from "@/features/refresh";
import { fmtDateOf, useI18n } from "@/i18n";

const KIND_ICON = {
  presented: "paper-plane",
  declined: "close-circle",
  failed: "alert-circle",
  deleted: "trash",
  deletion_request: "mail-unread",
  dpa_report: "flag",
  pseudonym_created: "person-circle",
  pseudonym_deleted: "person-remove",
  issued: "download",
  identity: "id-card",
} as const;

export default function Home() {
  const t = useTheme();
  const { t: tx } = useI18n();
  const { state, setBusy, session } = useWallet();
  const idc = state ? identityOf(state) : undefined;
  const creds = (state?.credentials ?? []).filter((c) => c.id !== idc?.id);
  const pinned = (state?.settings.pinned ?? [])
    .map((id) => creds.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => !!c);
  const recent = activityOf(state).slice(0, 3);
  const lowCopies = creds.filter((c) => canRefresh(c) && remainingCopies(c) <= LOW_COPIES);
  const openCredential = (id: string) => router.push({ pathname: "/credential/[id]", params: { id } });
  const openDirectory = async () => {
    if (!state) return;
    setBusy(tx("common.loadingDirectory"));
    try {
      session.set({ directory: await loadDirectory(state) });
      router.push("/institutions");
    } catch (e) {
      Alert.alert(tx("common.directoryFailed"), friendlyError(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <Screen
      title={idc ? tx("home.hello", { name: claimText(idc.claims.given_name) }) : "Tamga Wallet"}
      subtitle={idc ? tx("home.subtitleId") : tx("home.subtitleNew")}
    >
      {idc ? (
        <CredentialCard
          typeName={tx("home.identity")}
          vct={idc.vct}
          issuerName={issuerNameOf(idc)}
          personName={personNameOf(idc)}
          copiesLeft={idc.copies.filter((k) => !k.usedBy.length).length}
          copiesTotal={idc.copies.length}
          dateText={tx("common.validUntil", { date: fmtDate(idc.exp) })}
          live
          status={idc.status?.value}
          onPress={() => openCredential(idc.id)}
        />
      ) : (
        <Card tone="gold">
          <T variant="heading">{tx("home.verifyTitle")}</T>
          <T tone="muted">{tx("home.verifyText")}</T>
          <Button title={tx("common.verifyIdentity")} icon="id-card" onPress={() => router.push("/identity")} />
          {/* ARF Mig_06: yeni kurulumdan hemen sonra taşıma dosyası açılabilir */}
          {creds.length === 0 && (
            <Button
              variant="secondary"
              title={tx("home.fromOldPhone")}
              icon="phone-portrait-outline"
              onPress={() => router.push("/migration")}
            />
          )}
        </Card>
      )}
      <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
        <QuickAction icon="business" label={tx("home.qGet")} onPress={openDirectory} />
        <QuickAction
          icon="qr-code"
          label={tx("home.qShow")}
          onPress={() => router.navigate({ pathname: "/(tabs)/scan", params: { mode: "show" } })}
        />
        <QuickAction icon="albums" label={tx("home.qDocs")} onPress={() => router.navigate("/(tabs)/documents")} />
      </View>
      {lowCopies.length > 0 && (
        // D7 / §4.3: kopya azalınca bildirim — yenileme kullanıcıya bırakılır (WL7). Kopya yalnızca YENİ doğrulayıcılar için
        // gerekir; daha önce gösterilen yerler aynı kopyayı görmeye devam eder (WL5) — kullanıcıyı gereksiz endişelendirme.
        <Card tone="warn" onPress={() => openCredential(lowCopies[0].id)}>
          <T variant="heading">{tx("home.lowTitle")}</T>
          <T variant="secondary">
            {lowCopies.map((c) => tx("home.lowItem", { name: typeNameOf(c), n: remainingCopies(c) })).join(" · ")}.{" "}
            {tx("home.lowText")}
          </T>
        </Card>
      )}
      {pinned.length > 0 && (
        <>
          <T variant="heading">{tx("home.pinned")}</T>
          {pinned.map((c) => (
            <CredentialCard
              key={c.id}
              typeName={typeNameOf(c)}
              vct={c.vct}
              issuerName={issuerNameOf(c)}
              personName={personNameOf(c)}
              copiesLeft={c.copies.filter((k) => !k.usedBy.length).length}
              copiesTotal={c.copies.length}
              dateText={tx("common.issuedOn", { date: fmtDate(c.iat) })}
              pinned
              status={c.status?.value}
              onPress={() => openCredential(c.id)}
            />
          ))}
        </>
      )}
      {creds.length > 0 && pinned.length === 0 && (
        <Card onPress={() => router.navigate("/(tabs)/documents")}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="albums" size={22} color={t.accent} />
            <View style={{ flex: 1 }}>
              <T variant="heading">{tx("home.count", { n: creds.length })}</T>
              <T variant="secondary" tone="muted">
                {tx("home.pinHint")}
              </T>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.muted} />
          </View>
        </Card>
      )}
      {recent.length > 0 && (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <T variant="heading">{tx("home.recent")}</T>
            <Pressable accessibilityRole="button" onPress={() => router.navigate("/(tabs)/history")}>
              <T variant="secondary" tone="accent">
                {tx("home.all")}
              </T>
            </Pressable>
          </View>
          <Card>
            {recent.map((a, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 8,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: t.line,
                }}
              >
                <Ionicons name={KIND_ICON[a.kind]} size={20} color={a.kind === "declined" ? t.muted : t.accent} />
                <View style={{ flex: 1 }}>
                  <T numberOfLines={1}>{a.title}</T>
                  <T variant="secondary" tone="muted" numberOfLines={1}>
                    {a.detail}
                  </T>
                </View>
                <T variant="secondary" tone="muted">
                  {fmtDateOf(a.ts)}
                </T>
              </View>
            ))}
          </Card>
        </>
      )}
      {creds.length === 0 && idc && (
        <Card>
          <T variant="heading">{tx("home.firstTitle")}</T>
          <T tone="muted">{tx("home.firstText")}</T>
          <Button title={tx("common.getFromInstitution")} icon="business" onPress={openDirectory} />
        </Card>
      )}
    </Screen>
  );
}
