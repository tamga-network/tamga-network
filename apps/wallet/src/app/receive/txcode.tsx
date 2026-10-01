/** Davet → portalda görünen 6 haneli tx_code → belge alma (10 kopya). */
import React from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { Card, PinPad, Screen, T, hapticError, hapticSuccess } from "@/ui";
import { typeNameOfVct, useWallet } from "@/state/wallet";
import { useI18n } from "@/i18n";
import { friendlyError, receive } from "@/wallet";

export default function TxCode() {
  const { state, setState, session } = useWallet();
  const { t: tx } = useI18n();
  const o = session.get().offer;
  if (!o || !state)
    return (
      <Screen>
        <T tone="muted">{tx("tx.notFound")}</T>
      </Screen>
    );
  return (
    <Screen>
      <Card>
        <T variant="title">{typeNameOfVct(o.offer.credential_configuration_ids[0])}</T>
        <T variant="secondary" tone="muted">
          {tx("tx.from", { host: o.issuerHost })}
        </T>
      </Card>
      <T tone="muted">{tx("tx.help")}</T>
      <PinPad
        label={tx("tx.label")}
        onDone={async (code) => {
          const trace = session.get().trace ?? [];
          session.set({ trace, progressText: tx("tx.progress") });
          router.push("/receive/progress");
          try {
            const r = await receive(state, o.offer, code, trace);
            setState(r.state);
            session.set({ receivedId: r.credentialId });
            hapticSuccess();
            router.replace("/receive/done");
          } catch (e) {
            hapticError();
            router.back();
            Alert.alert(tx("common.couldNotReceive"), friendlyError(e));
            return friendlyError(e);
          }
        }}
      />
    </Screen>
  );
}
