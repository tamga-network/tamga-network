/**
 * Dil: varsayılan telefonun dili (expo-localization); desteklenmeyen dilde İngilizce. Ayarlardan elle seçilebilir
 * (tercih SecureStore'da, cüzdan kilitliyken de okunur). `t()` React dışı modüllerde de çalışır; ekranlar `useI18n()` ile
 * dil değişince yeniden çizilir.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { getLocales } from "expo-localization";
import { en, type Key } from "./en";
import { tr } from "./tr";

export type Lang = "en" | "tr";
export type LangPref = "system" | Lang;
export type { Key };
export { en };

export const LANGS: Array<{ key: Lang; label: string }> = [
  { key: "en", label: "English" },
  { key: "tr", label: "Türkçe" },
];

const DICTS: Record<Lang, Record<Key, string>> = { en, tr };
/** BCP 47 etiketleri: tarih biçimi ve çok dilli alan seçimi (`{"tr-TR": …}`) için. */
const LOCALE: Record<Lang, string> = { en: "en-GB", tr: "tr-TR" };
const PREF_KEY = "tamga.lang";

/** Telefonun dili desteklenen dillerden biriyse o, değilse İngilizce. */
export function deviceLang(): Lang {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase();
    return code === "tr" ? "tr" : "en";
  } catch {
    return "en";
  }
}

let current: Lang = deviceLang();

export const lang = (): Lang => current;
export const locale = (): string => LOCALE[current];

/** Çeviri: `{ad}` yer tutucuları `vars` ile doldurulur; eksik çeviri İngilizceye düşer. */
export function t(key: Key, vars?: Record<string, string | number>): string {
  let s: string = DICTS[current][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Çok dilli değer (`{"tr-TR": "…", "en-US": "…"}`) → kullanıcının dilindeki metin; yoksa İngilizce, sonra ilk değer. */
export function pickLocalized(map: Record<string, string> | undefined, fallback?: string): string | undefined {
  if (!map) return fallback;
  const keys = Object.keys(map);
  const byLang = (l: string) => keys.find((k) => k.toLowerCase().split("-")[0] === l);
  const k = byLang(current) ?? byLang("en");
  return k ? map[k] : (fallback ?? (keys.length ? map[keys[0]] : undefined));
}

export const fmtDateOf = (ms: number) => new Date(ms).toLocaleDateString(locale());
export const fmtDateTimeOf = (ms: number) => new Date(ms).toLocaleString(locale());

interface I18nCtx {
  lang: Lang;
  pref: LangPref;
  setPref: (p: LangPref) => void;
  t: typeof t;
}
const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<LangPref>("system");
  const [active, setActive] = useState<Lang>(current);
  useEffect(() => {
    SecureStore.getItemAsync(PREF_KEY)
      .then((v) => {
        if (v === "en" || v === "tr") {
          current = v;
          setPrefState(v);
          setActive(v);
        }
      })
      .catch(() => {});
  }, []);
  const value = useMemo<I18nCtx>(
    () => ({
      lang: active,
      pref,
      setPref: (p) => {
        current = p === "system" ? deviceLang() : p;
        setPrefState(p);
        setActive(current);
        void (p === "system" ? SecureStore.deleteItemAsync(PREF_KEY) : SecureStore.setItemAsync(PREF_KEY, p)).catch(
          () => {},
        );
      },
      t,
    }),
    [active, pref],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Ekranlar bunu çağırır: dil değişince yeniden çizilir. */
export function useI18n(): I18nCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n: I18nProvider missing");
  return c;
}
