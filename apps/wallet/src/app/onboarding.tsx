/** Tanıtım: 3 kaydırmalı ekran (beklenti kurma) → kurulum. Yalnızca cüzdan yokken görünür. */
import React, { useRef, useState } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, T, useTheme } from "@/ui";
import type { IoniconName } from "@/ui/icons";
import { useI18n, type Key } from "@/i18n";

const PAGES: Array<{ icon: IoniconName; title: Key; text: Key }> = [
  { icon: "phone-portrait-outline", title: "onboarding.p1.title", text: "onboarding.p1.text" },
  { icon: "eye-off-outline", title: "onboarding.p2.title", text: "onboarding.p2.text" },
  { icon: "id-card-outline", title: "onboarding.p3.title", text: "onboarding.p3.text" },
];

export default function Onboarding() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t: tx } = useI18n();
  const [page, setPage] = useState(0);
  const list = useRef<FlatList>(null);
  const last = page === PAGES.length - 1;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
      <FlatList
        ref={list}
        data={PAGES}
        keyExtractor={(p) => p.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 20 }}>
            <View
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                backgroundColor: t.card,
                borderWidth: 1,
                borderColor: t.line,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={item.icon} size={56} color={t.accent} />
            </View>
            <T variant="display" center>
              {tx(item.title)}
            </T>
            <T tone="muted" center>
              {tx(item.text)}
            </T>
          </View>
        )}
      />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 }}>
        {PAGES.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === page ? 22 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: i === page ? t.accent : t.line,
            }}
          />
        ))}
      </View>
      <View style={{ paddingHorizontal: 24, gap: 8 }}>
        <Button
          title={last ? tx("onboarding.create") : tx("common.continue")}
          icon={last ? "arrow-forward" : undefined}
          onPress={() => {
            if (last) router.replace("/setup");
            else list.current?.scrollToIndex({ index: page + 1, animated: true });
          }}
        />
        {!last && <Button variant="ghost" title={tx("common.skip")} onPress={() => router.replace("/setup")} />}
      </View>
    </View>
  );
}
