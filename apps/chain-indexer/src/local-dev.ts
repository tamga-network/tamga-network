/**
 * YALNIZ yerel geliştirme zinciri (Hardhat 31337, yerel Besu 31338; scripts/besu-dev.ps1, contracts/scripts/deploy-dev.ts):
 * dağıtım dosyasındaki kurucu doğrulayıcıları ve delegeleri Hardhat'in herkesçe bilinen test anımsatıcısından türetilen
 * cüzdanlarla eşler. Gerçek ağda anahtarlar devletlerdedir ve bu dosya kullanılmaz (`LOCAL_DEV_CHAIN_IDS` dışında hata).
 */
import { BrowserProvider, HDNodeWallet, type Eip1193Provider, type Provider, type Signer } from "ethers";

import { UNCACHED_PROVIDER } from "./contracts.js";
import type { ReplaySigners } from "./replay-exec.js";

/** Yerel geliştirme zincirleri (bellek içi istemci 0 dahil değil: burada gerçek zincir). */
export const LOCAL_CHAIN_IDS: ReadonlySet<number> = new Set([31337, 31338]);
/** Hardhat'in herkese açık test anımsatıcısı (genesis'te bakiyeli; gerçek anahtar DEĞİL). */
export const DEV_MNEMONIC = "test test test test test test test test test test test junk";

/** Süreç içi zincirin EIP-1193 arayüzünden ethers sağlayıcısı (istek önbelleği kapalı — `UNCACHED_PROVIDER`). */
export const providerFromEip1193 = (p: Eip1193Provider) => new BrowserProvider(p, undefined, UNCACHED_PROVIDER);

/**
 * Test hesapları. NonceManager yok: yürütücü her işlemin makbuzunu bekler, sıra numarası her gönderimde düğümden okunur (önbellekli
 * sayaç yerel Besu duman testinde düğümle ayrıştı ve "nonce too low" verdi — 2026-11-04).
 */
export function devWallets(provider: Provider, count = 10): Signer[] {
  return Array.from({ length: count }, (_, i) =>
    HDNodeWallet.fromPhrase(DEV_MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`).connect(provider),
  );
}

export interface DevDeployment {
  chainId: number;
  founders: Array<{ code: string; validator: string; delegate: string }>;
  contracts: Record<string, string>;
  deployer: string;
}

/**
 * Dağıtım dosyasından yeniden oynatma imzacıları: devlet → delegesi, göç yürütücüsü = dağıtan (#0), Governance = kurucu
 * doğrulayıcıları (öneren ilk kurucu). Yerel olmayan zincirde hata.
 */
export async function localDevSigners(provider: Provider, d: DevDeployment): Promise<ReplaySigners> {
  const chainId = Number((await provider.getNetwork()).chainId);
  if (!LOCAL_CHAIN_IDS.has(chainId))
    throw new Error(`chain: yerel geliştirme imzacıları yalnız yerel zincirde (chainId ${chainId})`);
  const wallets = devWallets(provider);
  const byAddr = new Map<string, Signer>();
  for (const w of wallets) byAddr.set((await w.getAddress()).toLowerCase(), w);
  const pick = (a: string) => {
    const w = byAddr.get(a.toLowerCase());
    if (!w) throw new Error(`chain: ${a} test hesaplarından değil`);
    return w;
  };
  const validators = d.founders.map((f) => pick(f.validator));
  return {
    state: (cc) => {
      const f = d.founders.find((x) => x.code === cc);
      if (!f) throw new Error(`chain: ${cc} dağıtımda kurucu değil (delegesi yok)`);
      return pick(f.delegate);
    },
    executor: pick(d.deployer),
    governance: { proposer: validators[0], voters: validators },
  };
}
