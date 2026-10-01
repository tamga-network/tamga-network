/**
 * PIN onayı (modal) — WL11: her sunum kullanıcı onayı ister. iOS ve Android'de aynı ekran (sistem uyarısı yok).
 * Biyometri açıksa önce o denenir (state/wallet.tsx confirmUser); buraya PIN yedeği ya da biyometri kapalıyken düşülür.
 */
import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, PinPad, Screen, T, useTheme } from "@/ui";
import { useWallet } from "@/state/wallet";
import { verifyPin } from "@/platform";
import { useI18n } from "@/i18n";

export default function Confirm() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useWallet();
  const [tries, setTries] = useState(0);
  const { t: tx } = useI18n();
  const req = session.get().confirm;
  const finish = (ok: boolean) => {
    session.set({ confirm: undefined });
    router.back();
    req?.resolve(ok);
  };
  if (!req)
    return (
      <Screen style={{ paddingTop: insets.top }}>
        <Button title={tx("common.close")} onPress={() => router.back()} />
      </Screen>
    );
  return (
    <Screen style={{ paddingTop: insets.top }}>
      <View style={{ alignItems: "center", gap: 8, paddingVertical: 16 }}>
        <Ionicons name="lock-closed" size={40} color={t.accent} />
        <T variant="title" center>
          {tx("confirm.title")}
        </T>
        <T tone="muted" center>
          {req.reason}
        </T>
      </View>
      <PinPad
        label="PIN"
        onDone={async (pin) => {
          const r = await verifyPin(pin);
          if (r.ok) return finish(true);
          const n = tries + 1;
          setTries(n);
          if (n >= 3) return finish(false);
          return `${r.message} (${n}/3)`;
        }}
      />
      <Button variant="ghost" title={tx("common.cancel")} onPress={() => finish(false)} />
    </Screen>
  );
}
