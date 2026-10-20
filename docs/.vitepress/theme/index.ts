import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { h } from "vue";
import DocMeta from "./DocMeta.vue";
import AdrTable from "./AdrTable.vue";
import TranslationNote from "./TranslationNote.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "doc-before": () => [h(TranslationNote), h(DocMeta)],
      "home-hero-before": () => h("div", { class: "translation-note-home" }, [h(TranslationNote)]),
    }),
  enhanceApp({ app }) {
    app.component("AdrTable", AdrTable);
  },
} satisfies Theme;
