/**
 * Beş sekme: Ana sayfa · Belgeler · Tara (ortada, büyük) · Geçmiş · Ayarlar. Sekmeler arası YATAY KAYDIRMA
 * (expo-router/js-top-tabs + pager-view, çubuk altta). Başlıklar ekranın içinde (`Screen title=`). Kilit açılmadıysa kilide döner.
 * Not (SDK 56+): @react-navigation/* doğrudan import edilmez; expo-router giriş noktaları kullanılır.
 */
import React from "react";
import { Pressable, View } from "react-native";
import { Redirect } from "expo-router";
import { TopTabs } from "expo-router/js-top-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { T, useTheme } from "@/ui";
import type { IoniconName } from "@/ui/icons";
import { useWallet } from "@/state/wallet";
import { useI18n, type Key } from "@/i18n";

/** Sekme çubuğuna gelen asgari veri (navigator tipi expo-router içinde dışa açık değil). */
interface TabBarProps {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  navigation: { navigate: (name: string) => void };
}

const TABS: Record<string, { label: Key; icon: IoniconName }> = {
  index: { label: "nav.home", icon: "home" },
  documents: { label: "nav.documents", icon: "albums" },
  scan: { label: "nav.scan", icon: "qr-code" },
  history: { label: "nav.history", icon: "time" },
  settings: { label: "nav.settings", icon: "settings" },
};

function TabBar({ state, navigation }: TabBarProps) {
  const t = useTheme();
  const { t: tx } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.tabBar,
        borderTopWidth: 1,
        borderTopColor: t.line,
        paddingBottom: Math.max(insets.bottom, 10),
        paddingTop: 8,
      }}
    >
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const m = TABS[route.name];
        const meta = m ? { label: tx(m.label), icon: m.icon } : { label: route.name, icon: "ellipse" as IoniconName };
        const big = route.name === "scan";
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              navigation.navigate(route.name);
            }}
            style={{ flex: 1, alignItems: "center", gap: 4, minHeight: 56 }}
          >
            {big ? (
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 29,
                  marginTop: -24,
                  backgroundColor: focused ? t.accent : t.card,
                  borderWidth: 1.5,
                  borderColor: t.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={meta.icon} size={28} color={focused ? t.onAccent : t.accent} />
              </View>
            ) : (
              <Ionicons name={meta.icon} size={24} color={focused ? t.accent : t.muted} />
            )}
            <T variant="secondary" tone={focused ? "accent" : "muted"} style={{ fontWeight: "600", fontSize: 11 }}>
              {meta.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { unlocked, state } = useWallet();
  if (!state || !unlocked) return <Redirect href="/" />;
  return (
    <TopTabs
      tabBarPosition="bottom"
      tabBar={(props: TabBarProps) => <TabBar {...props} />}
      screenOptions={{ swipeEnabled: true, lazy: true, animationEnabled: true }}
    >
      <TopTabs.Screen name="index" />
      <TopTabs.Screen name="documents" />
      <TopTabs.Screen name="scan" />
      <TopTabs.Screen name="history" />
      <TopTabs.Screen name="settings" />
    </TopTabs>
  );
}
