/** Bileşen sözlüğü — layout (ui/index.tsx'ten bölündü, 2026-09-27; beceri wallet-ux §3). */
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { space, useTheme } from "./theme";
import { type IoniconName } from "./icons";
import { Button } from "./buttons";
import { tap } from "./haptics";
import { st } from "./styles";
import { T } from "./text";
import { t as tx } from "@/i18n";

// ---- Ekran kabuğu
export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  title,
  subtitle,
  action,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  /** Sekme ekranları: üst başlık yok, büyük başlık içerikte (güvenli alanla). */
  title?: string;
  subtitle?: string;
  /** Başlığın sağında yuvarlak ikon düğmesi (ör. Belgeler "+"). */
  action?: { icon: IoniconName; label: string; onPress: () => void };
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const header = title ? (
    <View style={{ paddingTop: insets.top + space.sm, paddingBottom: space.xs, gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <T variant="display" style={{ flex: 1 }}>
          {title}
        </T>
        {action && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => {
              tap();
              action.onPress();
            }}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: t.card,
              borderWidth: 1,
              borderColor: t.line,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name={action.icon} size={22} color={t.accent} />
          </Pressable>
        )}
      </View>
      {subtitle && <T tone="muted">{subtitle}</T>}
    </View>
  ) : null;
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && { padding: space.xl, gap: space.md }, { paddingBottom: insets.bottom + 96 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      {header}
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && { padding: space.xl, gap: space.md }]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, backgroundColor: t.bg }, style]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  );
}

// ---- Kart, rozet, satır
export function Card({
  children,
  tone = "default",
  style,
  onPress,
  onLongPress,
}: {
  children: React.ReactNode;
  tone?: "default" | "gold" | "danger" | "warn" | "success";
  style?: ViewStyle;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const t = useTheme();
  const border =
    tone === "gold"
      ? t.accent
      : tone === "danger"
        ? t.danger
        : tone === "warn"
          ? t.warn
          : tone === "success"
            ? t.success
            : t.line;
  const body = (
    <View
      style={[
        st.card,
        { backgroundColor: t.card, borderColor: border, borderWidth: tone === "default" ? 1 : 1.5 },
        style,
      ]}
    >
      {children}
    </View>
  );
  return onPress || onLongPress ? (
    <Pressable
      onPress={() => {
        if (!onPress) return;
        tap();
        onPress();
      }}
      onLongPress={onLongPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** Anahtar–değer satırı. `hidden`: seçici açıklamalı alan — değerin yanında küçük kilit rozeti (metin eki değil). */
export function Row({ k, v, hidden }: { k: string; v: string; hidden?: boolean }) {
  const t = useTheme();
  return (
    <View style={[st.row, { borderBottomColor: t.line }]}>
      <Text style={{ color: t.muted, fontSize: 13, flex: 1 }}>{k}</Text>
      <View style={{ flex: 2, flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
        <Text style={{ color: t.text, fontSize: 14, textAlign: "right", flexShrink: 1 }}>{v}</Text>
        {hidden && (
          <View
            accessibilityLabel={tx("ui.selective")}
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: t.accent + "22",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="lock-closed" size={11} color={t.accent} />
          </View>
        )}
      </View>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: IoniconName;
  title: string;
  text?: string;
  action?: { title: string; onPress: () => void };
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", gap: space.sm, paddingVertical: space.xxxl }}>
      <Ionicons name={icon} size={44} color={t.muted} />
      <T variant="heading" center>
        {title}
      </T>
      {text && (
        <T tone="muted" center>
          {text}
        </T>
      )}
      {action && (
        <Button variant="ghost" title={action.title} onPress={action.onPress} style={{ marginTop: space.sm }} />
      )}
    </View>
  );
}

/** Bekleme: spinner yerine adım listesi (trace'ten). */
export function StepList({
  steps,
  active,
  title,
}: {
  steps: Array<{ step: string; detail?: string; t?: number }>;
  active?: string;
  title?: string;
}) {
  const t = useTheme();
  const t0 = steps[0]?.t;
  return (
    <Card>
      {title && <T variant="heading">{title}</T>}
      {steps.map((e, i) => (
        <View key={i} style={{ flexDirection: "row", gap: space.sm, paddingVertical: 4 }}>
          <Ionicons name="checkmark-circle" size={18} color={t.success} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <T>{e.step}</T>
            {e.detail && (
              <T variant="mono" tone="muted">
                {e.detail}
              </T>
            )}
            {typeof e.t === "number" && typeof t0 === "number" && (
              <T variant="secondary" tone="muted">
                +{((e.t - t0) / 1000).toFixed(1)}s
              </T>
            )}
          </View>
        </View>
      ))}
      {active && (
        <View style={{ flexDirection: "row", gap: space.sm, paddingVertical: 4, alignItems: "center" }}>
          <ActivityIndicator color={t.accent} />
          <T tone="muted">{active}</T>
        </View>
      )}
    </Card>
  );
}

/** Katlanır bölüm ("Arka planda ne oldu" vb.): başlık satırına dokununca açılır. */
export function Collapsible({
  title,
  children,
  initiallyOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  initiallyOpen?: boolean;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => {
          tap();
          setOpen(!open);
        }}
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
      >
        <T variant="heading">{title}</T>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={t.muted} />
      </Pressable>
      {open && children}
    </Card>
  );
}

/** Segment denetimi (Tara/Göster, Bilgiler/Kullanım/Arka planda). */
export function Segment<K extends string>({
  value,
  options,
  onChange,
}: {
  value: K;
  options: Array<{ key: K; label: string; icon?: IoniconName }>;
  onChange: (k: K) => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.surface,
        borderRadius: 12,
        padding: 3,
        borderWidth: 1,
        borderColor: t.line,
      }}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              tap();
              onChange(o.key);
            }}
            style={{
              flex: 1,
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 6,
              paddingVertical: 9,
              borderRadius: 10,
              backgroundColor: on ? t.accent : "transparent",
            }}
          >
            {o.icon && <Ionicons name={o.icon} size={15} color={on ? t.onAccent : t.muted} />}
            <Text style={{ color: on ? t.onAccent : t.muted, fontWeight: "700", fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
