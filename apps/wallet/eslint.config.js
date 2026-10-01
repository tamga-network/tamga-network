// ESLint — Expo düz yapılandırması (npx expo lint). Kural: beceri .claude/skills/wallet-ux §7.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["_legacy/**", ".expo/**", ".expo-export-check/**", "node_modules/**"],
  },
  {
    rules: {
      "react-hooks/exhaustive-deps": "off", // akış başlatan efektler bilinçli olarak tek sefer çalışır
      "@typescript-eslint/array-type": "off", // wallet-core ile tutarlılık: Array<T> serbest
    },
  },
]);
