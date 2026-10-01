/**
 * Kontrol ettir (ADR-0012 C — yüz yüze): kayıtlı doğrulayıcının senaryolarından birini seç → cüzdan sunum isteğini kendisi
 * başlatır (standart OpenID4VP) → onay → sunum gönderilir → sonuç bağlantısı QR olarak gösterilir; kontrol eden telefon
 * kamerasıyla okur ve "GEÇERLİ + açıklanan alanlar" görür. Belge içeriği QR'a girmez.
 */
import React, { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card, EmptyState, Pill, Screen, Spinner, T, useTheme } from "@/ui";
import { friendlyError } from "@/wallet";
import { fetchScenarios, startScenario, verifierBaseOf, type Scenario } from "@/features/pass/register";
import { claimLabel, useWallet } from "@/state/wallet";
import { pickLocalized, useI18n } from "@/i18n";

export default function Check() {
  const t = useTheme();
  const { state, setBusy, session } = useWallet();
  const [list, setList] = useState<Scenario[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { t: tx } = useI18n();
  const base = verifierBaseOf(state?.settings.trustBase);
  useEffect(() => {
    fetchScenarios(base)
      .then((j) => setList(j.filter((p) => !p.proximity)))
      .catch((e) => setErr(friendlyError(e)));
  }, [base]);
  const have = new Set((state?.credentials ?? []).map((c) => c.vct));
  const start = (p: Scenario) =>
    state &&
    startScenario(state, base, p, session, setBusy, { check: true }).catch((e) =>
      Alert.alert(tx("common.couldNotStart"), friendlyError(e)),
    );
  if (err)
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title={tx("check.unreachable")} text={err} />
      </Screen>
    );
  if (!list) return <Spinner text={tx("check.loading")} />;
  return (
    <Screen>
      <T variant="display">{tx("check.title")}</T>
      <T tone="muted">{tx("check.text")}</T>
      {list.map((p) => {
        const ok = p.vct_values.some((v) => have.has(v));
        return (
          <Card key={p.policy_id} onPress={ok ? () => void start(p) : undefined}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons
                name={ok ? "checkmark-circle" : "remove-circle-outline"}
                size={22}
                color={ok ? t.success : t.muted}
              />
              <View style={{ flex: 1 }}>
                <T variant="heading">{pickLocalized(p.purpose_localized, p.purpose) ?? p.purpose}</T>
                <T variant="secondary" tone="muted">
                  {p.claims.length
                    ? tx("check.requested", { fields: p.claims.map(claimLabel).join(", ") })
                    : tx("check.noFields")}
                </T>
              </View>
              {ok ? (
                <Ionicons name="chevron-forward" size={18} color={t.muted} />
              ) : (
                <Pill text={tx("check.noCred")} tone="neutral" />
              )}
            </View>
          </Card>
        );
      })}
      <T variant="secondary" tone="muted">
        {tx("check.verifier", { host: base.replace(/^https?:\/\//, "") })}
      </T>
    </Screen>
  );
}
