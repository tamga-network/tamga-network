/** Bileşen sözlüğü — credential (ui/index.tsx'ten bölündü, 2026-09-27; beceri wallet-ux §3). */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { radius, space, useTheme } from "./theme";
import { categoryIcon, vctCategory } from "./icons";
import { Pill, LiveBadge } from "./badges";
import { tap } from "./haptics";
import { Card } from "./layout";
import { T } from "./text";
import { t as tx } from "@/i18n";

/**
 * Belge kartı — kart formunda, Tamga'ya özgü (gerçek kimlik kartının kopyası DEĞİL): kurum monogramı, tip, kişi, kullanım
 * rozeti; kimlik belgesi altın zemin. `live`: canlı işaret (ana sayfadaki kimlik kartı). `pinned`: raptiye.
 */
export function CredentialCard({
  typeName,
  vct,
  issuerName,
  personName,
  copiesLeft,
  copiesTotal,
  dateText,
  onPress,
  pinned,
  live,
  status,
}: {
  typeName: string;
  vct: string;
  issuerName: string;
  personName?: string;
  copiesLeft: number;
  copiesTotal: number;
  /** ARF VCR_19: ihraççı iptal ettiyse / askıya aldıysa kullanım rozeti yerine durum rozeti. */
  status?: "valid" | "suspended" | "revoked" | "unknown";
  dateText: string;
  onPress: () => void;
  pinned?: boolean;
  live?: boolean;
}) {
  const t = useTheme();
  const isId = vct.includes(":id:");
  const ci = categoryIcon(vctCategory(vct));
  const mono = issuerName
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 && /^[A-ZÇĞİÖŞÜ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const fg = isId ? t.onAccent : t.text;
  const fgMuted = isId ? t.onAccent + "B3" : t.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${typeName}, ${issuerName}`}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      <View
        style={{
          borderRadius: radius.card,
          padding: 18,
          gap: 14,
          backgroundColor: isId ? t.accent : t.card,
          borderWidth: 1,
          borderColor: isId ? t.accent : t.line,
          overflow: "hidden",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -48,
            top: -48,
            width: 170,
            height: 170,
            borderRadius: 85,
            backgroundColor: isId ? "#00000018" : ci.color + "16",
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: isId ? "#00000022" : ci.color + "22",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {mono ? (
              <Text style={{ color: isId ? t.onAccent : ci.color, fontWeight: "800", fontSize: 14 }}>{mono}</Text>
            ) : (
              <Ionicons name={ci.icon} size={20} color={isId ? t.onAccent : ci.color} />
            )}
          </View>
          <Text style={{ color: fgMuted, fontSize: 13, flex: 1 }} numberOfLines={1}>
            {issuerName}
          </Text>
          {live ? <LiveBadge onDark={isId} /> : pinned ? <Ionicons name="pin" size={16} color={fgMuted} /> : null}
        </View>
        <View style={{ gap: 2 }}>
          <Text style={{ color: fg, fontSize: 20, fontWeight: "700", lineHeight: 26 }} numberOfLines={1}>
            {typeName}
          </Text>
          {personName && (
            <Text style={{ color: fg, fontSize: 15 }} numberOfLines={1}>
              {personName}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: fgMuted, fontSize: 12 }}>{dateText}</Text>
          {status === "revoked" || status === "suspended" ? (
            <Pill text={tx(status === "revoked" ? "ui.revoked" : "ui.suspended")} tone="danger" icon="close-circle" />
          ) : (
            <Pill
              text={tx("ui.uses", { left: copiesLeft, total: copiesTotal })}
              tone={copiesLeft === 0 ? "danger" : copiesLeft <= 2 ? "warn" : isId ? "neutral" : "neutral"}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function InstitutionRow({
  name,
  category,
  categoryLabel,
  klass,
  types,
  onPress,
}: {
  name: string;
  category: string;
  categoryLabel: string;
  klass: string;
  types: string[];
  onPress: () => void;
}) {
  const t = useTheme();
  const ci = categoryIcon(category);
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: ci.color + "22",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={ci.icon} size={22} color={ci.color} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="heading" numberOfLines={2}>
            {name}
          </T>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pill text={categoryLabel} tone="info" />
            <Pill
              text={klass === "QUALIFIED" ? "Akredite" : "Kamu"}
              tone={klass === "QUALIFIED" ? "gold" : "neutral"}
            />
            <Pill text={tx("common.inTrustList")} tone="success" icon="shield-checkmark" />
          </View>
          <T variant="secondary" tone="muted" numberOfLines={1}>
            {types.length ? types.join(" · ") : tx("inst.notIssuing")}
          </T>
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.muted} />
      </View>
    </Card>
  );
}
