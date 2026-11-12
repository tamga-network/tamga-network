/**
 * Test/staging ağı kurulumu (GUIDE-0018 yol C; scripts/deploy-network.ts) — gerçek ağın kurulum sırasıyla, Hardhat'in herkesçe
 * bilinen hesapları OLMADAN. Testler (test/staging-setup.test.ts) aynı fonksiyonu süreç içi zincirde çağırır.
 *
 *   1) güven katmanı (scripts/lib/deploy.ts — SPEC-BC-0001 §8 sırası), kurucular oy olmadan ACTIVE (ADR-0002 #3); en az iki
 *      kurucu (ADR-0076 GC4);
 *   2) her kurucunun delege anahtarı (kendi doğrulayıcısıyla, `setDelegateKeys`);
 *   3) kurucular arası FULL tanıma Governance önerisiyle (`proposeFounderRecognition` → 2/3 oy → `execute`, ADR-0055 K3) —
 *      yerel betiğin (deploy-dev.ts) devlet başına `setRecognition` kısa yolu burada kullanılmaz;
 *   4) TrustListAnchorRegistry: yönetici = Governance kontratı (yazıcı ve eşik değişikliği yalnız oyla, ADR-0055 K3), yazıcılar ve
 *      eşik haritadan (ADR-0051 K3; ADR-0053 AC4 eşik ≤ yazıcı sayısı).
 * Öteki devletlerin kabulü (`proposeStateAdmission`) ve göç penceresi (ADR-0073) dağıtımın parçası değildir: kabul
 * network/testnet/testnet.mjs `admit --keys`, pencere `trust:chain-replay` ile.
 */
import type { HardhatEthers } from "@nomicfoundation/hardhat-ethers/types";
import type { BaseContract, Signer } from "ethers";

import { MIN_FOUNDERS, deployed, deployTrustLayer, stateCode, type TrustLayerDeployment } from "./deploy.js";

export interface StagingFounder {
  code: string;
  /** devletin doğrulayıcı anahtarı (= QBFT düğüm anahtarı, ADR-0052 K2) */
  validator: Signer;
  /** devletin delege adresi */
  delegate: string;
}

export interface StagingSetup {
  deployer: Signer;
  founders: StagingFounder[];
  anchorers: string[];
  threshold: number;
}

export interface StagingDeployment {
  trust: TrustLayerDeployment;
  anchorRegistry: string;
  founderRecognition: "governance";
}

/** Governance önerisini açar (ilk imzacı), herkes oylar, yürütür. Önerinin kimliğini döndürür. */
export async function passGovernanceProposal(
  governance: BaseContract,
  voters: Signer[],
  propose: (g: any) => Promise<{ wait(): Promise<any> }>,
): Promise<string> {
  const rc = await (await propose(governance.connect(voters[0]))).wait();
  const ev = rc.logs
    .map((l: any) => {
      try {
        return governance.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((e: any) => e?.name === "ProposalCreated");
  if (!ev) throw new Error("ProposalCreated olayı yok");
  const id = ev.args[0] as string;
  for (const v of voters) await (await (governance.connect(v) as any).vote(id, true)).wait();
  await (await (governance.connect(voters[0]) as any).execute(id)).wait();
  return id;
}

export async function setupStagingNetwork(ethers: HardhatEthers, s: StagingSetup): Promise<StagingDeployment> {
  if (s.founders.length < MIN_FOUNDERS)
    throw new Error(`en az ${MIN_FOUNDERS} kurucu gerekir (ADR-0076 GC4) — verilen: ${s.founders.length}`);
  if (!Number.isInteger(s.threshold) || s.threshold < 1 || s.threshold > s.anchorers.length)
    throw new Error(`liste çapası eşiği ${s.threshold}: 1 ile yazıcı sayısı (${s.anchorers.length}) arasında olmalı`);
  const founders = await Promise.all(
    s.founders.map(async (f) => ({ code: f.code, validator: await f.validator.getAddress() })),
  );
  const trust = await deployTrustLayer(ethers, s.deployer, founders, s.founders[0].validator);

  for (const f of s.founders)
    await (
      await (trust.governance.connect(f.validator) as any).setDelegateKeys(stateCode(ethers, f.code), [f.delegate])
    ).wait();

  const reg = trust.addresses.CrossRecognition;
  const codes = s.founders.map((f) => stateCode(ethers, f.code));
  await passGovernanceProposal(
    trust.governance,
    s.founders.map((f) => f.validator),
    (g) => g.proposeFounderRecognition(reg, codes),
  );

  const impl = await deployed(ethers, "TrustListAnchorRegistry", [], s.deployer);
  const init = impl.interface.encodeFunctionData("initialize", [trust.addresses.Governance, s.anchorers, s.threshold]);
  const proxy = await deployed(ethers, "ERC1967Proxy", [await impl.getAddress(), init], s.deployer);
  return { trust, anchorRegistry: await proxy.getAddress(), founderRecognition: "governance" };
}
