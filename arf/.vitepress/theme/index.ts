import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { h } from "vue";
import VersionSwitcher from "./VersionSwitcher.vue";
import ReleaseBanner from "./ReleaseBanner.vue";
import TranslationNote from "../../../docs/.vitepress/theme/TranslationNote.vue";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "nav-bar-content-after": () => h(VersionSwitcher),
      "doc-before": () => [h(TranslationNote), h(ReleaseBanner)],
      "home-hero-before": () => h("div", { class: "translation-note-home" }, [h(TranslationNote)]),
    }),
} satisfies Theme;
