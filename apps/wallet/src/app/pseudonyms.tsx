/**
 * Ayarlar → Takma adlarım (ADR-0031 K5; ARF Topic 11 PA_05–PA_10): Tamga ile giriş yapılan her site için takma ad — site adı,
 * oluşturulma ve son kullanım tarihi, kullanıcının verdiği ad (yalnız cihazda; siteye gitmez — PA_19), sil (PA_07). Takma ad
 * değeri ve anahtarı gösterilmez: değer yalnız siteye gider, anahtar her sunumda tohumdan yeniden türetilir.
 */
import React from "react";
import { Alert, View } from "react-native";
import { activePseudonyms, deletePseudonym, renamePseudonym, type PseudonymEntry } from "@tamga-network/wallet-core";
import { Button, Card, EmptyState, Field, Row, Screen, T } from "@/ui";
import { useWallet } from "@/state/wallet";
import { save } from "@/wallet";
import { fmtDateOf, useI18n } from "@/i18n";

export default function Pseudonyms() {
  const { state, setState } = useWallet();
  const { t: tx } = useI18n();
  if (!state) return null;
  const sites = [...new Set((state.pseudonyms ?? []).map((p) => p.rpKey))];
  const list: PseudonymEntry[] = sites.flatMap((rp) => activePseudonyms(state, rp));
  const apply = async (next: typeof state) => setState(await save(next));
  return (
    <Screen>
      <T variant="secondary" tone="muted">
        {tx("ps.help")}
      </T>
      {list.length === 0 ? (
        <EmptyState icon="person-circle-outline" title={tx("ps.title")} text={tx("ps.empty")} />
      ) : (
        list.map((p) => (
          <Card key={`${p.rpKey}#${p.index}`}>
            <T variant="heading">{p.siteName ?? p.rpKey.split(":").pop()}</T>
            <Row k={tx("ps.created")} v={fmtDateOf(p.createdAt)} />
            {p.lastUsedAt && <Row k={tx("ps.lastUsed")} v={fmtDateOf(p.lastUsedAt)} />}
            <Field
              label={tx("ps.rename")}
              value={p.label ?? ""}
              placeholder={tx("ps.renamePh")}
              maxLength={60}
              onCommit={(v) => apply(renamePseudonym(state, p.rpKey, p.index, v))}
            />
            <View>
              <Button
                variant="ghost"
                icon="trash-outline"
                title={tx("ps.delete")}
                onPress={() =>
                  Alert.alert(tx("ps.deleteTitle"), tx("ps.deleteText"), [
                    { text: tx("common.cancel"), style: "cancel" },
                    {
                      text: tx("ps.delete"),
                      style: "destructive",
                      onPress: () => void apply(deletePseudonym(state, p.rpKey, p.index)),
                    },
                  ])
                }
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
