/**
 * QR sekmesi: Tara (kurum daveti / doğrulayıcı isteği) · Göster (geçiş kartı — QR üretimi ADR-0012 sonrası; ekran hazır).
 * `?mode=show` ile doğrudan Göster açılır (ana sayfa hızlı eylemi, kilit ekranı kısayolu).
 * `?link=<openid4vp://…>` derin bağlantıyı QR okunmuş gibi işler (D11 aynı cihaz; kök düzen yönlendirir).
 */
import React, { useCallback, useEffect, useEffectEvent, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, EmptyState, Screen, Segment, T, hapticError, hapticSuccess, useTheme } from "@/ui";
import { ShowPane } from "@/features/pass/ShowPane";
import { useWallet } from "@/state/wallet";
import { isVpQr, scanToReview } from "@/present";
import { friendlyError, scanToOffer, type Trace } from "@/wallet";
import { beginOfferRequest, hasIdentity } from "@/issuance";
import { offerIssuerState } from "@tamga-network/wallet-core";
import { useI18n } from "@/i18n";

type Mode = "scan" | "show";

export default function QrTab() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string; link?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === "show" ? "show" : "scan");
  const { t: tx } = useI18n();
  const seg = (
    <View style={{ paddingHorizontal: 16, paddingTop: insets.top + 8, backgroundColor: t.bg }}>
      <Segment
        value={mode}
        onChange={setMode}
        options={[
          { key: "scan", label: tx("scan.scan"), icon: "scan" },
          { key: "show", label: tx("scan.show"), icon: "qr-code" },
        ]}
      />
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {seg}
      {mode === "scan" ? <ScanPane link={params.link} /> : <ShowPane />}
    </View>
  );
}

function ScanPane({ link }: { link?: string }) {
  const t = useTheme();
  const { state, setState, setBusy, session } = useWallet();
  const { t: tx } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);
  const [manual, setManual] = useState("");
  const [focused, setFocused] = useState(false);
  // Sekme odakta değilken kamera bağlanmaz (pil + gizlilik); kaydırmayla dönünce yeniden açılır.
  useFocusEffect(
    useCallback(() => {
      setLocked(false);
      setFocused(true);
      return () => {
        setLocked(true);
        setFocused(false);
      };
    }, []),
  );

  const handle = async (data: string) => {
    if (locked || !state) return;
    setLocked(true);
    const trace: Trace = [];
    session.set({ trace: trace });
    try {
      if (isVpQr(data)) {
        setBusy(tx("scan.fetchingRequest"));
        const model = await scanToReview(state, data, trace);
        session.set({ review: { model } });
        hapticSuccess();
        router.push("/review");
      } else {
        setBusy(tx("scan.fetchingOffer"));
        const o = await scanToOffer(data, trace);
        if (offerIssuerState(o.offer)) {
          // ADR-0020: kimliğe bağlı teklif → kimlik sunumuyla kurumdan belge (PIN yok)
          if (!hasIdentity(state)) {
            hapticError();
            Alert.alert(tx("scan.needIdentityTitle"), tx("scan.needIdentityText"), [
              { text: tx("common.cancel"), style: "cancel", onPress: () => setLocked(false) },
              { text: tx("common.verifyIdentity"), onPress: () => router.push("/identity") },
            ]);
            return;
          }
          const r = await beginOfferRequest(state, o.offer, trace);
          setState(r.state);
          session.set({ review: { model: r.req.review, institution: r.req } });
          hapticSuccess();
          router.push("/review");
          return;
        }
        session.set({ offer: o });
        hapticSuccess();
        router.push("/receive/txcode");
      }
    } catch (e) {
      hapticError();
      Alert.alert(tx("scan.failed"), friendlyError(e), [{ text: tx("common.ok"), onPress: () => setLocked(false) }]);
    } finally {
      setBusy(null);
      setManual("");
    }
  };
  // Derin bağlantı: aynı bağlantı bir kez işlenir (parametre değişmedikçe yeniden çalışmaz); kamera kurulduktan sonra
  const onLink = useEffectEvent((u: string) => void handle(u));
  useEffect(() => {
    if (!link) return;
    const id = setTimeout(() => onLink(link), 0);
    return () => clearTimeout(id);
  }, [link]);

  if (!permission)
    return (
      <Screen>
        <T tone="muted">{tx("scan.cameraPreparing")}</T>
      </Screen>
    );
  if (!permission.granted)
    return (
      <Screen>
        <EmptyState
          icon="camera-outline"
          title={tx("scan.cameraTitle")}
          text={tx("scan.cameraText")}
          action={{ title: tx("scan.allow"), onPress: () => void requestPermission() }}
        />
      </Screen>
    );
  return (
    <View style={{ flex: 1, backgroundColor: "#000", marginTop: 10 }}>
      {focused ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => void handle(data)}
        />
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 16, left: 0, right: 0, alignItems: "center", gap: 6 }}
      >
        <T variant="title" style={{ color: "#fff" }}>
          {tx("scan.frame")}
        </T>
        <T variant="secondary" style={{ color: "#ddd" }}>
          {tx("scan.frameSub")}
        </T>
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: "28%",
          left: "15%",
          width: "70%",
          aspectRatio: 1,
          borderWidth: 3,
          borderColor: t.accent,
          borderRadius: 24,
          opacity: 0.9,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ backgroundColor: t.bg, padding: 16, paddingBottom: 16, gap: 8 }}
      >
        <T variant="secondary" tone="muted">
          {tx("scan.paste")}
        </T>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={manual}
            onChangeText={setManual}
            placeholder="openid-credential-offer://… | openid4vp://…"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => manual && void handle(manual)}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: t.line,
              backgroundColor: t.inputBg,
              color: t.text,
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 13,
            }}
          />
          <Button title={tx("scan.open")} disabled={!manual} onPress={() => handle(manual)} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
