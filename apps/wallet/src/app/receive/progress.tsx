/** Bekleme: adım listesi (trace canlı). Geri tuşu yok; işi başlatan ekran bitince değiştirir. */
import React, { useEffect, useState } from "react";
import { Screen, StepList, T } from "@/ui";
import { useWallet } from "@/state/wallet";
import { useI18n } from "@/i18n";

export default function Progress() {
  const { session } = useWallet();
  const { t: tx } = useI18n();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 300);
    return () => clearInterval(id);
  }, []);
  const steps = session.get().trace ?? [];
  return (
    <Screen>
      <T variant="title">{session.get().progressText ?? tx("progress.working")}</T>
      <StepList steps={steps} active={steps.length ? tx("progress.ongoing") : tx("progress.starting")} />
      <T variant="secondary" tone="muted">
        {tx("progress.keysNote")}
      </T>
    </Screen>
  );
}
