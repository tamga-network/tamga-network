/**
 * Cüzdan durum sağlayıcısı: kalıcı durum (WalletState), kilit, meşgul metni, PIN/Face ID onayı (WL11) ve ekranlar arası
 * geçici akış nesneleri (`session`: offer, trace, sunum onay modeli). Geçici nesneler URL'ye yazılmaz (beceri §1).
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { router } from "expo-router";
import type { CredentialOffer, DirectoryEntry, WalletState } from "@tamga-network/wallet-core";
import { biometricsAvailable, biometricUnlock, deviceLockEnabled, hasPin, walletStore } from "../platform";
import { STATUS_CHECK_INTERVAL_MS, checkStatuses, mergeStatuses } from "../features/status";
import { runAutoRefresh } from "../features/autorefresh";
import { loadOrNull, type Trace } from "../wallet";
import type { ReviewModel } from "../present";
import { en, locale, pickLocalized, t, type Key } from "../i18n";
import type { InstitutionRequest } from "../issuance";

export interface Session {
  offer?: { offer: CredentialOffer; issuerHost: string };
  trace?: Trace;
  review?: { model: ReviewModel; institution?: InstitutionRequest; check?: boolean; refreshOf?: string };
  sent?: { model: ReviewModel; redirectUri?: string; passGranted?: boolean; check?: boolean; showUrl?: string };
  receivedId?: string;
  /** ISSU_59: yenilenen belgede değişen alanlar (Bitti ekranında gösterilir). */
  changedFields?: string[];
  progressText?: string;
  directory?: DirectoryEntry[];
  /** /confirm ekranı için bekleyen onay isteği (PIN). */
  confirm?: { reason: string; resolve: (ok: boolean) => void };
  /** Kilitliyken gelen derin bağlantı (openid4vp:// | openid-credential-offer://); kilit açılınca Tara sekmesi işler. */
  inboundLink?: string;
}

interface Ctx {
  ready: boolean;
  state: WalletState | null;
  setState: (s: WalletState | null) => void;
  hasPinSet: boolean;
  unlocked: boolean;
  setUnlocked: (v: boolean) => void;
  busy: string | null;
  setBusy: (v: string | null) => void;
  confirmUser: (reason: string) => Promise<boolean>;
  /** Geçici akış nesneleri: `get()` okur, `set(patch)` yazar (render tetiklemez; ref tabanlı). */
  session: { get: () => Session; set: (patch: Partial<Session>) => void; clear: () => void };
}

