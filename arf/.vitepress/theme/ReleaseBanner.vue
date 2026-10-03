<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vitepress";
import { LATEST, hrefFor, parsePath } from "./releases";

const route = useRoute();
const here = computed(() => parsePath(route.path));
</script>

<template>
  <div v-if="here.release !== LATEST" class="arf-old" role="note">
    <template v-if="here.tr">
      Tamga ARF'nin <strong>eski bir yayınını</strong> (v{{ here.release }}) okuyorsunuz.
      <a :href="hrefFor(LATEST, true, here.page)">Güncel yayın v{{ LATEST }} →</a>
    </template>
    <template v-else>
      You are reading an <strong>earlier release</strong> of Tamga ARF (v{{ here.release }}).
      <a :href="hrefFor(LATEST, false, here.page)">Current release v{{ LATEST }} →</a>
    </template>
  </div>
</template>

<style scoped>
.arf-old {
  margin-bottom: 20px;
  padding: 10px 14px;
  border: 1px solid var(--arf-accent);
  border-radius: 6px;
  background: var(--arf-meta-bg);
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-1);
}
.arf-old a {
  margin-left: 4px;
  font-weight: 500;
  color: var(--vp-c-brand-1);
}
</style>
