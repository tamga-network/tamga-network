<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";
import { statusLabel } from "./status";

// Her belgenin üstünde künye: kimlik, tür, durum, sürüm, tarih (ön bilgiden). Ön bilgisi olmayan sayfada görünmez.
const { frontmatter, lang } = useData();
/** Ön bilgideki tarih (YAML bunu Date olarak okur) → "3 Ekim 2026" / "3 October 2026"; okunamazsa olduğu gibi. */
function fmtDate(v: unknown, locale: string): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
const KINDS = {
  en: { ADR: "Architecture decision", SPEC: "Specification", GUIDE: "Guide", ARCH: "Architecture", PM: "Background", RS: "Research", FW: "Framework", GLOSSARY: "Reference" },
  tr: { ADR: "Mimari karar kaydı", SPEC: "Şartname", GUIDE: "Rehber", ARCH: "Mimari", PM: "Arka plan", RS: "Araştırma", FW: "Çerçeve belgesi", GLOSSARY: "Başvuru" },
  az: { ADR: "Memarlıq qərarı", SPEC: "Spesifikasiya", GUIDE: "Bələdçi", ARCH: "Arxitektura", PM: "Arxa plan", RS: "Tədqiqat", FW: "Çərçivə sənədi", GLOSSARY: "Arayış" },
} as Record<string, Record<string, string>>;
const meta = computed(() => {
  const f = frontmatter.value;
  if (!f.document_id) return null;
  const id = String(f.document_id);
  const kind = id.startsWith("ADR-") ? "adr" : "doc";
  const l = lang.value.startsWith("tr") ? "tr" : lang.value.startsWith("az") ? "az" : "en";
  const KIND = KINDS[l];
  const dateLocale = { en: "en-GB", tr: "tr-TR", az: "az" }[l];
  return {
    id,
    kind: KIND[id.split("-")[0]] ?? "",
    status: statusLabel(String(f.status ?? ""), kind, lang.value),
    version: f.version ? String(f.version) : "",
    created: fmtDate(f.created, dateLocale),
    updated: fmtDate(f.last_updated, dateLocale),
    domain: "",
    versionLabel: { en: "version", tr: "sürüm", az: "versiya" }[l],
  };
});
</script>

<template>
  <div v-if="meta" class="doc-meta">
    <span class="doc-meta-id">{{ meta.id }}</span>
    <span class="doc-meta-kind">{{ meta.kind }}<template v-if="meta.domain"> · {{ meta.domain }}</template></span>
    <span :class="['doc-status', meta.status.tone]">{{ meta.status.text }}</span>
    <span v-if="meta.version" class="doc-meta-item">{{ meta.versionLabel }} {{ meta.version }}</span>
    <span v-if="meta.updated || meta.created" class="doc-meta-item">{{ meta.updated || meta.created }}</span>
  </div>
</template>

<style scoped>
.doc-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 20px;
  padding: 10px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}
.doc-meta-id {
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.doc-meta-item {
  font-family: var(--vp-font-family-mono);
}
</style>
