/** Belge detayı: kart üstte → Göster/Sabitle → Bilgiler · Kullanım · Arka planda segmentleri → Sil. Hassas alanlar kapalı gelir. */
import React, { useState } from "react";
import { Alert, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Card, CredentialCard, Pill, Row, Screen, Segment, SensitiveValue, T, useTheme } from "@/ui";
import {
  HIDDEN_META,
  activityOf,
  claimLabel,
  claimText,
  fmtDate,
  issuerNameOf,
  personNameOf,
  typeNameOf,
  useWallet,
} from "@/state/wallet";
import { fmtDateOf, useI18n } from "@/i18n";
import { deleteCredential, friendlyError, save } from "@/wallet";
import { findGatePolicy, startScenario, verifierBaseOf } from "@/features/pass/register";
import { LOW_COPIES } from "@tamga-network/wallet-core";
import { canRefresh, startRefresh } from "@/features/refresh";

const SENSITIVE = new Set(["personal_administrative_number", "document_number"]);
type Tab = "info" | "usage" | "tech";

export default function CredentialDetail() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, setState, session, setBusy } = useWallet();
  const [tab, setTab] = useState<Tab>("info");
  const { t: tx } = useI18n();
  const [openedAt] = useState(() => Math.floor(Date.now() / 1000)); // render saf kalsın (React Compiler)
  const c = state?.credentials.find((x) => x.id === id);
  if (!c || !state)
    return (
      <Screen>
        <T tone="muted">{tx("common.docNotFound")}</T>
      </Screen>
    );
  const hidden = new Set(c.disclosureNames);
  const shown = Object.entries(c.claims).filter(([k]) => !HIDDEN_META.includes(k));
  const left = c.copies.filter((k) => !k.usedBy.length).length;
  const isPinned = (state.settings.pinned ?? []).includes(c.id);
  const isId = c.vct.includes(":id:");
  const togglePin = async () => {
    const cur = state.settings.pinned ?? [];
    const pinned = isPinned ? cur.filter((x) => x !== c.id) : [...cur, c.id].slice(-4); // en fazla 4 sabit
    setState(await save({ ...state, settings: { ...state.settings, pinned } }));
  };
  const usage = activityOf(state).filter((a) => a.credentialId === c.id || a.kind === "presented");
  // ADR-0012 B: bu belge için geçiş kartı (turnike/kapı) — kayıtlı doğrulayıcının proximity politikası varsa bir kez kayıt
  const pass = (state.passes ?? []).find((p) => p.credentialId === c.id && p.validUntil > openedAt);
  const getPass = async () => {
    const base = verifierBaseOf(state.settings.trustBase);
    try {
      const p = await findGatePolicy(base, c.vct);
      if (p) await startScenario(state, base, p, session, setBusy);
      else Alert.alert(tx("cred.noGate"), tx("cred.noGateText"));
    } catch (e) {
      Alert.alert(tx("common.couldNotStart"), friendlyError(e));
    }
  };
  return (
    <Screen>
      <CredentialCard
        typeName={typeNameOf(c)}
        vct={c.vct}
        issuerName={issuerNameOf(c)}
        personName={personNameOf(c)}
        copiesLeft={left}
        copiesTotal={c.copies.length}
        dateText={`${tx("common.issuedOn", { date: fmtDate(c.iat) })}${c.exp ? ` · ${tx("common.validUntil", { date: fmtDate(c.exp) })}` : ""}`}
        live={isId}
        pinned={isPinned}
        status={c.status?.value}
        onPress={() => setTab("info")}
      />
      {c.claims.verification_method === "review-demo" && (
        // ADR-0033: mağaza incelemesi deneme belgesi — gerçek doğrulayıcılar kabul etmez
        <Card tone="warn">
          <T variant="heading">{tx("cred.demoTitle")}</T>
          <T variant="secondary">{tx("cred.demoText")}</T>
        </Card>
      )}
      {(c.status?.value === "revoked" || c.status?.value === "suspended") && (
        <Card tone="danger">
          <T variant="heading" tone="danger">
            {tx(c.status.value === "revoked" ? "cred.revokedTitle" : "cred.suspendedTitle")}
          </T>
          <T variant="secondary">{tx("cred.statusText", { date: fmtDate(c.status.checkedAt) })}</T>
        </Card>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          title={tx("cred.show")}
          icon="qr-code"
          style={{ flex: 1 }}
          onPress={() => router.navigate({ pathname: "/(tabs)/scan", params: { mode: "show" } })}
        />
        {!isId && (
          <Button
            variant="secondary"
            icon={isPinned ? "pin" : "pin-outline"}
            title={isPinned ? tx("cred.unpin") : tx("cred.pin")}
            style={{ flex: 1 }}
            onPress={togglePin}
          />
        )}
      </View>
      {!isId && !pass && (
        <Button
          variant="secondary"
          icon="log-in-outline"
          title={c.vct.includes("Ticket") ? tx("cred.gateTicket") : tx("cred.gateCampus")}
          onPress={() => void getPass()}
        />
      )}
      {c.copies.some((k) => k.mdoc) && (
        <Button
          variant="secondary"
          icon="bluetooth"
          title={tx("cred.proximity")}
          onPress={() => router.push("/proximity")}
        />
      )}
      {pass && (
        <Pill
          text={tx("cred.passReady", { rp: pass.rpName, single: pass.singleUse ? tx("cred.singleUse") : "" })}
          tone="success"
          icon="checkmark-circle"
        />
      )}
      {canRefresh(c) && left <= LOW_COPIES && (
        // D7 / SPEC-WALLET-0001 §4.3: 2 kaldığında bildirim; yenileme HER ZAMAN kullanıcı eylemi (WL7)
        <Card tone="warn">
          <T variant="heading">{left === 0 ? tx("cred.noCopies") : tx("cred.copiesLeft", { n: left })}</T>
          <T variant="secondary">
            {isId ? tx("cred.refreshId") : tx("cred.refreshDoc")} {tx("cred.refreshPrivacy")}
            {(state.passes ?? []).some((pp) => pp.credentialId === c.id) ? tx("cred.refreshPasses") : ""}
          </T>
          <Button
            title={tx("cred.refresh")}
            icon="refresh"
            onPress={() =>
              startRefresh(state, c, session).catch((e) => Alert.alert(tx("common.couldNotRefresh"), friendlyError(e)))
            }
          />
        </Card>
      )}
      <Segment
        value={tab}
        onChange={setTab}
        options={[
          { key: "info", label: tx("cred.tabInfo") },
          { key: "usage", label: tx("cred.tabUsage") },
          { key: "tech", label: tx("cred.tabTech") },
        ]}
      />
      {tab === "info" && (
        <Card>
          {shown.map(([k, v]) =>
            SENSITIVE.has(k) ? (
              <View
                key={k}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: t.line,
                }}
              >
                <T variant="secondary" tone="muted">
                  {claimLabel(k)}
                </T>
                <SensitiveValue value={claimText(v)} />
              </View>
            ) : (
              <Row key={k} k={claimLabel(k)} v={claimText(v)} hidden={hidden.has(k)} />
            ),
          )}
          <T variant="secondary" tone="muted">
            {tx("cred.lockedNote")}
          </T>
        </Card>
      )}
      {tab === "usage" && (
        <Card>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Pill
              text={tx("cred.uses", { left, total: c.copies.length })}
              tone={left === 0 ? "danger" : left <= 2 ? "warn" : "neutral"}
            />
            {c.category && (
              <Pill
                text={c.category.endsWith("qualified") ? tx("cred.accredited") : tx("cred.public")}
                tone={c.category.endsWith("qualified") ? "gold" : "info"}
              />
            )}
            <Pill text={c.statusUri ? tx("cred.revocable") : tx("cred.shortLived")} tone="neutral" />
            {c.copies.some((k) => k.mdoc) && <Pill text={tx("cred.mdoc")} tone="info" />}
          </View>
          <T variant="secondary" tone="muted">
            {tx("cred.copiesNote")}
          </T>
          {usage.length ? (
            usage
              .slice(0, 10)
              .map((a, i) => (
                <Row
                  key={i}
                  k={fmtDateOf(a.ts)}
                  v={`${a.title} · ${a.kind === "presented" ? tx("act.sharedShort") : a.kind === "declined" ? tx("act.declinedShort") : tx("act.receivedShort")}`}
                />
              ))
          ) : (
            <T variant="secondary" tone="muted">
              {tx("cred.notUsed")}
            </T>
          )}
        </Card>
      )}
      {tab === "tech" && (
        <Card>
          <Row k={tx("cred.type")} v={c.vct} />
          <Row k={tx("cred.issuerId")} v={c.issuerId.slice(0, 22) + "…"} />
          <Row k={tx("cred.copies")} v={tx("cred.copiesValue", { n: c.copies.length })} />
          <Row
            k={tx("cred.usedAt")}
            v={
              c.copies
                .filter((k) => k.usedBy.length)
                .map((k) => k.usedBy.join("/"))
                .join(", ") || "—"
            }
          />
          <Row k={tx("cred.cert")} v={c.leafFingerprint.slice(0, 22) + "…"} />
          <Row k={tx("cred.statusList")} v={c.statusUri ? tx("cred.statusYes") : tx("cred.statusNo")} />
        </Card>
      )}
      <Button
        variant="danger"
        icon="trash"
        title={tx("cred.delete")}
        onPress={() =>
          Alert.alert(tx("cred.deleteConfirm"), tx("cred.deleteText"), [
            { text: tx("common.cancel") },
            {
              text: tx("cred.deleteAction"),
              style: "destructive",
              onPress: async () => {
                setState(await deleteCredential(state, c.id));
                router.back();
              },
            },
          ])
        }
      />
    </Screen>
  );
}