const WalletCtx = createContext<Ctx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<WalletState | null>(null);
  const [hasPinSet, setHasPinSet] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const sessionRef = useRef<Session>({});
  const session = useMemo(
    () => ({
      get: () => sessionRef.current,
      set: (patch: Partial<Session>) => {
        Object.assign(sessionRef.current, patch);
      },
      clear: () => {
        sessionRef.current = {};
      },
    }),
    [],
  );

  useEffect(() => {
    (async () => {
      const st = await loadOrNull();
      setState(st);
      setHasPinSet(await hasPin());
      setReady(true);
    })();
  }, []);

  // ARF VCR_19: kilit açıkken ve uygulama öne geldiğinde belgelerin iptal durumu (en çok 6 saatte bir)
  const lastStatusCheck = useRef(0);
  const stateRef = useRef<WalletState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    if (!unlocked) return;
    const run = async () => {
      const st = stateRef.current;
      if (!st || Date.now() - lastStatusCheck.current < STATUS_CHECK_INTERVAL_MS) return;
      lastStatusCheck.current = Date.now();
      try {
        const statuses = await checkStatuses(st);
        if (!statuses.size) return;
        const latest = stateRef.current;
        if (!latest) return;
        const merged = mergeStatuses(latest, statuses);
        setState(merged);
        await walletStore.save(merged);
      } catch {
        lastStatusCheck.current = 0; // ağ yok → bir sonraki öne gelişte yeniden dene
      }
      // ADR-0023: sessiz kopya yenileme (eşik + rastgele gecikme; ayarlardan kapatılabilir)
      try {
        const snap = stateRef.current;
        const out = snap ? await runAutoRefresh(snap) : null;
        const latest = stateRef.current;
        if (out && latest) {
          const merged = out.apply(latest);
          setState(merged);
          await walletStore.save(merged);
          for (const c of out.changed)
            Alert.alert(
              t("auto.changedTitle"),
              t("auto.changedText", { type: typeNameOf(c.credential), fields: c.fields.map(claimLabel).join(", ") }),
            );
        }
      } catch {
        // sonraki öne gelişte yeniden denenir
      }
    };
    void run();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void run();
    });
    return () => sub.remove();
  }, [unlocked]);

  /** WL11: her sunum PIN veya biyometri onayı ister. Biyometri açık ve başarılıysa yeter; aksi hâlde /confirm PIN ekranı (iOS+Android aynı). */
  const confirmUser = useCallback(
    async (reason: string): Promise<boolean> => {
      if (!(await deviceLockEnabled())) {
        Alert.alert(t("lock.deviceTitle"), t("lock.deviceText"));
        return false;
      }
      if (state?.settings.biometrics && (await biometricsAvailable()) && (await biometricUnlock(reason))) return true;
      return new Promise((resolve) => {
        session.set({ confirm: { reason, resolve } });
        router.push("/confirm");
      });
    },
    [state?.settings.biometrics, session],
  );

  const value = useMemo<Ctx>(
    () => ({
      ready,
      state,
      setState: (s) => {
        setState(s);
        if (s) setHasPinSet(true);
      },
      hasPinSet,
      unlocked,
      setUnlocked,
      busy,
      setBusy,
      confirmUser,
      session,
    }),
    [ready, state, hasPinSet, unlocked, busy, confirmUser],
  );
  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet(): Ctx {
  const c = useContext(WalletCtx);
  if (!c) throw new Error("useWallet: WalletProvider missing");
  return c;
}

/** Ekranlarda ortak yardımcılar (dil: i18n). */
export const fmtDate = (sec?: number) => (sec ? new Date(sec * 1000).toLocaleDateString(locale()) : "—");
export const claimText = (v: unknown): string =>
  typeof v === "object" && v !== null
    ? (pickLocalized(v as Record<string, string>) ?? JSON.stringify(v))
    : typeof v === "boolean"
      ? v
        ? t("common.yes")
        : t("common.no")
      : String(v);
export const HIDDEN_META = ["iss", "vct", "vct#integrity", "iat", "exp", "cnf", "status", "category"];
/** Teknik claim adı → kullanıcının dilinde günlük ad (beceri §6); bilinmeyen alan adı olduğu gibi. */
export const claimLabel = (k: string) => {
  const key = `claim.${k}` as Key;
  return key in en ? t(key) : k;
};
/** Bilinen belge türlerinin adı kullanıcının dilinde; bilinmeyen tür alındığı andaki adıyla. */
const TYPE_KEYS: Record<string, Key> = {
  "urn:tamga:edu:StudentCredential:1": "type.student",
  "urn:tamga:edu:DiplomaCredential:1": "type.diploma",
  "urn:tamga:id:IdentityAttestation:1": "type.identity",
  "urn:tamga:tkt:EventTicket:1": "type.ticket",
  "urn:tamga:contact:EmailAddress:1": "type.email",
  "urn:tamga:contact:PhoneNumber:1": "type.phone",
};
export const typeNameOfVct = (vct: string, fallback?: string) =>
  TYPE_KEYS[vct] ? t(TYPE_KEYS[vct]) : (fallback ?? vct.split(":").slice(-2, -1)[0] ?? vct);
export const typeNameOf = (c: { vct: string; typeName: string }) => typeNameOfVct(c.vct, c.typeName);
/** Kategori kodu → kullanıcının dilinde ad. */
export const categoryLabel = (c: string) => {
  const key = `cat.${c}` as Key;
  return key in en ? t(key) : c;
};
/** Belgeyi veren kurumun görünen adı (kimlik belgesi için geçici sağlayıcı etiketi). */
export const issuerNameOf = (c: { vct: string; issuer: string; claims: Record<string, unknown> }) =>
  c.claims.awarding_body_name
    ? claimText(c.claims.awarding_body_name)
    : c.vct.includes(":id:")
      ? t("issuer.tamgaId")
      : c.issuer;
