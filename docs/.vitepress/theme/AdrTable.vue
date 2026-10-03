<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";
import { data as adrs } from "./adr.data";
import { statusLabel } from "./status";

// Kararlar konu gruplarına göre (ön bilgideki `domain`); İngilizce sayfada İngilizce çeviri, yoksa Türkçe kayıt.
const { lang } = useData();
const en = computed(() => !lang.value.startsWith("tr"));
const GROUPS = ["Trust", "Credentials", "Identity", "Wallet", "Services", "Governance"] as const;
const NAMES = {
  en: { Trust: "Trust", Credentials: "Credentials", Identity: "Identity and privacy", Wallet: "Wallet", Services: "Services", Governance: "Governance" },
  tr: { Trust: "Güven", Credentials: "Belgeler", Identity: "Kimlik ve gizlilik", Wallet: "Cüzdan", Services: "Hizmetler", Governance: "Yönetişim" },
};
const rows = computed(() => {
  const want = en.value ? "en" : "tr";
  const byId = new Map<string, (typeof adrs)[number]>();
  for (const a of adrs) if (a.lang === "tr" || want === "en") {
    const cur = byId.get(a.id);
    if (!cur || a.lang === want) byId.set(a.id, a);
  }
  return [...byId.values()];
});
const groups = computed(() =>
  GROUPS.map((g) => ({ name: NAMES[en.value ? "en" : "tr"][g], items: rows.value.filter((a) => a.domain === g) })).filter(
    (g) => g.items.length,
  ),
);
</script>

<template>
  <div v-for="g in groups" :key="g.name" class="adr-table">
    <h3>{{ g.name }}</h3>
    <table>
      <thead>
        <tr>
          <th>No</th>
          <th>{{ en ? "Decision" : "Karar" }}</th>
          <th>{{ en ? "Date" : "Tarih" }}</th>
          <th>{{ en ? "Status" : "Durum" }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in g.items" :key="a.id">
          <td class="mono">{{ a.id.replace("ADR-", "") }}</td>
          <td>
            <a :href="a.url">{{ a.title }}</a>
          </td>
          <td class="mono">{{ a.created }}</td>
          <td>
            <span :class="['doc-status', statusLabel(a.status, 'adr', lang).tone]">{{ statusLabel(a.status, "adr", lang).text }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.adr-table {
  overflow-x: auto;
}
.adr-table table {
  display: table;
  width: 100%;
  font-size: 14px;
}
.adr-table td {
  vertical-align: top;
}
.mono {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  white-space: nowrap;
}
</style>
