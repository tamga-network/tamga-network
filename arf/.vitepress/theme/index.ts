import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { h } from "vue";
import VersionSwitcher from "./VersionSwitcher.vue";
import ReleaseBanner from "./ReleaseBanner.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "nav-bar-content-after": () => h(VersionSwitcher),
      "doc-before": () => h(ReleaseBanner),
    }),
} satisfies Theme;
