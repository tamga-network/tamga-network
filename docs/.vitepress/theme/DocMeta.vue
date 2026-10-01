<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";
import { statusLabel } from "./status";

// Her belgenin üstünde künye: kimlik, tür, durum, sürüm, tarih (ön bilgiden). Ön bilgisi olmayan sayfada görünmez.
const { frontmatter } = useData();
const meta = computed(() => {
  const f = frontmatter.value;
  if (!f.document_id) return null;
  const id = String(f.document_id);
  const kind = id.startsWith("ADR-") ? "adr" : "doc";
  const KIND: Record<string, string> = {
    ADR: "Mimari karar kaydı",
    SPEC: "Spesifikasyon",
    GUIDE: "Rehber",
    ARCH: "Mimari",
    PM: "Proje hafızası",
    RS: "Araştırma",
    FW: "Çerçeve belgesi",
  };
  return {
    id,
    kind: KIND[id.split("-")[0]] ?? String(f.category ?? ""),
    status: statusLabel(String(f.status ?? ""), kind),
    version: f.version ? String(f.version) : "",
    created: f.created ? String(f.created) : "",
    updated: f.last_updated ? String(f.last_updated) : "",
    domain: f.domain ? String(f.domain) : "",
  };
});
</script>

<template>
  <div v-if="meta" class="doc-meta">
    <span class="doc-meta-id">{{ meta.id }}</span>
    <span class="doc-meta-kind">{{ meta.kind }}<template v-if="meta.domain"> · {{ meta.domain }}</template></span>
    <span :class="['doc-status', meta.status.tone]">{{ meta.status.text }}</span>
    <span v-if="meta.version" class="doc-meta-item">sürüm {{ meta.version }}</span>
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
