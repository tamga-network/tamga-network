/**
 * Göster (ADR-0012 B): kayıtlı RP geçiş kartı varsa 60 sn'lik imzalı QR (kişisel veri yok) + canlı saat + geri sayım;
 * yoksa yer tutucu ve "kayıt" yönlendirmesi. Her gösterim geçmişe yazılır (WL14). Rıza geri alınabilir (WL13).
 */
import React, { useEffect, useState } from "react";
import { Alert, Share, View } from "react-native";
import { router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { mintPassToken, type PassGrant } from "@tamga-network/wallet-core";
import { Button, Card, CredentialCard, EmptyState, LiveBadge, Pill, QrArea, Screen, T, useTheme } from "@/ui";
import { fmtDate, issuerNameOf, personNameOf, typeNameOf, useWallet } from "@/state/wallet";
import { useI18n } from "@/i18n";
import { identityOf } from "@/issuance";
import { keys, randomBytes } from "@/platform";
import { save } from "@/wallet";

export function ShowPane() {
  const t = useTheme();
  const { state, setState } = useWallet();
  const { t: tx } = useI18n();
  const [nowSec] = useState(() => Math.floor(Date.now() / 1000)); // render saf kalsın; ekran açılış anı yeter
  const passes = (state?.passes ?? []).filter(
    (p) => p.validUntil > nowSec && state?.credentials.some((c) => c.id === p.credentialId),
  );
  const [sel, setSel] = useState(0);
  const grant: PassGrant | undefined = passes[Math.min(sel, Math.max(0, passes.length - 1))];
  const cred = grant
    ? state?.credentials.find((c) => c.id === grant.credentialId)
    : state
      ? identityOf(state)
      : undefined;
  const [qr, setQr] = useState<{ token: string; exp: number; passId: string } | null>(null);
  const [left, setLeft] = useState(0);

  // Jeton üret; süresi 10 sn kala yenile; her yeni jeton = bir gösterim kaydı.
  useEffect(() => {
    if (!grant || !state) return;
    let cancelled = false;
    let logged = false; // WL14: kayıt ekran açılışında bir kez; 60 sn yenilemeleri kaydı şişirmesin
    const mint = async () => {
      try {
        const out = await mintPassToken(grant, keys, randomBytes);
        if (cancelled) return;
        setQr({ ...out, passId: grant.passId });
        if (logged) return;
        logged = true;
        setState(
          await save({
            ...state,
            presentationLog: [
              ...state.presentationLog,
              { ts: Date.now(), clientId: grant.rpClientId, vct: "urn:tamga:pass", disclosed: [], outcome: "sent" },
            ],
          }),
        );
      } catch (e) {
        if (!cancelled) Alert.alert(tx("show.passFailed"), (e as Error).message);
      }
    };
    void mint();
    const id = setInterval(() => {
      setQr((cur) => {
        if (cur && cur.exp - Math.floor(Date.now() / 1000) <= 10) void mint();
        return cur;
      });
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [grant?.passId]);

  useEffect(() => {
    const id = setInterval(() => setLeft(qr ? Math.max(0, qr.exp - Math.floor(Date.now() / 1000)) : 0), 500);
    return () => clearInterval(id);
  }, [qr]);

  if (!state || !cred)
    return (
      <Screen>
        <EmptyState
          icon="id-card-outline"
          title={tx("show.emptyTitle")}
          text={tx("show.emptyText")}
          action={{ title: tx("common.verifyIdentity"), onPress: () => router.push("/identity") }}
        />
      </Screen>
    );

  const revoke = () =>
    Alert.alert(tx("show.revokeTitle"), tx("show.revokeText", { rp: grant?.rpName ?? tx("show.institution") }), [
      { text: tx("common.cancel") },
      {
        text: tx("show.revokeAction"),
        style: "destructive",
        onPress: async () => {
          if (!grant) return;
          setState(await save({ ...state, passes: (state.passes ?? []).filter((p) => p.passId !== grant.passId) }));
          setSel(0);
        },
      },
    ]);

  return (
    <Screen>
      <CredentialCard
        typeName={grant ? tx("show.passName", { rp: grant.rpName }) : typeNameOf(cred)}
        vct={cred.vct}
        issuerName={grant ? issuerNameOf(cred) : issuerNameOf(cred)}
        personName={personNameOf(cred)}
        copiesLeft={cred.copies.filter((k) => !k.usedBy.length).length}
        copiesTotal={cred.copies.length}
        dateText={
          grant
            ? tx("show.passUntil", { date: fmtDate(grant.validUntil) })
            : cred.exp
              ? tx("common.validUntil", { date: fmtDate(cred.exp) })
              : tx("common.issuedOn", { date: fmtDate(cred.iat) })
        }
        live
        onPress={() => router.push({ pathname: "/credential/[id]", params: { id: cred.id } })}
      />
      {grant && qr && qr.passId === grant.passId ? (
        <QrArea ready note={grant.singleUse ? tx("show.noteSingle", { s: left }) : tx("show.noteMulti", { s: left })}>
          <QRCode value={qr.token} size={200} backgroundColor="#FFFFFF" color="#17110F" ecl="M" />
        </QrArea>
      ) : null}
      {grant && qr && qr.passId === grant.passId ? (
        // Yedek yol: kamerasız terminal (demo). Jeton 60 sn geçerli, kişisel veri taşımaz; paylaşmak zararsızdır.
        <Button
          title={tx("show.shareToken")}
          variant="secondary"
          icon="share-outline"
          onPress={() => void Share.share({ message: qr.token })}
        />
      ) : (
        <QrArea ready={false} note={tx("show.noPass")} />
      )}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pill text={tx("show.noPersonal")} tone="success" />
          <T variant="secondary" tone="muted" style={{ flex: 1 }}>
            {grant ? tx("show.passNote", { group: grant.terminalGroup }) : tx("show.noPassNote")}
          </T>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <LiveBadge />
          {grant && (
            <T variant="secondary" tone="muted">
              {tx("common.seconds", { n: left })}
            </T>
          )}
        </View>
      </Card>
      {passes.length > 1 && (
        <Button
          variant="secondary"
          icon="swap-horizontal"
          title={tx("show.switch", { i: sel + 1, n: passes.length })}
          onPress={() => setSel((sel + 1) % passes.length)}
        />
      )}
      {grant ? (
        <Button variant="ghost" icon="close-circle-outline" title={tx("show.revoke")} onPress={revoke} />
      ) : (
        <Button
          variant="secondary"
          icon="scan"
          title={tx("show.scanInst")}
          onPress={() => router.setParams({ mode: "scan" })}
        />
      )}
      <Button variant="secondary" icon="people" title={tx("show.check")} onPress={() => router.push("/check")} />
      <T variant="secondary" tone="muted" center style={{ color: t.muted }}>
        {tx("show.phase1")}
      </T>
    </Screen>
  );
}
