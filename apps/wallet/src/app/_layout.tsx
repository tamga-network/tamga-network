/**
 * Kök düzen: sağlayıcılar + Stack. Tema tercihi ayarlardan (sistem / karanlık / açık); varsayılan karanlık.
 * Derin bağlantı (D11 aynı cihaz): openid4vp:// | openid-credential-offer:// → kilit açıksa Tara sekmesi işler,
 * kilitliyse oturuma yazılır ve kilit açılınca işlenir. Not: Expo Go özel şemaları yakalamaz; dev build gerekir.
 */
import React, { useEffect, useEffectEvent } from "react";
import { useColorScheme, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { DARK, LIGHT, ThemeContext, useTheme } from "@/ui/theme";
import { T } from "@/ui";
import { WalletProvider, useWallet } from "@/state/wallet";
import { I18nProvider, useI18n } from "@/i18n";

export default function Root() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <WalletProvider>
            <Themed>
              <Routes />
              <BusyToast />
            </Themed>
          </WalletProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Tema: ayar "system" ise cihaz temasına uyar (açık → açık, aksi karanlık); "dark"/"light" sabit. */
function Themed({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const { state } = useWallet();
  const pref = state?.settings.theme ?? "dark";
  const theme = pref === "light" || (pref === "system" && scheme === "light") ? LIGHT : DARK;
  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      {children}
    </ThemeContext.Provider>
  );
}

const isInboundLink = (u: string) => u.startsWith("openid4vp://") || u.startsWith("openid-credential-offer://");

function Routes() {
  const theme = useTheme();
  const url = Linking.useURL();
  const { state, unlocked, session } = useWallet();
  const { t: tx } = useI18n();
  const onUrl = useEffectEvent((u: string) => {
    if (!isInboundLink(u)) return;
    if (state && unlocked) router.push({ pathname: "/(tabs)/scan", params: { link: u } });
    else session.set({ inboundLink: u });
  });
  useEffect(() => {
    if (url) onUrl(url);
  }, [url]);
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.accent,
        headerTitleStyle: { color: theme.text, fontWeight: "700" },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: theme.bg },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="setup" options={{ headerShown: false }} />
      <Stack.Screen name="biometrics" options={{ headerShown: false }} />
      <Stack.Screen name="lock" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, animation: "fade" }} />
      <Stack.Screen name="identity" options={{ title: tx("nav.identity") }} />
      <Stack.Screen name="contact" options={{ title: tx("nav.contact") }} />
      <Stack.Screen name="migration" options={{ title: tx("nav.migration") }} />
      <Stack.Screen name="pseudonyms" options={{ title: tx("set.pseudonyms") }} />
      <Stack.Screen name="shared" options={{ title: tx("sw.title") }} />
      <Stack.Screen name="proximity" options={{ title: tx("nav.proximity") }} />
      <Stack.Screen name="check" options={{ title: tx("nav.check") }} />
      <Stack.Screen name="institutions/index" options={{ title: tx("nav.institutions") }} />
      <Stack.Screen name="institutions/[slug]" options={{ title: tx("nav.institution") }} />
      <Stack.Screen name="credential/[id]" options={{ title: tx("nav.credential") }} />
      <Stack.Screen name="receive/txcode" options={{ title: tx("nav.receive") }} />
      <Stack.Screen
        name="receive/progress"
        options={{ title: tx("nav.wait"), headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="receive/done"
        options={{ title: tx("nav.added"), headerBackVisible: false, gestureEnabled: false }}
      />
      <Stack.Screen name="review" options={{ title: tx("nav.review"), presentation: "modal", headerShown: false }} />
      <Stack.Screen
        name="confirm"
        options={{ title: tx("nav.confirm"), presentation: "modal", headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen name="sent" options={{ title: tx("nav.sent"), headerBackVisible: false, gestureEnabled: false }} />
      <Stack.Screen name="idv/cb" options={{ headerShown: false }} />
    </Stack>
  );
}

/** Kısa süreli meşgul metni (ağ isteği vb.) — ekranı kilitlemez, altta küçük şerit. */
function BusyToast() {
  const { busy } = useWallet();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  if (!busy) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 20, right: 20, bottom: insets.bottom + 84, alignItems: "center" }}
    >
      <View
        style={{
          backgroundColor: t.card,
          borderRadius: 999,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: t.line,
        }}
      >
        <T variant="secondary">{busy}</T>
      </View>
    </View>
  );
}
