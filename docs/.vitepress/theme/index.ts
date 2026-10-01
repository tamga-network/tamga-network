import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { h } from "vue";
import DocMeta from "./DocMeta.vue";
import AdrTable from "./AdrTable.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { "doc-before": () => h(DocMeta) }),
  enhanceApp({ app }) {
    app.component("AdrTable", AdrTable);
  },
} satisfies Theme;
