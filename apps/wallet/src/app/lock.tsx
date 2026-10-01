/** Kilit ekranı: açılışta otomatik Face ID/Touch ID, yedek PIN tuş takımı. */
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, PinPad, Screen, T, hapticSuccess, useTheme } from "@/ui";
import { useWallet } from "@/state/wallet";
import { biometricsAvailable, biometricUnlock, verifyPin } from "@/platform";
import { ensureWalletUnit } from "@/wallet";
import { useI18n } from "@/i18n";

export default function Lock() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { state, setState, setUnlocked, session } = useWallet();
  const [bio, setBio] = useState(false);
  const [bioErr, setBioErr] = useState<string | null>(null);
  const { t: tx } = useI18n();
  const open = () => {
    setUnlocked(true);
    hapticSuccess();
    // Kilitliyken gelen derin bağlantı (web sitesi "Tamga Wallet'ta aç") varsa doğrudan Tara sekmesine işlet
    const link = session.get().inboundLink;
    session.set({ inboundLink: undefined });
    if (link) router.replace({ pathname: "/(tabs)/scan", params: { link } });
    else router.replace("/(tabs)");
    if (state)
      void ensureWalletUnit(state).then((r) => {
        if (!r.error) setState(r.state);
      });
  };
  const tryBio = async () => {
    if (!(await biometricsAvailable())) return false;
    if (await biometricUnlock(tx("lock.reason"))) {
      open();
      return true;
    }
    return false;
  };
  useEffect(() => {
    (async () => {
      const ok = await biometricsAvailable();
      setBio(ok);
      if (ok && state?.settings.biometrics) void tryBio();
    })();
  }, []);
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 8, paddingTop: insets.top + 32 }}>
        <Ionicons name="wallet" size={48} color={t.accent} />
        <T variant="display" center>
          Tamga Wallet
        </T>
        <T tone="muted" center>
          {tx("lock.text")}
        </T>
      </View>
      <PinPad
        label="PIN"
        onDone={async (pin) => {
          const r = await verifyPin(pin);
          if (r.ok) open();
          else return r.message;
        }}
      />
      {bioErr && (
        <T variant="secondary" tone="danger" center>
          {bioErr}
        </T>
      )}
      <Button
        variant="secondary"
        icon="qr-code"
        title={tx("lock.showPass")}
        onPress={async () => {
          if (await tryBio()) router.replace({ pathname: "/(tabs)/scan", params: { mode: "show" } });
          else setBioErr(tx("lock.unlockFirst"));
        }}
      />
      {bio && (
        <Button
          variant="ghost"
          icon="finger-print"
          title={tx("lock.bio")}
          onPress={async () => {
            if (!(await tryBio())) setBioErr(tx("lock.bioFailed"));
          }}
        />
      )}
    </Screen>
  );
}
