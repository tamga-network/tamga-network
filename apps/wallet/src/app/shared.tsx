/**
 * Paylaştığım kurumlar (ARF DASH_02/03; AB TS7/TS8): cihazdaki sunum günlüğü doğrulayıcıya göre — kurum adı ve kayıt durumu
 * (imzalı güven listesinden), son paylaşım, sayı, paylaşılan alan ADLARI (değer yok, WL4), bu sitedeki takma ad (ADR-0031) ve
 * her istek. Eylemler: kurumdan silme talebi (TS7) ve veri koruma kurumuna bildirim (TS8) — Geçmiş ekranıyla aynı akışlar.
 */
import React, { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import {
  PROXIMITY_RP_KEY,
  sharedWith,
  type PresentationLogEntry,
  type RpRecord,
  type SharedParty,
} from "@tamga-network/wallet-core";
import { Button, Card, Collapsible, EmptyState, Pill, Row, Screen, T } from "@/ui";
import { claimLabel, typeNameOfVct, useWallet } from "@/state/wallet";
import { dpaChannels, reportToDpa, requestDeletion, rpChannels, rpRecordFor, type Channel } from "@/features/rights";
import { fmtDateOf, fmtDateTimeOf, useI18n } from "@/i18n";

/** Güven listesinden okunan kayıt: bulundu, listede yok ya da (ağ / imza hatası) denetlenemedi. */
type Lookup = { kind: "registered"; rec: RpRecord } | { kind: "missing" } | { kind: "unchecked" };

const OUTCOME = {
  sent: { label: "hist.presented", tone: "success" },
  declined: { label: "hist.declined", tone: "neutral" },
  error: { label: "hist.failed", tone: "warn" },
} as const;

export default function SharedWith() {
  const { state, setState } = useWallet();
  const { t: tx } = useI18n();
  const parties = state ? sharedWith(state) : [];
  const keys = parties.map((p) => p.key).join("|");
  const [lookup, setLookup] = useState<Record<string, Lookup>>({});

  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, Lookup> = {};
      for (const p of parties) {
        if (p.key === PROXIMITY_RP_KEY) continue;
        try {
          const rec = await rpRecordFor(state, p.key);
          next[p.key] = rec && rec.status === "ACTIVE" ? { kind: "registered", rec } : { kind: "missing" };
        } catch {
          next[p.key] = { kind: "unchecked" };
        }
      }
      if (!cancelled) setLookup(next);
    })();
    return () => {
      cancelled = true;
    };
    // Kayıtlar yalnız doğrulayıcı listesi değişince yeniden okunur.
  }, [keys]);

  if (!state) return null;

  const nameOf = (p: SharedParty) => {
    if (p.key === PROXIMITY_RP_KEY) return tx("sw.proximity");
    const l = lookup[p.key];
    if (l?.kind === "registered") return l.rec.trade_name ?? l.rec.legal_name;
    return p.pseudonyms[0]?.siteName ?? p.domain ?? p.key.split(":").pop() ?? p.key;
  };

  /** TS7 / TS8: kanal kayıttan (web / e-posta / telefon); kayıt yoksa bildirim ulusal kuruma. */
  const pick = (title: string, chans: Channel[], go: (c: Channel) => Promise<void>) => {
    if (!chans.length) return Alert.alert(title, tx("rights.noChannel"));
    Alert.alert(title, tx("rights.chooseChannel"), [
      ...chans.slice(0, 2).map((c) => ({ text: tx(`rights.ch.${c.kind}`), onPress: () => void go(c) })),
      { text: tx("common.cancel"), style: "cancel" as const },
    ]);
  };
  /** Talebe eklenecek özet: son paylaşım (yoksa yalnız doğrulayıcı ve son etkinlik zamanı — alan yok). */
  const entryOf = (p: SharedParty): PresentationLogEntry =>
    p.shares[0] ?? { ts: p.lastActivityAt, clientId: p.key, vct: "", disclosed: [], outcome: "sent" };

  return (
    <Screen>
      <T variant="secondary" tone="muted">
        {tx("sw.help")}
      </T>
      {parties.length === 0 ? (
        <EmptyState icon="business-outline" title={tx("sw.emptyTitle")} text={tx("sw.emptyText")} />
      ) : (
        parties.map((p) => {
          const l = lookup[p.key];
          const rec = l?.kind === "registered" ? l.rec : undefined;
          const name = nameOf(p);
          const proximity = p.key === PROXIMITY_RP_KEY;
          return (
            <View key={p.key} style={{ gap: 8 }}>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <T variant="heading" numberOfLines={1}>
                      {name}
                    </T>
                    {p.domain && p.domain !== name ? (
                      <T variant="secondary" tone="muted" numberOfLines={1}>
                        {p.domain}
                      </T>
                    ) : null}
                  </View>
                  {!proximity && l ? (
                    <Pill
                      text={tx(
                        l.kind === "registered"
                          ? "sw.registered"
                          : l.kind === "missing"
                            ? "sw.unregistered"
                            : "sw.unchecked",
                      )}
                      tone={l.kind === "registered" ? "success" : l.kind === "missing" ? "warn" : "neutral"}
                      icon={l.kind === "registered" ? "shield-checkmark" : undefined}
                    />
                  ) : null}
                </View>
                <Row k={tx("sw.lastShared")} v={p.lastSharedAt ? fmtDateTimeOf(p.lastSharedAt) : tx("sw.notShared")} />
                <Row k={tx("sw.count")} v={String(p.sentCount)} />
                {p.fields.length ? <Row k={tx("sw.fields")} v={p.fields.map(claimLabel).join(", ")} /> : null}
                {p.pseudonyms.map((ps) => (
                  <Row
                    key={ps.index}
                    k={tx("sw.pseudonym")}
                    v={`${ps.label || tx("ps.unnamed")} · ${fmtDateOf(ps.createdAt)}`}
                  />
                ))}
                {!proximity && (
                  <View style={{ gap: 8, marginTop: 4 }}>
                    <Button
                      variant="secondary"
                      icon="mail-outline"
                      title={tx("rights.delete")}
                      onPress={() =>
                        pick(tx("rights.delete"), rpChannels(rec?.contact), async (c) =>
                          setState(await requestDeletion(state, entryOf(p), name, c)),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      icon="flag-outline"
                      title={tx("rights.report")}
                      onPress={() =>
                        pick(tx("rights.report"), dpaChannels(rec?.supervisory_authority), async (c) =>
                          setState(await reportToDpa(state, entryOf(p), name, rec?.supervisory_authority, c)),
                        )
                      }
                    />
                  </View>
                )}
              </Card>
              {p.shares.length || p.requests.length ? (
                <Collapsible title={tx("sw.history")}>
                  {p.shares.map((s) => (
                    <View key={`s${s.ts}`} style={{ gap: 4, marginTop: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                        <T variant="secondary" style={{ flex: 1 }}>
                          {fmtDateTimeOf(s.ts)} · {typeNameOfVct(s.vct, s.vct)}
                        </T>
                        <Pill text={tx(OUTCOME[s.outcome].label)} tone={OUTCOME[s.outcome].tone} />
                      </View>
                      {s.disclosed.length ? (
                        <T variant="secondary" tone="muted">
                          {s.disclosed.map(claimLabel).join(", ")}
                        </T>
                      ) : null}
                    </View>
                  ))}
                  {p.requests.length ? (
                    <View style={{ gap: 4, marginTop: 12 }}>
                      <T variant="heading">{tx("sw.requests")}</T>
                      {p.requests.map((r) => (
                        <T key={`r${r.ts}`} variant="secondary" tone="muted">
                          {tx(r.kind === "deletion_request" ? "sw.reqDeletion" : "sw.reqReport", {
                            date: fmtDateOf(r.ts),
                          })}
                        </T>
                      ))}
                    </View>
                  ) : null}
                </Collapsible>
              ) : null}
            </View>
          );
        })
      )}
    </Screen>
  );
}
