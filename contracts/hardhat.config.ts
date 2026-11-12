/**
 * Hardhat yapılandırması — Tamga güven katmanı kontratları (SPEC-BC-0001).
 * Derleme ayarları: solc 0.8.24, evm cancun (ADR-0077: zincir Cancun kural setiyle kurulur; genesis `cancunTime: 0`, süreç
 * içi ağ da `cancun`), optimizer 200, metadata hash yok (deterministik bytecode).
 * Ağlar: `hardhat` (süreç içi; testler), `localhost` (`npm run node` → `npm run deploy:dev`), `besuDev` (yerel tek doğrulayıcılı
 * Besu QBFT ağı, `npm run chain:besu:start` → `npm run chain:besu:deploy`; adres TAMGA_BESU_RPC, varsayılan
 * http://127.0.0.1:8546), `besuStaging` (test/staging ağı, GUIDE-0018 yol C: `npm run deploy:network`; adres TAMGA_CHAIN_RPC_URL,
 * zincir kimliği TAMGA_CHAIN_KEYS anahtar haritasından; hesap tanımı YOK — anahtarlar haritadan, Hardhat test hesapları değil).
 * Üretim ağı TANIMLI DEĞİLDİR —
 * zincir ≥2 bağımsız validator operatörüyle kurulur (ADR-0009 K4); o gün Besu RPC adresi burada değil, operatörün gizli
 * yapılandırmasında olur.
 */
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "hardhat/config";

/** besuStaging: zincir kimliği anahtar haritasından (yoksa denetimi betik yapar — scripts/deploy-network.ts). */
const stagingChainId = (): number | undefined => {
  const f = process.env.TAMGA_CHAIN_KEYS;
  if (!f || !existsSync(f)) return undefined;
  const id = (JSON.parse(readFileSync(f, "utf8")) as { chainId?: unknown }).chainId;
  return typeof id === "number" ? id : undefined;
};

export default defineConfig({
  plugins: [hardhatEthers, hardhatEthersChaiMatchers, hardhatMocha, hardhatNetworkHelpers],
  paths: {
    sources: { solidity: ["src", "test/mocks"] },
    tests: { mocha: "test" },
  },
  solidity: {
    version: "0.8.24",
    // UUPS proxy'si (OpenZeppelin) dağıtım ve testlerde ayrı bir artifact olarak gerekir
    npmFilesToBuild: ["@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol"],
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
      metadata: { bytecodeHash: "none" },
      // SPEC-BC-0001 §9: depolama düzeni karşılaştırması (scripts/check-upgrade-safety.mjs → .storage/)
      outputSelection: { "*": { "*": ["storageLayout"] } },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
      // ADR-0077: testler zincirle aynı kural setinde koşar (varsayılan daha yeni bir sürümdür)
      hardfork: "cancun",
    },
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    // Yerel Besu QBFT geliştirme ağı (scripts/besu-dev.ps1). Hesaplar Hardhat'in herkese açık test anımsatıcısıdır
    // (genesis'te bakiyeli) — YALNIZ yerel; gerçek anahtar burada olmaz.
    besuDev: {
      type: "http",
      chainType: "l1",
      chainId: 31338,
      url: process.env.TAMGA_BESU_RPC ?? "http://127.0.0.1:8546",
      accounts: { mnemonic: "test test test test test test test test test test test junk", count: 10 },
    },
    // Test/staging ağı (network/testnet, `make-network.sh --keys generate`; zincir kimliği 31339). Hesap yok: imzacılar anahtar
    // haritasından (TAMGA_CHAIN_KEYS), Hardhat'in herkesçe bilinen anahtarları bu ağda kullanılmaz.
    besuStaging: {
      type: "http",
      chainType: "l1",
      chainId: stagingChainId(),
      url: process.env.TAMGA_CHAIN_RPC_URL ?? "http://127.0.0.1:8546",
      accounts: [],
    },
  },
});
