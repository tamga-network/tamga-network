/** Belgeler: tam liste — arama, kategori çipleri, kategoriye göre grup, sabitlenenler önce, en yeni üstte. */
import React, { useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { Chip, CredentialCard, EmptyState, Screen, SearchField, T, categoryIcon } from "@/ui";
import { vctCategory } from "@/ui/icons";
import { categoryLabel, fmtDate, issuerNameOf, personNameOf, typeNameOf, useWallet } from "@/state/wallet";
import { useI18n } from "@/i18n";
import { loadDirectory } from "@/issuance";
import { friendlyError } from "@/wallet";

/** Bu kadar belgeden itibaren arama ve kategori süzgeci görünür. */
const SEARCH_THRESHOLD = 4;

export default function Documents() {
  const { state, setBusy, session } = useWallet();
  const { t: tx } = useI18n();
  const openDirectory = async () => {
    if (!state) return;
    setBusy(tx("common.loadingDirectory"));
    try {
      session.set({ directory: await loadDirectory(state) });
      router.push("/institutions");
    } catch (e) {
      Alert.alert(tx("common.directoryFailed"), friendlyError(e));
    } finally {
      setBusy(null);
    }
  };
  const creds = state?.credentials ?? [];
  const pinned = new Set(state?.settings.pinned ?? []);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | undefined>();
  const cats = useMemo(() => [...new Set(creds.map((c) => vctCategory(c.vct)))], [creds]);
  const groups = useMemo(() => {
    const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").toLowerCase();
    const nq = norm(q.trim());
    const list = creds
      .filter((c) => !cat || vctCategory(c.vct) === cat)
      .filter((c) => !nq || norm(`${typeNameOf(c)} ${c.typeName} ${issuerNameOf(c)} ${personNameOf(c)}`).includes(nq))
      .sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)) || b.iat - a.iat);
    const m = new Map<string, typeof list>();
    for (const c of list) {
      const g = vctCategory(c.vct);
      m.set(g, [...(m.get(g) ?? []), c]);
    }
    return [...m.entries()];
  }, [creds, q, cat, state?.settings.pinned]);
  const open = (id: string) => router.push({ pathname: "/credential/[id]", params: { id } });
  return (
    <Screen
      title={tx("nav.documents")}
      subtitle={creds.length ? tx("docs.subtitle", { n: creds.length }) : undefined}
      action={{
        icon: "add",
        label: tx("docs.add"),
        onPress: () =>
          Alert.alert(tx("docs.add"), tx("docs.addHow"), [
            { text: tx("common.getFromInstitution"), onPress: () => void openDirectory() },
            {
              text: tx("contact.addEmail"),
              onPress: () => router.push({ pathname: "/contact", params: { kind: "email" } }),
            },
            {
              text: tx("contact.addPhone"),
              onPress: () => router.push({ pathname: "/contact", params: { kind: "phone" } }),
            },
            { text: tx("docs.scanQr"), onPress: () => router.navigate("/(tabs)/scan") },
            { text: tx("common.cancel"), style: "cancel" },
          ]),
      }}
    >
      {creds.length >= SEARCH_THRESHOLD && (
        <>
          <SearchField value={q} onChange={setQ} placeholder={tx("docs.search")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
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
        </>
      )}
      {creds.length ? (
        groups.map(([g, list]) => (
          <View key={g} style={{ gap: 12 }}>
            {groups.length > 1 && (
              <T variant="secondary" tone="muted" style={{ marginTop: 4 }}>
                {categoryLabel(g)} · {list.length}
              </T>
            )}
            {list.map((c) => (
              <CredentialCard
                key={c.id}
                typeName={typeNameOf(c)}
                vct={c.vct}
                issuerName={issuerNameOf(c)}
                personName={personNameOf(c)}
                copiesLeft={c.copies.filter((k) => !k.usedBy.length).length}
                copiesTotal={c.copies.length}
                dateText={tx("common.issuedOn", { date: fmtDate(c.iat) })}
                pinned={pinned.has(c.id)}
                status={c.status?.value}
                onPress={() => open(c.id)}
              />
            ))}
          </View>
        ))
      ) : (
        <EmptyState icon="documents-outline" title={tx("docs.emptyTitle")} text={tx("docs.emptyText")} />
      )}
    </Screen>
  );
}
