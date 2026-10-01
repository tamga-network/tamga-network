/** Belge eklendi: özet kart + "arka planda ne oldu" (katlanır) → Bitti. */
import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Collapsible, Pill, Screen, StepList, T, useTheme } from "@/ui";
import { claimLabel, personNameOf, typeNameOf, useWallet } from "@/state/wallet";
import { useI18n } from "@/i18n";

export default function Done() {
  const t = useTheme();
  const { state, session } = useWallet();
  const { t: tx } = useI18n();
  const c = state?.credentials.find((x) => x.id === session.get().receivedId);
  const finish = () => {
    session.set({ receivedId: undefined, changedFields: undefined });
    router.dismissAll();
  };
  const changed = session.get().changedFields ?? [];
  if (!c)
    return (
      <Screen>
        <T tone="muted">{tx("common.docNotFound")}</T>
        <Button title={tx("common.done")} onPress={finish} />
      </Screen>
    );
  return (
    <Screen>
      <View style={{ alignItems: "center", gap: 8, paddingVertical: 12 }}>
        <Ionicons name="checkmark-circle" size={64} color={t.success} />
        <T variant="display" center>
          {tx("done.title")}
        </T>
      </View>
      <Card tone={c.vct.includes(":id:") ? "gold" : "success"}>
        <T variant="title">{typeNameOf(c)}</T>
        <T>{personNameOf(c)}</T>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
          <Pill text={tx("done.localOk")} tone="success" icon="shield-checkmark" />
          <Pill text={tx("cred.uses", { left: c.copies.length, total: c.copies.length })} />
        </View>
      </Card>
      {changed.length > 0 && (
        <Card tone="warn">
          <T variant="heading">{tx("done.changedTitle")}</T>
          <T variant="secondary">{tx("done.changedText", { fields: changed.map(claimLabel).join(", ") })}</T>
        </Card>
      )}
      <Button title={tx("common.done")} onPress={finish} />
      {c.vct.includes("Ticket") && (
        // D10: bilet → kapı için geçiş kartı (bir kez; sonra Göster). Aynı akış belge sayfasında da var.
        <Button
          variant="secondary"
          icon="log-in-outline"
          title={tx("cred.gateTicket")}
          onPress={() => {
            const id = c.id;
            session.set({ receivedId: undefined });
            router.dismissAll();
            router.push({ pathname: "/credential/[id]", params: { id } });
          }}
        />
      )}
      <Button
        variant="ghost"
        title={tx("done.inspect")}
        onPress={() => {
          const id = c.id;
          router.dismissAll();
          router.push({ pathname: "/credential/[id]", params: { id } });
        }}
      />
      <Collapsible title={tx("common.backgroundTrace")}>
        <StepList steps={session.get().trace ?? []} />
      </Collapsible>
    </Screen>
  );
}
