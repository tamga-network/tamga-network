/**
 * AB TS10 (ADR-0027): taşıma dosyası (belge listesi + işlem günlüğü) ve yalnız günlük dosyası — ikisi de kişinin parolasıyla
 * şifreli, paylaş menüsüyle kişinin seçtiği yere. İçe aktarmada günlüğün geri yüklenmesi kişiye sorulur (ARF Mig_07b);
 * belgeler için "yeniden al" listesi gösterilir (kurum sayfası / kimlik / iletişim).
 */
import React, { useState } from "react";
import { Alert, Share, View } from "react-native";
import { router } from "expo-router";
import { Button, Card, Field, Screen, T, hapticError, hapticSuccess } from "@/ui";
import { useWallet } from "@/state/wallet";
import { exportMigration, exportTransactionLog, importMigration, openMigration } from "@/features/migration";
import { loadDirectory } from "@/issuance";
import { useI18n } from "@/i18n";
import { TS10_MIN_PASSWORD, type Ts10MigrationData, type WalletState } from "@tamga-network/wallet-core";

type Reissue = Ts10MigrationData["listOfCredentials"][number] & { route?: string };

export default function Migration() {
  const { state, setState, setBusy } = useWallet();
  const { t: tx } = useI18n();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [file, setFile] = useState("");
  const [inPw, setInPw] = useState("");
  const [reissue, setReissue] = useState<Reissue[] | null>(null);
  if (!state) return null;

  const checkPw = () => {
    if (pw.length < TS10_MIN_PASSWORD) return (Alert.alert(tx("mig.pwShort", { n: TS10_MIN_PASSWORD })), false);
    if (pw !== pw2) return (Alert.alert(tx("mig.pwMismatch")), false);
    return true;
  };

  const doExport = async (kind: "move" | "log") => {
    if (!checkPw()) return;
    setBusy(tx("mig.preparing"));
    try {
      const jwe = kind === "move" ? await exportMigration(state, pw) : await exportTransactionLog(state, pw);
      setBusy(null);
      hapticSuccess();
      await Share.share({ title: tx(kind === "move" ? "mig.fileTitle" : "mig.logTitle"), message: jwe });
      setPw("");
      setPw2("");
    } catch (e) {
      setBusy(null);
      hapticError();
      Alert.alert(tx("mig.failed"), (e as Error).message);
    }
  };

  const apply = async (data: Ts10MigrationData, restoreLog: boolean) => {
    const r = importMigration(state as WalletState, data, restoreLog);
    setState(r.state);
    let dir: Awaited<ReturnType<typeof loadDirectory>> = [];
    try {
      dir = await loadDirectory(r.state);
    } catch {
      /* çevrim dışı: yönlendirme olmadan liste */
    }
    setReissue(
      r.toReissue.map((c) => {
        if (c.credentialIdentifier.startsWith("urn:tamga:id:")) return { ...c, route: "/identity" };
        if (c.credentialIdentifier.startsWith("urn:tamga:contact:"))
          return { ...c, route: `/contact?kind=${c.credentialIdentifier.includes("Phone") ? "phone" : "email"}` };
        const e = dir.find((d) => d.issuerId === c.x_tamga_issuer_id);
        return { ...c, ...(e ? { route: `/institutions/${e.slug}` } : {}) };
      }),
    );
    setFile("");
    setInPw("");
    hapticSuccess();
  };

  const doImport = async () => {
    setBusy(tx("mig.opening"));
    let data: Ts10MigrationData;
    try {
      data = await openMigration(file, inPw);
    } catch {
      hapticError();
      Alert.alert(tx("mig.openFailed"), tx("mig.openFailedText"));
      return;
    } finally {
      setBusy(null);
    }
    if (!data.transactionLog?.length && !data.x_tamga?.presentationLog?.length) return void apply(data, false);
    // ARF Mig_07b: günlüğün geri yüklenmesi kişiye sorulur
    Alert.alert(tx("mig.restoreLogTitle"), tx("mig.restoreLogText"), [
      { text: tx("mig.restoreLogNo"), onPress: () => void apply(data, false) },
      { text: tx("mig.restoreLogYes"), onPress: () => void apply(data, true) },
    ]);
  };

  return (
    <Screen>
      <T variant="display">{tx("mig.title")}</T>
      <Card>
        <T variant="secondary" tone="muted">
          {tx("mig.intro")}
        </T>
      </Card>
      <Card>
        <T variant="heading">{tx("mig.exportTitle")}</T>
        <Field label={tx("mig.password")} value={pw} onCommit={setPw} commitDelayMs={0} secureTextEntry />
        <Field label={tx("mig.password2")} value={pw2} onCommit={setPw2} commitDelayMs={0} secureTextEntry />
        <T variant="secondary" tone="muted">
          {tx("mig.pwHelp")}
        </T>
        <Button title={tx("mig.export")} icon="share-outline" onPress={() => void doExport("move")} />
        <Button
          variant="secondary"
          title={tx("mig.exportLog")}
          icon="document-text-outline"
          onPress={() => void doExport("log")}
        />
      </Card>
      <Card>
        <T variant="heading">{tx("mig.importTitle")}</T>
        <Field
          label={tx("mig.paste")}
          value={file}
          onCommit={setFile}
          commitDelayMs={0}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Field label={tx("mig.password")} value={inPw} onCommit={setInPw} commitDelayMs={0} secureTextEntry />
        <Button
          variant="secondary"
          title={tx("mig.import")}
          icon="download-outline"
          disabled={!file.trim() || !inPw}
          onPress={() => void doImport()}
        />
      </Card>
      {reissue && (
        <Card>
          <T variant="heading">{tx("mig.reissueTitle")}</T>
          <T variant="secondary" tone="muted">
            {reissue.length ? tx("mig.reissueText") : tx("mig.reissueNone")}
          </T>
          {reissue.map((c) => (
            <View key={`${c.x_tamga_issuer_id}|${c.credentialIdentifier}`} style={{ gap: 4 }}>
              <T>{c.issuerName}</T>
              <T variant="mono" tone="muted">
                {c.credentialIdentifier}
              </T>
              {c.route && (
                <Button
                  variant="secondary"
                  title={tx("mig.reissue")}
                  icon="refresh"
                  onPress={() => router.push(c.route as never)}
                />
              )}
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
