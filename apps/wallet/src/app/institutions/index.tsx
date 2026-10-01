/** Kurum dizini (güven listesinden): arama + kategori çipleri (ikonlu) → kurum sayfası. */
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { router } from "expo-router";
import { searchDirectory, type DirectoryEntry } from "@tamga-network/wallet-core";
import { Chip, EmptyState, InstitutionRow, Screen, SearchField, Spinner, T, categoryIcon } from "@/ui";
import { categoryLabel, typeNameOfVct, useWallet } from "@/state/wallet";
import { useI18n } from "@/i18n";
import { loadDirectory } from "@/issuance";
import { friendlyError } from "@/wallet";

export default function Institutions() {
  const { state, session } = useWallet();
  const [entries, setEntries] = useState<DirectoryEntry[] | null>(session.get().directory ?? null);
  const [err, setErr] = useState<string | null>(null);
  const { t: tx } = useI18n();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | undefined>();
  useEffect(() => {
    if (entries || !state) return;
    loadDirectory(state)
      .then((d) => {
        session.set({ directory: d });
        setEntries(d);
      })
      .catch((e) => setErr(friendlyError(e)));
  }, []);
  const cats = useMemo(
    () => [
      ...new Set((entries ?? []).filter((e) => !e.isIdentityProvider && e.status === "ACTIVE").map((e) => e.category)),
    ],
    [entries],
  );
  const list = useMemo(() => searchDirectory(entries ?? [], q, cat), [entries, q, cat]);
  if (err)
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title={tx("common.directoryFailed")}
          text={err}
          action={{
            title: tx("inst.retry"),
            onPress: () => {
              setErr(null);
              setEntries(null);
            },
          }}
        />
      </Screen>
    );
  if (!entries) return <Spinner text={tx("common.loadingDirectory")} />;
  return (
    <Screen>
      <SearchField value={q} onChange={setQ} placeholder={tx("inst.search")} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        <Chip label={tx("common.all")} active={!cat} onPress={() => setCat(undefined)} />
        {cats.map((c) => {
          const ci = categoryIcon(c);
          return (
            <Chip
              key={c}
              label={categoryLabel(c)}
              icon={ci.icon}
              color={ci.color}
              active={cat === c}
              onPress={() => setCat(cat === c ? undefined : c)}
            />
          );
        })}
      </ScrollView>
      {list.length ? (
        list.map((e) => (
          <InstitutionRow
            key={e.slug}
            name={e.legalName}
            category={e.category}
            categoryLabel={categoryLabel(e.category)}
            klass={e.klass}
            types={e.vcts.map((v) => typeNameOfVct(v))}
            onPress={() => router.push({ pathname: "/institutions/[slug]", params: { slug: e.slug } })}
          />
        ))
      ) : (
        <EmptyState icon="search-outline" title={tx("inst.none")} text={tx("inst.noneText")} />
      )}
      <View>
        <T variant="secondary" tone="muted">
          {tx("inst.footer")}
        </T>
      </View>
    </Screen>
  );
}
