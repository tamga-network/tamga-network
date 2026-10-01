/** Bileşen sözlüğü — inputs (ui/index.tsx'ten bölündü, 2026-09-27; beceri wallet-ux §3). */
import React, { useRef, useState } from "react";
import { Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { space, useTheme } from "./theme";
import { tap, hapticError } from "./haptics";
import { st } from "./styles";
import { T } from "./text";

// ---- Alanlar
export function Field({
  label,
  help,
  value,
  onCommit,
  commitDelayMs = 600,
  ...input
}: {
  label: string;
  help?: string;
  value: string;
  onCommit: (v: string) => void | Promise<void>;
  commitDelayMs?: number;
} & Omit<TextInputProps, "value" | "onChangeText">) {
  const t = useTheme();
  const [v, setV] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setV(value);
  }
  const commit = (x: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (x !== value) void onCommit(x);
  };
  return (
    <View style={{ gap: space.xs }}>
      <T variant="secondary" tone="muted">
        {label}
      </T>
      <TextInput
        {...input}
        value={v}
        placeholderTextColor={t.muted}
        autoCapitalize={input.autoCapitalize ?? "none"}
        autoCorrect={false}
        onChangeText={(x) => {
          setV(x);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(x), commitDelayMs);
        }}
        onEndEditing={() => commit(v)}
        style={[st.input, { backgroundColor: t.inputBg, borderColor: t.line, color: t.text }, input.style]}
      />
      {help && (
        <T variant="secondary" tone="muted">
          {help}
        </T>
      )}
    </View>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        st.input,
        {
          backgroundColor: t.inputBg,
          borderColor: t.line,
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          paddingVertical: 10,
        },
      ]}
    >
      <Ionicons name="search" size={18} color={t.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={{ flex: 1, color: t.text, fontSize: 16, padding: 0 }}
      />
      {!!value && (
        <Pressable accessibilityLabel="Temizle" onPress={() => onChange("")}>
          <Ionicons name="close-circle" size={18} color={t.muted} />
        </Pressable>
      )}
    </View>
  );
}

/** Özel PIN tuş takımı: sistem klavyesi yok, 6 nokta. onDone bir metin döndürürse hata gösterilir (titreşim + kırmızı). */
export function PinPad({
  label,
  onDone,
}: {
  label: string;
  onDone: (pin: string) => string | void | undefined | Promise<string | void | undefined>;
}) {
  const t = useTheme();
  const [v, setV] = useState("");
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (pin: string) => {
    const msg = await onDone(pin);
    setV("");
    if (msg) {
      setError(msg);
      setShake(true);
      hapticError();
      setTimeout(() => setShake(false), 600);
    } else setError(null);
  };
  const press = (k: string) => {
    tap();
    if (k !== "⌫" && v.length === 5) {
      setV(v + k);
      void submit(v + k);
      return;
    }
    if (k === "⌫") setV((x) => x.slice(0, -1));
    else if (v.length < 6) setV((x) => x + k);
  };
  return (
    <View style={{ alignItems: "center", gap: space.xl }}>
      <T tone="muted" center>
        {label}
      </T>
      <View style={{ flexDirection: "row", gap: 14 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: shake ? t.danger : i < v.length ? t.accent : t.line,
            }}
          />
        ))}
      </View>
      {error && (
        <T variant="secondary" tone="danger" center>
          {error}
        </T>
      )}
      <View style={{ gap: space.md }}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
          ["", "0", "⌫"],
        ].map((r, i) => (
          <View key={i} style={{ flexDirection: "row", gap: space.md }}>
            {r.map((k, j) =>
              k === "" ? (
                <View key={j} style={st.key} />
              ) : (
                <Pressable
                  key={j}
                  accessibilityRole="button"
                  accessibilityLabel={k === "⌫" ? "Sil" : k}
                  onPress={() => press(k)}
                  style={({ pressed }) => [st.key, { backgroundColor: pressed ? t.line : t.card, borderColor: t.line }]}
                >
                  {k === "⌫" ? (
                    <Ionicons name="backspace-outline" size={26} color={t.text} />
                  ) : (
                    <Text style={{ color: t.text, fontSize: 26, fontWeight: "600" }}>{k}</Text>
                  )}
                </Pressable>
              ),
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
