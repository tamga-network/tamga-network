/**
 * Yüz yüze göster (P4-3; ISO/IEC 18013-5, ARF ProxId_*): QR → okuyucu Bluetooth ile bağlanır → istenen alanlar kişiye
 * gösterilir, kişi göndermek istemediklerini kapatır → PIN/Face ID (WL11) → yalnız seçilenler gider. Okuyucu kimliği bu
 * sürümde doğrulanmaz (reader authentication yok) — ekran bunu açıkça söyler. Expo Go'da yerel modül yok: bilgi kartı.
 */
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { Button, Card, Chip, EmptyState, QrArea, Screen, Spinner, T, hapticError, hapticSuccess } from "@/ui";
import { claimLabel, typeNameOfVct, useWallet } from "@/state/wallet";
import { t, useI18n } from "@/i18n";
import { keys, randomBytes } from "@/platform";
import { bleTransport, ensureBlePermission, proximityAvailable } from "@/features/proximity";
import { presentProximity, type ProximityRequestView } from "@tamga-network/wallet-core";

type Phase =
  | { k: "idle" }
  | { k: "qr"; qr?: string }
  | { k: "consent"; view: ProximityRequestView; resolve: (chosen: string[] | null) => void }
  | { k: "sending" }
  | { k: "done"; fields: string[] }
  | { k: "declined" }
  | { k: "error"; reason: string };

export default function Proximity() {
  const { state, setState, confirmUser } = useWallet();
  const { t: tx } = useI18n();
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [off, setOff] = useState<string[]>([]);
  const running = useRef(false);
  const pending = useRef<((chosen: string[] | null) => void) | null>(null);

  // ekrandan çıkılırsa bekleyen onay ret sayılır, yayın durur
  useEffect(
    () => () => {
      pending.current?.(null);
      if (proximityAvailable) void bleTransport().stop();
    },
    [],
  );

  if (!state) return null;
  if (!proximityAvailable)
    return (
      <Screen>
        <EmptyState icon="bluetooth" title={tx("prox.unavailableTitle")} text={tx("prox.unavailableText")} />
      </Screen>
    );

  const start = async () => {
    if (running.current) return;
    if (!(await ensureBlePermission())) return setPhase({ k: "error", reason: tx("prox.noPermission") });
    running.current = true;
    setOff([]);
    setPhase({ k: "qr" });
    const r = await presentProximity({
      transport: bleTransport(),
      state,
      keys,
      randomBytes,
      onQr: (qr) => setPhase({ k: "qr", qr }),
      approve: (view) =>
        new Promise((resolve) => {
          pending.current = (c) => {
            pending.current = null;
            resolve(c);
          };
          hapticSuccess();
          setPhase({ k: "consent", view, resolve: pending.current });
        }),
    });
    running.current = false;
    setState(r.state);
    if (r.outcome === "sent") {
      hapticSuccess();
      setPhase({ k: "done", fields: r.state.presentationLog.at(-1)?.disclosed ?? [] });
    } else if (r.outcome === "declined") setPhase({ k: "declined" });
    else {
      hapticError();
      setPhase({ k: "error", reason: errorText(r.reason) });
    }
  };

  const send = async (p: Extract<Phase, { k: "consent" }>) => {
    const chosen = p.view.requested.filter((e) => !off.includes(e) && !p.view.missing.includes(e));
    if (!(await confirmUser(tx("prox.confirm")))) return; // WL11 — onay yoksa ekranda kalır
    setPhase({ k: "sending" });
    p.resolve(chosen);
  };

  return (
    <Screen>
      <T variant="display">{tx("prox.title")}</T>
      {phase.k === "idle" && (
        <Card>
          <T variant="secondary" tone="muted">
            {tx("prox.intro")}
          </T>
          <Button title={tx("prox.start")} icon="bluetooth" onPress={() => void start()} />
        </Card>
      )}
      {phase.k === "qr" && (
        <Card>
          <QrArea ready={!!phase.qr} note={tx("prox.qrNote")}>
            {phase.qr && <QRCode value={phase.qr} size={200} backgroundColor="#FFFFFF" color="#17110F" ecl="M" />}
          </QrArea>
        </Card>
      )}
      {phase.k === "consent" && (
        <>
          <Card tone="warn">
            <T variant="heading">{tx("prox.readerUnknown")}</T>
            <T variant="secondary">{tx("prox.readerUnknownText")}</T>
          </Card>
          <Card>
            <T variant="heading">{typeNameOfVct(phase.view.docType)}</T>
            <T variant="secondary" tone="muted">
              {tx("prox.fieldsIntro")}
            </T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {phase.view.requested
                .filter((e) => !phase.view.missing.includes(e))
                .map((e) => (
                  <Chip
                    key={e}
                    label={claimLabel(e)}
                    active={!off.includes(e)}
                    icon={off.includes(e) ? "close" : "checkmark"}
                    onPress={() => setOff((o) => (o.includes(e) ? o.filter((x) => x !== e) : [...o, e]))}
                  />
                ))}
            </View>
            {phase.view.missing.length > 0 && (
              <T variant="secondary" tone="muted">
                {tx("rev.missing", { fields: phase.view.missing.map(claimLabel).join(", ") })}
              </T>
            )}
          </Card>
          <Button
            title={tx("prox.send")}
            icon="send"
            disabled={phase.view.requested.every((e) => off.includes(e) || phase.view.missing.includes(e))}
            onPress={() => void send(phase)}
          />
          <Button variant="secondary" title={tx("prox.decline")} onPress={() => phase.resolve(null)} />
        </>
      )}
      {phase.k === "sending" && <Spinner text={tx("prox.sending")} />}
      {phase.k === "done" && (
        <Card tone="success">
          <T variant="heading">{tx("prox.done")}</T>
          <T variant="secondary">{phase.fields.map(claimLabel).join(", ")}</T>
        </Card>
      )}
      {phase.k === "declined" && (
        <Card>
          <T variant="secondary">{tx("prox.declined")}</T>
        </Card>
      )}
      {phase.k === "error" && (
        <Card tone="danger">
          <T variant="heading">{tx("prox.failed")}</T>
          <T variant="secondary">{phase.reason}</T>
        </Card>
      )}
      {(phase.k === "done" || phase.k === "declined" || phase.k === "error") && (
        <View style={{ gap: 8 }}>
          <Button variant="secondary" title={tx("prox.again")} icon="refresh" onPress={() => void start()} />
          <Button variant="ghost" title={tx("common.close")} onPress={() => router.back()} />
        </View>
      )}
    </Screen>
  );
}

/** taşıyıcı / protokol nedenini sade metne çevirir (ayrıntı kişiye gösterilmez) */
function errorText(reason?: string) {
  if (reason === "no reader connected") return t("prox.errTimeout");
  if (reason === "disconnected" || reason === "reader ended") return t("prox.errDisconnected");
  if (reason?.startsWith("Bluetooth")) return t("prox.errBluetooth");
  return t("prox.errGeneric");
}
