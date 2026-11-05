/**
 * Test/staging ağı dağıtımı — GUIDE-0018 yol C (network/testnet/bootstrap-governance.sh çağırır):
 *   TAMGA_CHAIN_KEYS=<anahtar haritası> TAMGA_CHAIN_RPC_URL=http://127.0.0.1:8546 \
 *     npx hardhat run scripts/deploy-network.ts --network besuStaging        # npm run deploy:network
 * Adresler deployments/besuStaging.json (deploy-dev.ts'in besuDev.json deseni).
 *
 * Anahtarlar `TAMGA_CHAIN_KEYS` haritasından (`tamga-chain-keys/1`, apps/chain-indexer/src/chain-keys.ts; make-network.sh
 * `--keys generate` yazar): dağıtan, kurucu devletlerin doğrulayıcıları ve delegeleri, liste çapası yazıcıları ve eşik. Hardhat'in
 * herkesçe bilinen test hesapları bu yolda KULLANILMAZ. Yalnız test/staging zinciri: 31337/31338 (yerel, Hardhat anahtarları →
 * deploy-dev.ts) ve öteki her kimlik reddedilir. Üretim dağıtımı burada tanımlı değildir (ADR-0009 K4; üretim anahtarları HSM'de).
 * Kurulum sırası: scripts/lib/network-setup.ts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { network } from "hardhat";

import { STAGING_CHAIN_IDS, loadChainKeys } from "../../apps/chain-indexer/src/chain-keys.js";
import { LOCAL_CHAIN_IDS } from "../../apps/chain-indexer/src/local-dev.js";
import { setupStagingNetwork } from "./lib/network-setup.js";

const conn = await network.create();
const { ethers } = conn;
if (conn.networkName !== "besuStaging") throw new Error(`yalnız --network besuStaging (bu: ${conn.networkName})`);
const keysFile = process.env.TAMGA_CHAIN_KEYS;
if (!keysFile)
  throw new Error("TAMGA_CHAIN_KEYS gerekir (anahtar haritası; network/testnet/make-network.sh --keys generate)");
const keys = loadChainKeys(keysFile);
const chainId = Number((await ethers.provider.getNetwork()).chainId);
if (LOCAL_CHAIN_IDS.has(chainId))
  throw new Error(`chainId ${chainId} yerel geliştirme zinciri — Hardhat test anahtarlarıyla deploy-dev.ts kullanılır`);
if (!STAGING_CHAIN_IDS.has(chainId))
  throw new Error(`chainId ${chainId} test/staging zinciri değil — üretim dağıtımı bu betikle yapılmaz (ADR-0009 K4)`);
if (chainId !== keys.map.chainId) throw new Error(`zincir ${chainId}, anahtar haritası ${keys.map.chainId}`);

const wallet = (ref: { address: string; key: string }) => new ethers.Wallet(keys.privateKey(ref), ethers.provider);
const deployer = wallet(keys.map.deployer);
const founderKeys = keys.map.states.filter((s) => s.founder);
console.log(`ağ: ${conn.networkName} (chainId ${chainId}) · dağıtan: ${deployer.address} · harita: ${keysFile}`);

const d = await setupStagingNetwork(ethers, {
  deployer,
  founders: founderKeys.map((s) => ({ code: s.code, validator: wallet(s.validator), delegate: s.delegate.address })),
  anchorers: keys.map.anchor.anchorers.map((a) => a.address),
  threshold: keys.map.anchor.threshold,
});
for (const [name, addr] of Object.entries(d.trust.addresses)) console.log(`  ${name.padEnd(24)} ${addr}`);
console.log(
  `  ${"TrustListAnchorRegistry".padEnd(24)} ${d.anchorRegistry}  (eşik ${keys.map.anchor.threshold}, yazıcı: ${keys.map.anchor.anchorers.length})`,
);
console.log(
  `  kurucular: ${founderKeys.map((s) => s.code).join(", ")} · kurucular arası tanıma: ${d.founderRecognition}`,
);

const out = {
  network: conn.networkName,
  chainId,
  deployedAt: new Date().toISOString(),
  deployer: deployer.address,
  founders: founderKeys.map((s) => ({ code: s.code, validator: s.validator.address, delegate: s.delegate.address })),
  contracts: { ...d.trust.addresses, TrustListAnchorRegistry: d.anchorRegistry },
  anchor: {
    registry: d.anchorRegistry,
    requiredConfirmations: keys.map.anchor.threshold,
    anchorers: keys.map.anchor.anchorers.map((a) => a.address),
    admin: "Governance",
  },
  founderRecognition: d.founderRecognition,
  note: "Test/staging dağıtımı (GUIDE-0018 yol C) — üretim zinciri yok (ADR-0009 K4). Anahtarlar make-network.sh --keys generate ile üretildi.",
};
const dir = join(import.meta.dirname, "..", "deployments");
mkdirSync(dir, { recursive: true });
const file = join(dir, `${conn.networkName}.json`);
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`adresler → ${file}`);
