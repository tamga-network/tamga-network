<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";
import { statusLabel } from "./status";

// Her belgenin üstünde künye: kimlik, tür, durum, sürüm, tarih (ön bilgiden). Ön bilgisi olmayan sayfada görünmez.
const { frontmatter, lang } = useData();
/** Ön bilgideki tarih (YAML bunu Date olarak okur) → "3 Ekim 2026" / "3 October 2026"; okunamazsa olduğu gibi. */
function fmtDate(v: unknown, en: boolean): string {
  if (!v) return "";
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(en ? "en-GB" : "tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
const meta = computed(() => {
  const f = frontmatter.value;
  if (!f.document_id) return null;
  const id = String(f.document_id);
  const kind = id.startsWith("ADR-") ? "adr" : "doc";
  const en = !lang.value.startsWith("tr");
  const KIND: Record<string, string> = en
    ? { ADR: "Architecture decision", SPEC: "Specification", GUIDE: "Guide", ARCH: "Architecture", PM: "Background", RS: "Research", FW: "Framework", GLOSSARY: "Reference" }
    : { ADR: "Mimari karar kaydı", SPEC: "Şartname", GUIDE: "Rehber", ARCH: "Mimari", PM: "Arka plan", RS: "Araştırma", FW: "Çerçeve belgesi", GLOSSARY: "Başvuru" };
  return {
    id,
    kind: KIND[id.split("-")[0]] ?? "",
    status: statusLabel(String(f.status ?? ""), kind, lang.value),
    version: f.version ? String(f.version) : "",
    created: fmtDate(f.created, en),
    updated: fmtDate(f.last_updated, en),
    domain: "",
    versionLabel: en ? "version" : "sürüm",
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
