/** Biyometri teklifi (PIN'den hemen sonra, isteğe bağlı; sektör pratiği). Sonra kimlik adımı. */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Screen, T, hapticSuccess, useTheme } from "@/ui";
import { useWallet } from "@/state/wallet";
import { biometricsAvailable, biometricUnlock } from "@/platform";
import { save } from "@/wallet";
import { useI18n } from "@/i18n";

const next = () => router.replace({ pathname: "/identity", params: { from: "setup" } });

export default function Biometrics() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { state, setState } = useWallet();
  const [available, setAvailable] = useState<boolean | null>(null);
  const { t: tx } = useI18n();
  useEffect(() => {
    biometricsAvailable().then((ok) => {
      setAvailable(ok);
      if (!ok) next(); // cihazda biyometri yoksa adım atlanır
    });
  }, []);
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 8, paddingTop: insets.top + 32 }}>
        <Ionicons name="finger-print" size={56} color={t.accent} />
        <T variant="display" center>
          {tx("bio.title")}
        </T>
        <T tone="muted" center>
          {tx("bio.text")}
        </T>
      </View>
      <Card>
        <T variant="secondary" tone="muted">
          {tx("bio.note")}
        </T>
      </Card>
      <Button
        title={tx("bio.enable")}
        icon="finger-print"
        disabled={available !== true}
        onPress={async () => {
          if (!state) return next();
          if (await biometricUnlock(tx("bio.enableReason"))) {
            setState(await save({ ...state, settings: { ...state.settings, biometrics: true } }));
            hapticSuccess();
          }
          next();
        }}
      />
      <Button variant="ghost" title={tx("common.notNow")} onPress={next} />
    </Screen>
  );
}
