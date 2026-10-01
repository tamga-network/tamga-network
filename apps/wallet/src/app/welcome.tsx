/** Karşılama: logo + tek düğme. PIN sorulmaz, hesap yok; "Başla" → tanıtım → PIN. Yalnızca cüzdan yokken görünür. */
import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, T, useTheme } from "@/ui";
import { useI18n } from "@/i18n";

export default function Welcome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { t: tx } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 32 }}>
        <View
          style={{
            width: 132,
            height: 132,
            borderRadius: 36,
            backgroundColor: t.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="wallet" size={64} color={t.onAccent} />
        </View>
        <T variant="display" center>
          Tamga Wallet
        </T>
        <T tone="muted" center>
          {tx("welcome.tagline")}
        </T>
      </View>
      <View style={{ paddingHorizontal: 24, gap: 10 }}>
        <Button title={tx("common.start")} icon="arrow-forward" onPress={() => router.push("/onboarding")} />
        <T variant="secondary" tone="muted" center>
          {tx("welcome.noAccount")}
        </T>
      </View>
    </View>
  );
}
