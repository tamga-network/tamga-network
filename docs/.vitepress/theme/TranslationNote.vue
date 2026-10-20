<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";

// Otomatik çeviri notu: ana dili konuşan birinin okuması henüz bitmemiş dillerde her sayfanın üstünde (docs ve ARF ortak).
// Okuma bitince dil bu listeden çıkarılır.
const NOTES: Record<string, { text: string; write: string }> = {
  az: { text: "Bu səhifə avtomatik tərcümə olunub. Səhv görsəniz,", write: "ünvanına yazın." },
};
const { lang, frontmatter } = useData();
// Yedek sayfa (yalnız İngilizcesi var, `az_fallback`) çevrilmiş değildir: not gösterilmez.
const note = computed(() => (frontmatter.value.az_fallback ? undefined : NOTES[lang.value.split("-")[0]]));
</script>

<template>
  <p v-if="note" class="translation-note" role="note">
    {{ note.text }} <a href="mailto:info@tamga.network">info@tamga.network</a> {{ note.write }}
  </p>
</template>

<style scoped>
.translation-note {
  margin: 0 0 20px;
  padding: 8px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
.translation-note a {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
