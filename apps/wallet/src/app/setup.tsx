/** Kurulum: PIN belirle (zayıf PIN engeli) → doğrula → cüzdan oluştur → biyometri teklifi → kimlik. WUA arka planda (DB-16). */
import React, { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Card, PinPad, Screen, T, hapticSuccess, useTheme } from "@/ui";
import { useWallet } from "@/state/wallet";
import { setPin } from "@/platform";
import { createWallet, ensureWalletUnit } from "@/wallet";
import { t, useI18n } from "@/i18n";

/** Zayıf PIN kuralı (AltID ile aynı): aynı rakamlar, ardışık artan/azalan, yaygın kalıplar. */
export function weakPinReason(pin: string): string | null {
  if (!/^\d{6}$/.test(pin)) return t("pin.sixDigits");
  if (/^(\d)\1{5}$/.test(pin)) return t("pin.sameDigits");
  const d = pin.split("").map(Number);
  const asc = d.every((x, i) => i === 0 || x === (d[i - 1] + 1) % 10);
  const desc = d.every((x, i) => i === 0 || x === (d[i - 1] + 9) % 10);
  if (asc || desc) return t("pin.sequence");
  if (["112233", "121212", "123123", "111222", "000111"].includes(pin)) return t("pin.pattern");
  return null;
}

export default function Setup() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { state, setState, setUnlocked } = useWallet();
  const [step, setStep] = useState<1 | 2>(1);
  const [first, setFirst] = useState("");
  const { t: tx } = useI18n();
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 8, paddingTop: insets.top + 24 }}>
        <Ionicons name="shield-checkmark" size={48} color={t.accent} />
        <T variant="display" center>
          {step === 1 ? tx("setup.title1") : tx("setup.title2")}
        </T>
        <T tone="muted" center>
          {step === 1 ? tx("setup.help1") : tx("setup.help2")}
        </T>
      </View>
      <PinPad
        key={step}
        label={step === 1 ? tx("setup.pinLabel") : tx("setup.again")}
        onDone={async (pin) => {
          if (step === 1) {
            const why = weakPinReason(pin);
            if (why) return why;
            setFirst(pin);
            setStep(2);
            return;
          }
          if (pin !== first) {
            setStep(1);
            return tx("setup.mismatch");
          }
          await setPin(pin);
          const st = state ?? (await createWallet());
          setState(st);
          setUnlocked(true);
          hapticSuccess();
          router.replace("/biometrics");
          void ensureWalletUnit(st).then((r) => {
            if (!r.error) setState(r.state);
          });
        }}
      />
      <Card>
        <T variant="secondary" tone="muted">
          {tx("setup.note")}
        </T>
      </Card>
    </Screen>
  );
}
