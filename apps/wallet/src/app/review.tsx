/**
 * Sunum onayı (modal). WL8: kayıtsız doğrulayıcı → kırmızı rozet + gecikmeli düğme; kapsam dışı → ayrı kırmızı blok.
 * institution: kurum belge verirken satır içi kimlik sunumu (ADR-0011 K3). WL11: PIN/Face ID.
 */
import React, { useState } from "react";
import { Alert, Linking, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Chip, DelayedButton, Pill, Row, Screen, T, hapticError, hapticSuccess, useTheme } from "@/ui";
import { claimLabel, claimText, fmtDate, personNameOf, typeNameOf, typeNameOfVct, useWallet } from "@/state/wallet";
import { pickLocalized, useI18n } from "@/i18n";
import { dpaChannels, reportToDpa } from "@/features/rights";
import {
  chooseAlternative,
  choosePseudonym,
  declinePresentation,
  logFailedPresentation,
  sendPresentation,
} from "@/present";
import { completeInstitutionRequest } from "@/issuance";
import { friendlyError } from "@/wallet";
import { applyRefresh, canRefresh, startRefresh } from "@/features/refresh";

export default function Review() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { state, setState, confirmUser, session } = useWallet();
  const [reuse, setReuse] = useState(false); // D7 (b): kullanıcı korelasyon uyarısını kabul etti
  const { t: tx } = useI18n();
  const r = session.get().review;
  const [chosen, setChosen] = useState(r?.model); // OIA_11: kullanıcı aynı türden başka bir belgeyi seçebilir
  if (!r || !state)
    return (
      <Screen>
        <T tone="muted">{tx("rev.nothing")}</T>
        <Button title={tx("common.close")} onPress={() => router.back()} />
      </Screen>
    );
  const { institution: inst } = r;
  const m = chosen ?? r.model;
  const alts = inst || !m.match ? [] : (m.match.alternatives ?? []);
  // ADR-0031: takma ad — değer gösterilmez; yalnız "yeni / daha önce kullandığın" ve kullanıcının verdiği ad
  const ps = m.pseudonym;
  const psLabel = ps && ps.choice !== "new" ? ps.active.find((p) => p.index === ps.choice)?.label : undefined;
  const risky = m.rp.overAsk.length > 0 || !m.rp.registered;
  const decline = async () => {
    setState(await declinePresentation(state, m));
    session.set({ review: undefined });
    router.back();
  };
  return (
    <Screen style={{ paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T variant="title">{inst ? tx("rev.titleId") : tx("rev.titleDoc")}</T>
        <Button
          variant="ghost"
          title={tx("common.cancel")}
          onPress={decline}
          style={{ minHeight: 40, paddingVertical: 8 }}
        />
      </View>
      {inst && (
        <Card tone="gold">
          <T>{tx("rev.inst", { name: inst.entry.legalName, type: typeNameOfVct(inst.vct) })}</T>
        </Card>
      )}
      <Card tone={m.rp.registered ? (m.rp.active ? "default" : "warn") : "danger"}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Ionicons
            name={m.rp.registered ? "shield-checkmark" : "warning"}
            size={28}
            color={m.rp.registered ? t.success : t.danger}
          />
          <View style={{ flex: 1 }}>
            <T variant="heading">{m.rp.tradeName ?? m.rp.legalName ?? m.request.rpKey}</T>
            {m.rp.tradeName && m.rp.legalName && m.rp.tradeName !== m.rp.legalName && (
              <T variant="secondary" tone="muted">
                {m.rp.legalName}
              </T>
            )}
            {m.rp.via && (
              <T variant="secondary" tone="muted">
                {tx("rev.via", { name: m.rp.via })}
              </T>
            )}
            {m.rp.purpose && (
              <T variant="secondary" tone="muted">
                {tx("rev.purpose", { purpose: pickLocalized(m.rp.purposeLocalized, m.rp.purpose) ?? m.rp.purpose })}
              </T>
            )}
            {/* ADR-0024 / ARF RPA_10: kullanımın gizlilik politikası */}
            {m.rp.registered &&
              (m.rp.privacyPolicy?.startsWith("https://") ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(m.rp.privacyPolicy!)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}
                >
                  <Ionicons name="document-text-outline" size={14} color={t.accent} />
                  <T variant="secondary" style={{ color: t.accent }}>
                    {tx("rev.privacy")}
                  </T>
                </Pressable>
              ) : (
                <T variant="secondary" tone="muted">
                  {tx("rev.noPrivacy")}
                </T>
              ))}
          </View>
        </View>
        {m.rp.registered ? (
          <Pill text={m.rp.active ? tx("rev.listed") : tx("rev.inactive")} tone={m.rp.active ? "success" : "warn"} />
        ) : (
          <Pill text={tx("rev.unregistered")} tone="danger" icon="alert-circle" />
        )}
        {!m.rp.registered && <T tone="danger">{tx("rev.unregisteredText")}</T>}
        {m.rp.registered && m.rp.certMatches === false && (
          <T variant="secondary" tone="danger">
            {tx("rev.certMismatch")}
          </T>
        )}
      </Card>
      {alts.length > 1 && (
        <Card>
          <T variant="heading">{tx("rev.chooseTitle")}</T>
          <T variant="secondary" tone="muted">
            {tx("rev.chooseText", { n: alts.length })}
          </T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {alts.map((a) => (
              <Chip
                key={a.credential.id}
                label={personNameOf(a.credential) || tx("common.issuedOn", { date: fmtDate(a.credential.iat) })}
                active={a.credential.id === m.match?.credential.id}
                onPress={() => {
                  setReuse(false);
                  setChosen(chooseAlternative(m, a.credential.id));
                }}
              />
            ))}
          </View>
        </Card>
      )}
      {m.match && (
        <Card>
          <T variant="heading">{typeNameOf(m.match.credential)}</T>
          <T variant="secondary" tone="muted">
            {tx("rev.fieldsIntro")}
          </T>
          {m.match.requested.map((n) => (
            <Row key={n} k={claimLabel(n)} v={claimText(m.values[n])} />
          ))}
          {m.match.missing.length > 0 && (
            <T variant="secondary" tone="muted">
              {tx("rev.missing", { fields: m.match.missing.map(claimLabel).join(", ") })}
            </T>
          )}
        </Card>
      )}
      {ps && (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="person-circle-outline" size={22} color={t.accent} />
            <T variant="heading">{tx("rev.pseudoTitle")}</T>
          </View>
          {!ps.hasSeed ? (
            <T tone="danger">{tx("rev.pseudoNoSeed")}</T>
          ) : (
            <>
              <T>
                {ps.choice === "new"
                  ? tx("rev.pseudoNew")
                  : tx("rev.pseudoExisting", { label: psLabel ? ` (“${psLabel}”)` : "" })}
              </T>
              {ps.mode === "multiple" && ps.active.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {ps.active.map((p) => (
                    <Chip
                      key={p.index}
                      label={p.label ?? tx("ps.unnamed")}
                      active={ps.choice === p.index}
                      onPress={() => setChosen(choosePseudonym(m, p.index))}
                    />
                  ))}
                  <Chip
                    label={tx("rev.pseudoNewChip")}
                    icon="add"
                    active={ps.choice === "new"}
                    onPress={() => setChosen(choosePseudonym(m, "new"))}
                  />
                </View>
              )}
            </>
          )}
          <T variant="secondary" tone="muted">
            {tx("rev.pseudoHelp")}
          </T>
        </Card>
      )}
      {/* TS8 / RPT_DPA_01: şüpheli istek hemen bildirilebilir (kayıtsız ya da kapsam dışı alan isteyen doğrulayıcı) */}
      {risky && (
        <Button
          variant="ghost"
          icon="flag-outline"
          title={tx("rights.report")}
          onPress={() => {
            const chans = dpaChannels(m.rp.supervisoryAuthority);
            const c = chans[0];
            if (!c) return;
            void reportToDpa(
              state,
              {
                ts: Date.now(),
                clientId: m.request.rpKey,
                vct: m.match?.credential.vct ?? "tamga-pseudonym",
                disclosed: m.match?.requested ?? [],
                outcome: "declined",
              },
              m.rp.tradeName ?? m.rp.legalName ?? m.request.rpKey,
              m.rp.supervisoryAuthority,
              c,
            ).then(setState);
          }}
        />
      )}
      {m.rp.overAsk.length > 0 && (
        <Card tone="danger">
          <T variant="heading" tone="danger">
            {tx("rev.overTitle")}
          </T>
          <T>
            {tx("rev.overText")} <T variant="heading">{m.rp.overAsk.map(claimLabel).join(", ")}</T>.{" "}
            {tx("rev.overTail")}
          </T>
        </Card>
      )}
      {m.match && m.plan?.kind === "exhausted" && !reuse && (
        <Card tone="warn">
          <T variant="heading">{tx("rev.exhaustedTitle")}</T>
          <T variant="secondary">{tx("rev.exhaustedText")}</T>
          {m.match && canRefresh(m.match.credential) && (
            <Button
              title={tx("cred.refresh")}
              icon="refresh"
              onPress={() => {
                const cred = m.match!.credential;
                session.set({ review: undefined });
                router.back();
                startRefresh(state, cred, session).catch((e) =>
                  Alert.alert(tx("common.couldNotRefresh"), friendlyError(e)),
                );
              }}
            />
          )}
          {m.plan?.kind === "exhausted" && m.plan.reuse && (
            <Button
              variant="secondary"
              title={tx("rev.reuse")}
              onPress={() => {
                const seen = m.plan?.kind === "exhausted" ? (m.plan.reuse?.seenBy.length ?? 0) : 0;
                Alert.alert(tx("rev.reuseTitle"), tx("rev.reuseText", { n: seen }), [
                  { text: tx("common.cancel"), style: "cancel" },
                  { text: tx("rev.reuseAnyway"), style: "destructive", onPress: () => setReuse(true) },
                ]);
              }}
            />
          )}
        </Card>
      )}
      {reuse && <Pill text={tx("rev.reusePill")} tone="warn" icon="alert-circle" />}
      <DelayedButton
        title={inst ? tx("rev.presentId") : tx("rev.share")}
        icon="finger-print"
        delayMs={risky ? 3000 : 0}
        disabled={(!!m.match && !m.copyRef && !reuse) || (!!ps && !ps.hasSeed)}
        onPress={async () => {
          if (!(await confirmUser(inst ? tx("rev.confirmId") : tx("rev.confirmDoc")))) return;
          const trace = session.get().trace ?? [];
          session.set({ trace: trace });
          if (inst) {
            session.set({ progressText: tx("rev.progressId") });
            router.replace("/receive/progress");
            try {
              const res = await completeInstitutionRequest(state, inst, trace);
              // D7: bu istek bir yenilemeyse eski belge yerini yenisine bırakır
              const ref = await applyRefresh(res.state, r?.refreshOf, res.credentialId);
              setState(ref.state);
              session.set({ receivedId: res.credentialId, changedFields: ref.changed });
              hapticSuccess();
              router.replace("/receive/done");
            } catch (e) {
              hapticError();
              Alert.alert(tx("common.couldNotReceive"), friendlyError(e));
              router.dismissAll();
            }
            return;
          }
          session.set({ progressText: tx("rev.progressDoc") });
          router.replace("/receive/progress");
          try {
            const reuseKeyRef = reuse && m.plan?.kind === "exhausted" ? m.plan.reuse?.keyRef : undefined;
            const res = await sendPresentation(state, m, trace, { reuseKeyRef });
            setState(res.state);
            session.set({
              sent: {
                model: m,
                redirectUri: res.redirectUri,
                passGranted: res.passGranted,
                check: r.check,
                showUrl: res.showUrl,
              },
            });
            hapticSuccess();
            router.replace("/sent");
          } catch (e) {
            hapticError();
            setState(await logFailedPresentation(state, m).catch(() => state));
            Alert.alert(tx("rev.sendFailed"), friendlyError(e));
            router.dismissAll();
          }
        }}
      />
    </Screen>
  );
}
