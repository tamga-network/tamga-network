/** Sunum gönderildi: doğrulayıcı sonucu bağlantısı + arka plan izi (katlanır) → Bitti. */
import React from "react";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { Button, Card, Collapsible, LiveBadge, Pill, QrArea, StepList, Screen, T, useTheme } from "@/ui";
import { useWallet } from "@/state/wallet";
import { useI18n } from "@/i18n";

export default function Sent() {
  const t = useTheme();
  const { session } = useWallet();
  const { t: tx } = useI18n();
  const s = session.get().sent;
  const finish = () => {
    session.set({ sent: undefined });
    session.set({ review: undefined });
    router.dismissAll();
  };
  if (!s)
    return (
      <Screen>
        <Button title={tx("common.done")} onPress={finish} />
      </Screen>
    );
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 8, paddingVertical: 12 }}>
        <Ionicons name="paper-plane" size={64} color={t.success} />
        <T variant="display" center>
          {tx("sent.title")}
        </T>
      </View>
      {s.check && s.showUrl && (
        <QrArea ready note={tx("sent.checkNote")}>
          <QRCode value={s.showUrl} size={200} backgroundColor="#FFFFFF" color="#17110F" ecl="M" />
        </QrArea>
      )}
      {s.check && (
        <View style={{ flexDirection: "row", justifyContent: "center" }}>
          <LiveBadge />
        </View>
      )}
      <Card tone="success">
        <T variant="title">{s.model.rp.legalName ?? s.model.request.rpKey}</T>
        <Pill text={tx("sent.sent")} tone="success" icon="checkmark" />
        {s.passGranted && <Pill text={tx("sent.passSaved")} tone="gold" icon="qr-code" />}
        <T variant="secondary" tone="muted">
          {tx("sent.note")}
        </T>
      </Card>
      {s.redirectUri && (
        <Button
          variant="secondary"
          icon="open-outline"
          title={tx("sent.openResult")}
          onPress={() => void Linking.openURL(s.redirectUri!)}
        />
      )}
      <Button title={tx("common.done")} onPress={finish} />
      <Collapsible title={tx("common.backgroundTrace")}>
        <StepList steps={session.get().trace ?? []} />
      </Collapsible>
    </Screen>
  );
}
