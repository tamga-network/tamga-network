import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // alt yollar önce (önek eşleşmesi: "@tamga-network/verifier" anahtarı "/web"i de yakalardı)
      "@tamga-network/verifier/web": r("./packages/verifier/src/web/index.ts"),
      "@tamga-network/verifier/zk": r("./packages/verifier/src/zk/index.ts"),
      "@tamga-network/issuer/client": r("./packages/issuer/src/client.ts"),
      "@tamga-network/core/sd-structure": r("./packages/core/src/sd-structure.ts"),
      "@tamga-network/core": r("./packages/core/src/index.ts"),
      "@tamga-network/trust/core": r("./packages/trust/src/core.ts"),
      "@tamga-network/trust": r("./packages/trust/src/index.ts"),
      "@tamga-network/sd-jwt": r("./packages/sd-jwt/src/index.ts"),
      "@tamga-network/issuer": r("./packages/issuer/src/index.ts"),
      "@tamga-network/schemas": r("./packages/schemas/src/index.ts"),
      "@tamga-network/wallet-core": r("./packages/wallet-core/src/index.ts"),
      "@tamga-network/verifier": r("./packages/verifier/src/index.ts"),
    },
  },
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "conformance/**/*.test.ts", "examples/**/*.test.ts"],
    globalSetup: ["./scripts/require-fixtures.ts"], // O1: CI'da TAMGA_REQUIRE_FIXTURES=1 → eksik PKI/liste sessiz atlama değil hata
    exclude: ["**/node_modules/**", "apps/wallet/**"],
    testTimeout: 20_000,
    hookTimeout: 60_000, // güven listesi yüklemesi (çapa günlüğü JWS doğrulaması) tam pakette 10 sn sınırını aşıyor // WUA/PKI testleri tam pakette 5 sn sınırına takılıyordu (2026-09-25)
  },
});
