/** Bileşen sözlüğü — badges (ui/index.tsx'ten bölündü, 2026-09-27; beceri wallet-ux §3). */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { space, useTheme } from "./theme";
import { type IoniconName } from "./icons";
import { tap } from "./haptics";
import { st } from "./styles";
import { T } from "./text";
import { locale, t as tx } from "@/i18n";

export function Pill({
  text,
  tone = "neutral",
  icon,
}: {
  text: string;
  tone?: "neutral" | "success" | "danger" | "warn" | "info" | "gold";
  icon?: IoniconName;
}) {
  const t = useTheme();
  const bg =
    tone === "success"
      ? t.success
      : tone === "danger"
        ? t.danger
        : tone === "warn"
          ? t.warn
          : tone === "info"
            ? t.info
            : tone === "gold"
              ? t.accent
              : t.line;
  const fg = tone === "gold" ? t.onAccent : tone === "neutral" ? t.text : "#fff";
  return (
    <View style={[st.pill, { backgroundColor: bg }]}>
      {icon && <Ionicons name={icon} size={12} color={fg} />}
      <Text style={{ color: fg, fontSize: 11, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

// ---- Alan nesneleri
/** Canlı işaret: ekran görüntüsü ile karışmasın diye saniyede bir yenilenen saat + nabız noktası (insan gözüyle kontrol). */
export function LiveBadge({ onDark }: { onDark?: boolean }) {
  const t = useTheme();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const fg = onDark ? t.onAccent : t.muted;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: now.getSeconds() % 2 ? t.success : fg,
        }}
      />
      <Text style={{ color: fg, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "600" }}>
        {now.toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </Text>
    </View>
  );
}

/** Hassas alan (TCKN, belge no): kapalı gelir, dokununca 8 sn açılır (omuz üstü bakışa karşı). */
export function SensitiveValue({ value }: { value: string }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const masked =
    value.length > 4 ? value.slice(0, 2) + "•".repeat(Math.max(3, value.length - 4)) + value.slice(-2) : "••••";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={open ? tx("ui.hide") : tx("ui.tapToShow")}
      onPress={() => {
        tap();
        setOpen(!open);
        if (!open) setTimeout(() => setOpen(false), 8000);
      }}
      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      <Text style={{ color: t.text, fontSize: 14, fontVariant: ["tabular-nums"] }}>{open ? value : masked}</Text>
      <Ionicons name={open ? "eye-off-outline" : "eye-outline"} size={15} color={t.muted} />
    </Pressable>
  );
}

/** QR alanı: hazır olduğunda gerçek QR (ADR-0012 sonrası); şimdilik kilitli yer tutucu + açıklama. */
export function QrArea({ ready, children, note }: { ready: boolean; children?: React.ReactNode; note: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: "center", gap: space.sm }}>
      <View
        style={{
          width: 220,
          height: 220,
          borderRadius: 20,
          backgroundColor: ready ? "#FFFFFF" : t.card,
          borderWidth: 1,
          borderColor: t.line,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {ready ? children : <Ionicons name="lock-closed-outline" size={44} color={t.muted} />}
      </View>
      <T variant="secondary" tone="muted" center>
        {note}
      </T>
    </View>
  );
}

export function Spinner({ text }: { text?: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: space.md,
        backgroundColor: t.bg,
        padding: space.xxl,
      }}
    >
      <ActivityIndicator size="large" color={t.accent} />
      {text && (
        <T tone="muted" center>
          {text}
        </T>
      )}
    </View>
  );
}
