/** Ayarlar: güvenlik, görünüm, cüzdan doğrulaması (WUA), geliştirici adresleri (katlanır), sıfırlama. */
import React, { useState } from "react";
import { Alert, Switch, View } from "react-native";
import { router } from "expo-router";
import type { WalletState } from "@tamga-network/wallet-core";
import { Button, Card, Chip, Field, Pill, Row, Screen, T, useTheme } from "@/ui";
import { useWallet } from "@/state/wallet";
import { ensureWalletUnit, resetWallet, save } from "@/wallet";
import { LANGS, fmtDateOf, useI18n, type Key } from "@/i18n";

const DEV_FIELDS: ReadonlyArray<
  readonly ["trustBase" | "providerBase" | "issuerBase" | "idBase", Key, string, string]
> = [
  ["trustBase", "set.devTrust", "http://192.168.1.10:4004/trust", "trust.tamga.network"],
  ["providerBase", "set.devProvider", "http://192.168.1.10:4005", "wallet.tamga.network"],
  ["issuerBase", "set.devIssuer", "http://192.168.1.10:4001", "issuer.tamga.network"],
  ["idBase", "set.devId", "http://192.168.1.10:4006", "id.tamga.network"],
];

const THEMES = [
  ["dark", "set.themeDark", "moon"],
  ["light", "set.themeLight", "sunny"],
  ["system", "set.themeSystem", "phone-portrait"],
] as const;

export default function Settings() {
  const t = useTheme();
  const { state, setState, setUnlocked } = useWallet();
  const [dev, setDev] = useState(false);
  const { t: tx, pref, setPref } = useI18n();
  if (!state) return null;
  const patch = async (s: Partial<WalletState["settings"]>) =>
    setState(await save({ ...state, settings: { ...state.settings, ...s } }));
  return (
    <Screen title={tx("nav.settings")}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <T variant="heading">{tx("set.bio")}</T>
            <T variant="secondary" tone="muted">
              {tx("set.bioHelp")}
            </T>
          </View>
          <Switch
            value={!!state.settings.biometrics}
            trackColor={{ true: t.accent }}
            onValueChange={(v) => void patch({ biometrics: v })}
          />
        </View>
      </Card>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <T variant="heading">{tx("set.autoRefresh")}</T>
            <T variant="secondary" tone="muted">
              {tx("set.autoRefreshHelp")}
            </T>
          </View>
          <Switch
            value={state.settings.autoRefresh !== false}
            trackColor={{ true: t.accent }}
            onValueChange={(v) => void patch({ autoRefresh: v })}
          />
        </View>
      </Card>
      <Card>
        <T variant="heading">{tx("set.appearance")}</T>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {THEMES.map(([key, label, icon]) => (
            <Chip
              key={key}
              label={tx(label)}
              icon={icon}
              active={(state.settings.theme ?? "dark") === key}
              onPress={() => void patch({ theme: key })}
            />
          ))}
        </View>
      </Card>
      <Card>
        <T variant="heading">{tx("set.language")}</T>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Chip
            label={tx("set.langSystem")}
            icon="phone-portrait"
            active={pref === "system"}
            onPress={() => setPref("system")}
          />
          {LANGS.map((l) => (
            <Chip key={l.key} label={l.label} active={pref === l.key} onPress={() => setPref(l.key)} />
          ))}
        </View>
        <T variant="secondary" tone="muted">
          {tx("set.langHelp")}
        </T>
      </Card>
      <Card>
        <T variant="heading">{tx("set.wua")}</T>
        {/* ADR-0025: cüzdan birimi sağlayıcıda kayıtlı; her belge işleminde yeni, kısa ömürlü WIA alınır */}
        {state.walletUnit ? (
          <>
            <Pill text={tx("set.wuaOk")} tone="success" icon="shield-checkmark" />
            <Row k={tx("set.wuaSince")} v={fmtDateOf(state.walletUnit.registeredAt * 1000)} />
            <Row k={tx("set.wuaStorage")} v={tx("set.wuaStorageSoftware")} />
            <T variant="secondary" tone="muted">
              {tx("set.wuaHelp")}
            </T>
          </>
        ) : (
          <Pill text={tx("set.wuaNone")} tone="warn" />
        )}
        <Button
          variant="secondary"
          title={tx("set.refresh")}
          icon="refresh"
          onPress={async () => {
            const r = await ensureWalletUnit(state);
            setState(r.state);
            Alert.alert(r.error ? tx("set.wuaFailed") : tx("set.wuaRefreshed"), r.error ?? "");
          }}
        />
      </Card>
      <Card>
        <T variant="heading">{tx("set.sharedWith")}</T>
        <T variant="secondary" tone="muted">
          {tx("set.sharedWithHelp")}
        </T>
        <Button
          variant="secondary"
          title={tx("set.sharedWith")}
          icon="business-outline"
          onPress={() => router.push("/shared")}
        />
      </Card>
      <Card>
        <T variant="heading">{tx("set.pseudonyms")}</T>
        <T variant="secondary" tone="muted">
          {tx("set.pseudonymsHelp")}
        </T>
        <Button
          variant="secondary"
          title={tx("set.pseudonyms")}
          icon="person-circle-outline"
          onPress={() => router.push("/pseudonyms")}
        />
      </Card>
      <Card>
        <T variant="heading">{tx("set.keys")}</T>
        <T variant="secondary" tone="muted">
          {tx("set.keysText")}
        </T>
        <Button
          variant="secondary"
          title={tx("set.migration")}
          icon="phone-portrait-outline"
          onPress={() => router.push("/migration")}
        />
      </Card>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <T variant="heading">{tx("set.dev")}</T>
          <Switch value={dev} trackColor={{ true: t.accent }} onValueChange={setDev} />
        </View>
        {dev && (
          <>
            {DEV_FIELDS.map(([key, label, ph, host]) => (
              <Field
                key={key}
                label={tx(label)}
                help={tx("set.devEmpty", { host })}
                placeholder={ph}
                keyboardType="url"
                value={state.settings[key] ?? ""}
                onCommit={(v) => patch({ [key]: v.trim() || undefined })}
              />
            ))}
            <T variant="mono" tone="muted">
              instance {state.instanceId}
            </T>
          </>
        )}
      </Card>
      <Card tone="danger">
        <T variant="heading">{tx("set.reset")}</T>
        <T variant="secondary" tone="muted">
          {tx("set.resetText")}
        </T>
        <Button
          variant="danger"
          title={tx("set.resetButton")}
          icon="trash"
          onPress={() =>
            Alert.alert(tx("set.resetConfirm"), tx("set.resetConfirmText"), [
              { text: tx("common.cancel") },
              {
                text: tx("set.resetAction"),
                style: "destructive",
                onPress: async () => {
                  const out = await resetWallet(state);
                  Alert.alert(
                    tx(out.serverDeleted ? "set.resetDone" : "set.resetPartial"),
                    tx(out.serverDeleted ? "set.resetDoneText" : "set.resetPartialText"),
                  );
                  setState(null);
                  setUnlocked(false);
                  router.replace("/welcome");
                },
              },
            ])
          }
        />
      </Card>
    </Screen>
  );
}
