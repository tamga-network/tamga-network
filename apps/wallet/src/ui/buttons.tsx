/** Bileşen sözlüğü — buttons (ui/index.tsx'ten bölündü, 2026-09-27; beceri wallet-ux §3). */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./theme";
import { type IoniconName } from "./icons";
import { tap } from "./haptics";
import { st } from "./styles";
import { T } from "./text";

// ---- Düğmeler
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: ButtonVariant;
  icon?: IoniconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const bg =
    variant === "primary"
      ? t.accent
      : variant === "danger"
        ? t.danger
        : variant === "secondary"
          ? t.card
          : "transparent";
  const fg =
    variant === "primary"
      ? t.onAccent
      : variant === "danger"
        ? t.onDanger
        : variant === "secondary"
          ? t.text
          : t.accent;
  const off = disabled || loading || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={off}
      onPress={async () => {
        tap();
        const r = onPress();
        if (r instanceof Promise) {
          setBusy(true);
          try {
            await r;
          } finally {
            setBusy(false);
          }
        }
      }}
      style={({ pressed }) => [
        st.btn,
        {
          backgroundColor: bg,
          opacity: off ? 0.45 : pressed ? 0.85 : 1,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: t.accent,
        },
        style,
      ]}
    >
      {loading || busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={fg} />}
          <Text style={[st.btnText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** WL8: aşırı talep / kayıtsız doğrulayıcıda düğme gecikmeli etkinleşir. */
export function DelayedButton({
  title,
  delayMs,
  ...rest
}: {
  title: string;
  delayMs: number;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  variant?: ButtonVariant;
  icon?: IoniconName;
}) {
  const [left, setLeft] = useState(Math.ceil(delayMs / 1000));
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return <Button {...rest} title={left > 0 ? `${title} (${left})` : title} disabled={rest.disabled || left > 0} />;
}

export function QuickAction({ icon, label, onPress }: { icon: IoniconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [{ alignItems: "center", gap: 6, flex: 1, opacity: pressed ? 0.7 : 1 }]}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: t.card,
          borderWidth: 1,
          borderColor: t.line,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={24} color={t.accent} />
      </View>
      <T variant="secondary" center>
        {label}
      </T>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  icon,
  color,
  onPress,
}: {
  label: string;
  active?: boolean;
  icon?: IoniconName;
  color?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={[st.chip, { backgroundColor: active ? t.accent : t.card, borderColor: active ? t.accent : t.line }]}
    >
      {icon && <Ionicons name={icon} size={14} color={active ? t.onAccent : (color ?? t.muted)} />}
      <Text style={{ color: active ? t.onAccent : t.text, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}
