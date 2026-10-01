/** ADR-0021: doğrulanmış e-posta / telefon — tarayıcıda Tamga kimlik servisi (adres → tek kullanımlık kod) → iletişim belgesi. */
import React from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T, hapticError, hapticSuccess, useTheme } from "@/ui";
import { useWallet } from "@/state/wallet";
import { verifyContact, type ContactKind } from "@/issuance";
import { friendlyError, type Trace } from "@/wallet";
import { applyRefresh } from "@/features/refresh";
import { useI18n, type Key } from "@/i18n";

type Icon = "globe-outline" | "keypad-outline" | "wallet-outline";
const STEPS: Record<ContactKind, ReadonlyArray<readonly [Icon, Key]>> = {
  email: [
    ["globe-outline", "contact.step1Email"],
    ["keypad-outline", "contact.step2Email"],
    ["wallet-outline", "contact.step3"],
  ],
  phone: [
    ["globe-outline", "contact.step1Phone"],
    ["keypad-outline", "contact.step2Phone"],
    ["wallet-outline", "contact.step3"],
  ],
};

export default function Contact() {
  const t = useTheme();
  const { state, setState, session } = useWallet();
  const { t: tx } = useI18n();
  const params = useLocalSearchParams<{ kind?: string; refresh?: string }>();
  const kind: ContactKind = params.kind === "phone" ? "phone" : "email";
  return (
    <Screen>
      <T variant="display">{tx(kind === "email" ? "contact.titleEmail" : "contact.titlePhone")}</T>
      <Card>
        {STEPS[kind].map(([icon, text], i) => (
          <View key={i} style={{ flexDirection: "row", gap: 12, paddingVertical: 6 }}>
            <Ionicons name={icon} size={22} color={t.accent} style={{ marginTop: 1 }} />
            <T style={{ flex: 1 }}>{tx(text)}</T>
          </View>
        ))}
      </Card>
      <Card>
        <T variant="secondary" tone="muted">
          {tx("contact.multi")}
        </T>
      </Card>
      <Button
        title={tx("common.start")}
        icon="open-outline"
        onPress={async () => {
          if (!state) return;
          const trace: Trace = [];
          session.set({ trace });
          session.set({ progressText: tx("contact.waiting") });
          router.push("/receive/progress");
          try {
            const r = await verifyContact(state, kind, trace);
            const ref = await applyRefresh(r.state, params.refresh, r.credentialId); // D7: yalnız yenileme için açıldıysa
            setState(ref.state);
            session.set({ receivedId: r.credentialId, changedFields: ref.changed });
            hapticSuccess();
            router.replace("/receive/done");
          } catch (e) {
            hapticError();
            Alert.alert(tx("contact.failed"), friendlyError(e));
            router.back();
          }
        }}
      />
    </Screen>
  );
}
