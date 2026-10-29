import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import { h } from "vue";
import VersionSwitcher from "./VersionSwitcher.vue";
import ReleaseBanner from "./ReleaseBanner.vue";
import TranslationNote from "../../../docs/.vitepress/theme/TranslationNote.vue";
// Yazı tipleri kendi kopyamız (ops/brand/fonts, OFL 1.1); Vite paketler — üçüncü taraf yazı tipi sunucusu yok.
import "../../../ops/brand/fonts/fonts.css";
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
