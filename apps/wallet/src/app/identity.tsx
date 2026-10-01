/** ADR-0011: kimlik doğrulama — tarayıcıda Tamga kimlik servisi (KVKK rıza → uzaktan doğrulama) → kimlik belgesi. */
import React from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T, hapticError, hapticSuccess, useTheme } from "@/ui";
import { useWallet } from "@/state/wallet";
import { verifyIdentity } from "@/issuance";
import { friendlyError, type Trace } from "@/wallet";
import { applyRefresh } from "@/features/refresh";
import { useI18n, type Key } from "@/i18n";

const STEPS: ReadonlyArray<readonly ["globe-outline" | "camera-outline" | "id-card-outline", Key]> = [
  ["globe-outline", "id.step1"],
  ["camera-outline", "id.step2"],
  ["id-card-outline", "id.step3"],
];

export default function Identity() {
  const t = useTheme();
  const { state, setState, session } = useWallet();
  const { t: tx } = useI18n();
  const { from, refresh } = useLocalSearchParams<{ from?: string; refresh?: string }>();
  const fromSetup = from === "setup";
  return (
    <Screen>
      <T variant="display">{tx("id.title")}</T>
      <Card>
        {STEPS.map(([icon, text], i) => (
          <View key={i} style={{ flexDirection: "row", gap: 12, paddingVertical: 6 }}>
            <Ionicons name={icon} size={22} color={t.accent} style={{ marginTop: 1 }} />
            <T style={{ flex: 1 }}>{tx(text)}</T>
          </View>
        ))}
      </Card>
      <Card>
        <T variant="secondary" tone="muted">
          {tx("id.notPid")}
        </T>
      </Card>
      <Button
        title={tx("common.start")}
        icon="open-outline"
        onPress={async () => {
          if (!state) return;
          const trace: Trace = [];
          session.set({ trace: trace });
          session.set({ progressText: tx("id.waiting") });
          router.push("/receive/progress");
          try {
            const r = await verifyIdentity(state, trace);
            const ref = await applyRefresh(r.state, refresh, r.credentialId); // D7: yalnızca bu ekran yenileme için açıldıysa
            setState(ref.state);
            session.set({ receivedId: r.credentialId, changedFields: ref.changed });
            hapticSuccess();
            router.replace("/receive/done");
          } catch (e) {
            hapticError();
            Alert.alert(tx("id.failed"), friendlyError(e));
            router.back();
          }
        }}
      />
      {fromSetup && <Button variant="ghost" title={tx("common.notNow")} onPress={() => router.replace("/(tabs)")} />}
    </Screen>
  );
}
