/**
 * Yerel geliştirme dağıtımı — YALNIZ dev/test ağları (hardhat süreç içi, `npm run node` → localhost ya da yerel Besu → besuDev).
 *   npx hardhat run scripts/deploy-dev.ts                       # süreç içi ağ (adresler o süreçle ölür; duman testi)
 *   npx hardhat run scripts/deploy-dev.ts --network localhost   # çalışan Hardhat düğümüne; adresler deployments/localhost.json
 *   npx hardhat run scripts/deploy-dev.ts --network besuDev     # yerel Besu QBFT ağına (npm run chain:besu:deploy);
 *                                                               # adresler deployments/besuDev.json
 *
 * Kurulum: kurucular TR + KZ (Hardhat hesapları #1, #2 validator), TR delegesi #3, KZ delegesi #4; kurucular arası FULL tanıma
 * (dev betiği her devletin kendi `setRecognition` çağrısıyla kurar; gerçek ağda `proposeFounderRecognition`, ADR-0055 K3). Ortam:
 *   TAMGA_CHAIN_DEV_THRESHOLD   liste çapası kaydının onay eşiği (varsayılan 1; üretimde ≥2 — ADR-0051 K3)
 * Üretim ağı burada tanımlı değildir ve bu betik üretim için KULLANILMAZ (ADR-0009 K4).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { network } from "hardhat";

import { deployed, deployTrustLayer, stateCode } from "./lib/deploy.js";

const conn = await network.create();
const { ethers } = conn;
const [deployer, trValidator, kzValidator, trDelegate, kzDelegate] = await ethers.getSigners();
const chainId = Number((await ethers.provider.getNetwork()).chainId);
console.log(`ağ: ${conn.networkName} (chainId ${chainId}) · dağıtan: ${await deployer.getAddress()}`);

const founders = [
  {
    code: "TR",
    validator: await trValidator.getAddress(),
    delegate: await trDelegate.getAddress(),
    signer: trValidator,
  },
  {
    code: "KZ",
    validator: await kzValidator.getAddress(),
    delegate: await kzDelegate.getAddress(),
    signer: kzValidator,
  },
];
const d = await deployTrustLayer(ethers, deployer, founders, trValidator);
for (const [name, addr] of Object.entries(d.addresses)) console.log(`  ${name.padEnd(22)} ${addr}`);

// Delege anahtarları (devletin iç işi) ve kurucular arası FULL tanıma
const TR = stateCode(ethers, "TR");
const KZ = stateCode(ethers, "KZ");
await (await (d.governance.connect(trValidator) as any).setDelegateKeys(TR, [founders[0].delegate])).wait();
await (await (d.governance.connect(kzValidator) as any).setDelegateKeys(KZ, [founders[1].delegate])).wait();
await (await (d.recognition.connect(trDelegate) as any).setRecognition(TR, KZ, 1, [])).wait();
await (await (d.recognition.connect(kzDelegate) as any).setRecognition(KZ, TR, 1, [])).wait();
console.log("  delege anahtarları ve TR↔KZ FULL tanıma yazıldı");

// Liste çapası kaydı (ADR-0051): dev'de yönetici = dağıtan, yazıcı = dağıtan, eşik 1 (üretimde ≥ 2 — K3)
const threshold = Number(process.env.TAMGA_CHAIN_DEV_THRESHOLD ?? 1);
// ADR-0053 AC4: eşik yazıcı sayısını aşamaz — eşik > 1 ise dağıtana ek olarak Hardhat hesapları #5.. yazıcı olur
const anchorers = [deployer, ...(await ethers.getSigners()).slice(5, 5 + Math.max(0, threshold - 1))];
const anchorImpl = await deployed(ethers, "TrustListAnchorRegistry", [], deployer);
const anchorInit = anchorImpl.interface.encodeFunctionData("initialize", [
  await deployer.getAddress(),
  await Promise.all(anchorers.map((a) => a.getAddress())),
  threshold,
]);
const anchorProxy = await deployed(ethers, "ERC1967Proxy", [await anchorImpl.getAddress(), anchorInit], deployer);
const anchorRegistry = await anchorProxy.getAddress();
console.log(
  `  ${"TrustListAnchorRegistry".padEnd(22)} ${anchorRegistry}  (eşik ${threshold}, yazıcı: ${anchorers.length})`,
);

const out = {
  network: conn.networkName,
  chainId,
  deployedAt: new Date().toISOString(),
  deployer: await deployer.getAddress(),
  founders: founders.map(({ code, validator, delegate }) => ({ code, validator, delegate })),
  contracts: { ...d.addresses, TrustListAnchorRegistry: anchorRegistry },
  anchor: { registry: anchorRegistry, requiredConfirmations: threshold, anchorers: [await deployer.getAddress()] },
  note: "Yerel geliştirme dağıtımı — üretim zinciri yok (ADR-0009 K4). Hesaplar Hardhat'ın herkese açık test hesaplarıdır.",
};
const dir = join(import.meta.dirname, "..", "deployments");
mkdirSync(dir, { recursive: true });
const file = join(dir, `${conn.networkName}.json`);
writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`adresler → ${file}`);
