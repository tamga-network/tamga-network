<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vitepress";
import { LATEST, RELEASES, hrefFor, parsePath } from "./releases";

const route = useRoute();
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const here = computed(() => parsePath(route.path));
const T = computed(() =>
  here.value.tr
    ? { latest: "güncel", label: "Yayın", changes: "Ne değişti", only: "yalnızca Türkçe", fmt: "tr-TR" }
    : { latest: "latest", label: "Release", changes: "What changed", only: "Turkish only", fmt: "en-GB" },
);
const date = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString(T.value.fmt, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

function onDoc(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
onMounted(() => document.addEventListener("click", onDoc));
onBeforeUnmount(() => document.removeEventListener("click", onDoc));
</script>

<template>
  <div ref="root" class="arf-vs">
    <button
      type="button"
      class="arf-vs-btn"
      :aria-expanded="open"
      aria-haspopup="menu"
      :aria-label="`${T.label} ${here.release}`"
      @click="open = !open"
    >
      <span class="arf-vs-v">v{{ here.release }}</span>
      <span v-if="here.release === LATEST" class="arf-vs-tag">{{ T.latest }}</span>
      <span class="arf-vs-caret" aria-hidden="true">▾</span>
    </button>
    <div v-if="open" class="arf-vs-menu" role="menu">
      <a
        v-for="r in RELEASES"
        :key="r.id"
        role="menuitem"
        :href="hrefFor(r.id, here.tr, here.page)"
        :class="['arf-vs-item', { active: r.id === here.release }]"
        @click="open = false"
      >
        <span class="arf-vs-row">
          <span class="arf-vs-v">v{{ r.id }}</span>
          <span v-if="r.id === LATEST" class="arf-vs-tag">{{ T.latest }}</span>
        </span>
        <span class="arf-vs-sub">
          {{ date(r.date) }}<template v-if="!r.languages.includes('en')"> · {{ T.only }}</template>
        </span>
      </a>
      <a
        role="menuitem"
        class="arf-vs-item arf-vs-changes"
        :href="here.tr ? '/tr/changes' : '/changes'"
        @click="open = false"
      >
        {{ T.changes }} →
      </a>
    </div>
  </div>
</template>

<style scoped>
.arf-vs {
  position: relative;
  display: flex;
  align-items: center;
  margin-left: 12px;
}
.arf-vs-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
}
.arf-vs-btn:hover,
.arf-vs-btn[aria-expanded="true"] {
  border-color: var(--vp-c-brand-1);
}
.arf-vs-btn:focus-visible,
.arf-vs-item:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}
.arf-vs-tag {
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
.arf-vs-caret {
  font-size: 10px;
  color: var(--vp-c-text-2);
}
.arf-vs-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 50;
  min-width: 220px;
  padding: 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  box-shadow: var(--vp-shadow-3);
}
.arf-vs-item {
  display: block;
  padding: 8px 10px;
  border-radius: 6px;
  color: var(--vp-c-text-1);
  text-decoration: none;
}
.arf-vs-item:hover {
  background: var(--vp-c-bg-soft);
}
.arf-vs-item.active {
  background: var(--vp-c-brand-soft);
}
.arf-vs-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}
.arf-vs-sub {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.arf-vs-changes {
  margin-top: 4px;
  border-top: 1px solid var(--vp-c-divider);
  border-radius: 0 0 6px 6px;
  font-size: 13px;
  color: var(--vp-c-brand-1);
}
</style>