/** Kart alt satırı: kişi adı; kişi alanı olmayan belgelerde etkinlik adı ya da doğrulanmış adres (ADR-0021). */
export const personNameOf = (c: { claims: Record<string, unknown> }) =>
  c.claims.given_name || c.claims.family_name
    ? `${claimText(c.claims.given_name)} ${claimText(c.claims.family_name)}`.trim()
    : claimText(c.claims.event_name ?? c.claims.email ?? c.claims.phone_number ?? "");

/** Geçmiş: sunumlar (cihaz kaydı, WL4) + ihraçlar + kimlik doğrulama, tek zaman çizgisi (en yeni önce). */
export interface ActivityItem {
  ts: number;
  kind:
    | "presented"
    | "declined"
    | "failed"
    | "deleted"
    | "issued"
    | "identity"
    | "deletion_request"
    | "dpa_report"
    | "pseudonym_created"
    | "pseudonym_deleted";
  title: string;
  detail: string;
  credentialId?: string;
  /** Günlükten silinebilen kayıtların zaman damgaları (DASH_06a); belge alımları belgeden türetilir, silinmez. */
  logTs?: number[];
  /** TS7 / TS8: paylaşım kaydı (silme talebi ve şikâyet buradan başlar) */
  entry?: WalletState["presentationLog"][number];
}
export function activityOf(state: WalletState | null): ActivityItem[] {
  if (!state) return [];
  const items: ActivityItem[] = state.presentationLog.map((e) => ({
    ts: e.ts,
    kind: e.outcome === "sent" ? "presented" : e.outcome === "error" ? "failed" : "declined",
    logTs: [e.ts],
    entry: e,
    title: e.clientId.split(":").pop() ?? e.clientId,
    detail: e.disclosed.length
      ? t("act.shared", { fields: e.disclosed.map(claimLabel).join(", ") })
      : t("act.nothingShared"),
  }));
  for (const e of state.events ?? [])
    items.push(
      e.kind === "pseudonym_created" || e.kind === "pseudonym_deleted"
        ? {
            // ADR-0031 PA_08a: site adı ve olay; takma ad değeri yok
            ts: e.ts,
            kind: e.kind,
            title: e.typeName,
            detail: t(e.kind === "pseudonym_created" ? "act.pseudonymCreated" : "act.pseudonymDeleted"),
            logTs: [e.ts],
          }
        : e.kind === "deleted"
          ? {
              ts: e.ts,
              kind: "deleted",
              title: typeNameOfVct(e.vct, e.typeName),
              detail: t("act.deleted"),
              logTs: [e.ts],
            }
          : {
              ts: e.ts,
              kind: e.kind,
              title: e.clientId?.split(":").pop() ?? "",
              detail:
                e.kind === "deletion_request"
                  ? t("act.deletionRequest", { channel: t(`rights.ch.${e.channel ?? "web"}` as Key) })
                  : t("act.dpaReport", { authority: e.authority ?? "" }),
              logTs: [e.ts],
            },
    );
  for (const c of state.credentials) {
    const isId = c.vct.includes(":id:");
    items.push({
      ts: c.iat * 1000,
      kind: isId ? "identity" : "issued",
      title: isId ? t("act.idVerified") : t("act.received", { type: typeNameOf(c) }),
      detail: issuerNameOf(c),
      credentialId: c.id,
    });
  }
  items.sort((a, b) => b.ts - a.ts);
  // Aynı gün aynı doğrulayıcıya tekrarlanan sunumlar tek satır: "… × n" (turnike günlüğü okunur kalsın)
  const out: ActivityItem[] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    const sameDay = prev && new Date(prev.ts).toDateString() === new Date(it.ts).toDateString();
    if (
      prev &&
      it.kind === "presented" &&
      prev.kind === "presented" &&
      sameDay &&
      prev.title.replace(/ × \d+$/, "") === it.title
    ) {
      const n = Number(/ × (\d+)$/.exec(prev.title)?.[1] ?? 1) + 1;
      prev.title = `${it.title} × ${n}`;
      prev.logTs = [...(prev.logTs ?? []), ...(it.logTs ?? [])];
      continue;
    }
    out.push({ ...it });
  }
  return out;
}
