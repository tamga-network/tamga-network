/** Bileşen sözlüğü — text (ui/index.tsx'ten bölündü, 2026-09-27; beceri wallet-ux §3). */
import React from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useTheme, type } from "./theme";

// ---- Metin
type Variant = keyof typeof type;

type Tone = "default" | "muted" | "accent" | "danger" | "success";

export function T({
  children,
  variant = "body",
  tone = "default",
  style,
  center,
  numberOfLines,
}: {
  children: React.ReactNode;
  variant?: Variant;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  center?: boolean;
  numberOfLines?: number;
}) {
  const t = useTheme();
  const color =
    tone === "muted"
      ? t.muted
      : tone === "accent"
        ? t.accent
        : tone === "danger"
          ? t.danger
          : tone === "success"
            ? t.success
            : t.text;
  return (
    <Text numberOfLines={numberOfLines} style={[type[variant], { color }, center && { textAlign: "center" }, style]}>
      {children}
    </Text>
  );
}
