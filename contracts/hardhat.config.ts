/**
 * Hardhat yapılandırması — Tamga güven katmanı kontratları (SPEC-BC-0001).
 * Derleme ayarları eski foundry.toml ile aynı: solc 0.8.24, evm shanghai (Besu QBFT ile uyumlu; cancun'a geçmeden Besu
 * sürümü doğrulanır), optimizer 200, metadata hash yok (deterministik bytecode).
 * Ağlar: `hardhat` (süreç içi; testler), `localhost` (`npm run node` → `npm run deploy:dev`), `besuDev` (yerel tek doğrulayıcılı
 * Besu QBFT ağı, `npm run chain:besu:start` → `npm run chain:besu:deploy`; adres TAMGA_BESU_RPC, varsayılan
 * http://127.0.0.1:8546). Üretim ağı TANIMLI DEĞİLDİR —
 * zincir ≥2 bağımsız validator operatörüyle kurulur (ADR-0009 K4); o gün Besu RPC adresi burada değil, operatörün gizli
 * yapılandırmasında olur.
 */
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatEthersChaiMatchers from "@nomicfoundation/hardhat-ethers-chai-matchers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import { defineConfig } from "hardhat/config";

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
      evmVersion: "shanghai",
      metadata: { bytecodeHash: "none" },
      // SPEC-BC-0001 §9: depolama düzeni karşılaştırması (scripts/check-upgrade-safety.mjs → .storage/)
      outputSelection: { "*": { "*": ["storageLayout"] } },
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainType: "l1",
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
  },
});
