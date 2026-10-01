/** Kurum sayfası: verebildiği belgeler → "iste" → kurum kimlik sunumu ister (satır içi OpenID4VP) → onay ekranı. */
import React from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Pill, Screen, T, categoryIcon, credentialIcon, hapticError, useTheme } from "@/ui";
import { categoryLabel, typeNameOfVct, useWallet } from "@/state/wallet";
import { useI18n } from "@/i18n";
import { beginInstitutionRequest, hasIdentity } from "@/issuance";
import { friendlyError, type Trace } from "@/wallet";

export default function Institution() {
  const t = useTheme();
  const { slug, refresh } = useLocalSearchParams<{ slug: string; refresh?: string }>();
  const { state, setState, setBusy, session } = useWallet();
  const { t: tx } = useI18n();
  const e = session.get().directory?.find((x) => x.slug === slug);
  if (!e || !state)
    return (
      <Screen>
        <T tone="muted">{tx("inst.notFound")}</T>
      </Screen>
    );
  const ci = categoryIcon(e.category);
  const idOk = hasIdentity(state);
  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: ci.color + "22",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={ci.icon} size={26} color={ci.color} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="title">{e.legalName}</T>
            <T variant="secondary" tone="muted">
              {categoryLabel(e.category)} · {e.assurance}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          <Pill text={tx("common.inTrustList")} tone="success" icon="shield-checkmark" />
          <Pill
            text={e.klass === "QUALIFIED" ? tx("inst.accredited") : tx("inst.public")}
            tone={e.klass === "QUALIFIED" ? "gold" : "neutral"}
          />
        </View>
      </Card>
      <T variant="heading">{tx("inst.available")}</T>
      {e.vcts.map((vct) => (
        <Card key={vct}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name={credentialIcon(vct)} size={24} color={t.accent} />
            <View style={{ flex: 1 }}>
              <T variant="heading">{typeNameOfVct(vct)}</T>
              <T variant="secondary" tone="muted">
                {tx("inst.howItWorks")}
              </T>
            </View>
          </View>
          <Button
            title={tx("inst.request", { type: typeNameOfVct(vct) })}
            disabled={!idOk}
            onPress={async () => {
              const trace: Trace = [];
              session.set({ trace: trace });
              setBusy(tx("inst.applying"));
              try {
                const r = await beginInstitutionRequest(state, e, vct, trace);
                setState(r.state);
                session.set({ review: { model: r.req.review, institution: r.req, refreshOf: refresh } });
                router.push("/review");
              } catch (err) {
                hapticError();
                Alert.alert(tx("inst.applyFailed"), friendlyError(err));
              } finally {
                setBusy(null);
              }
            }}
          />
        </Card>
      ))}
      {!idOk && (
        <Card tone="warn">
          <T>{tx("inst.needId")}</T>
          <Button
            variant="ghost"
            title={tx("common.verifyIdentity")}
            icon="id-card"
            onPress={() => router.push("/identity")}
          />
        </Card>
      )}
      <T variant="secondary" tone="muted">
        {tx("inst.matching")}
      </T>
    </Screen>
  );
}
