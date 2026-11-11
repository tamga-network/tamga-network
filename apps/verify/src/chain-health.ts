/**
 * Zincir çapası sağlık bilgisi (C32 (7); ADR-0051 K1.2/K5, CH5): doğrulayıcının yüklü imzalı listeleri (`lotl.jws`, `tl-<cc>.jws`)
 * zincirde onaylı çapalanmış mı — `/healthz` alanı `chain`. İsteğe bağlı ek güvencedir: doğrulama sonucunu ve `ok`'u değiştirmez;
 * `NO` (onaylı FARKLI özet) yalnız alarmdır (CH1). Bayrak kapalıyken (TAMGA_CHAIN_ENABLED=0, bugünkü üretim) ve sandbox'ta
 * (PJ4: sandbox zincire yazılmaz) cevap `UNKNOWN`'dur ve zincire bağlanılmaz.
 *
 * Zincir istemcisi (ethers) bu uygulamanın bağımlılığı değildir: bayrak açıkken liste yayıncısının denetimi
 * (`apps/trust-publisher/src/chain/verify.ts` `checkDistAnchored`) dinamik yüklenir.
 */
import type { Tri } from "@tamga-network/trust";

export interface ChainListCheck {
  file: string;
  version: number;
  anchored: Tri;
  reason: string;
}

export interface ChainHealth {
  enabled: boolean;
  anchored: Tri;
  reason: string;
  checked_at: string | null;
  lists: ChainListCheck[];
}

export type ChainChecker = () => Promise<ChainListCheck[]>;

export const CHAIN_DISABLED_REASON = "zincir kapalı (TAMGA_CHAIN_ENABLED=0)";
export const CHAIN_SANDBOX_REASON = "sandbox listeleri zincire yazılmaz (ADR-0074 PJ4)";
/**
 * `/healthz` herkese açıktır: hata metni (RPC adresi, kimlik bilgili URL, iç ana makine adı taşıyabilir) oraya yazılmaz — sabit
 * gerekçe döner, ayrıntı servisin günlüğüne gider (kontrol 2026-11-10).
 */
export const CHAIN_UNREACHABLE_REASON = "zincir erişilemedi";
export const CHAIN_MISCONFIGURED_REASON = "zincir ayarı eksik";
const logDetail = (what: string, e: unknown) =>
  console.error(`[verify] ${what}: ${(e as Error)?.message ?? String(e)}`);

/** Toplu cevap: bir `NO` → NO; hepsi `YES` (ve en az bir liste) → YES; aksi UNKNOWN. */
export function summarizeChain(lists: ChainListCheck[]): { anchored: Tri; reason: string } {
  const no = lists.filter((l) => l.anchored === "NO");
  if (no.length)
    return {
      anchored: "NO",
      reason: `onaylı çapa farklı özet: ${no.map((l) => `${l.file} v${l.version}`).join(", ")} — imzalı liste geçerli (CH1)`,
    };
  if (lists.length && lists.every((l) => l.anchored === "YES"))
    return { anchored: "YES", reason: "yüklü listelerin hepsi zincirde onaylı çapalı" };
  const unk = lists.filter((l) => l.anchored === "UNKNOWN");
  return {
    anchored: "UNKNOWN",
    reason: lists.length ? `${unk.map((l) => `${l.file}: ${l.reason}`).join("; ")}` : "denetlenecek liste yok",
  };
}

export class ChainHealthMonitor {
  private state: ChainHealth;
  constructor(
    private readonly checker: ChainChecker | null,
    disabledReason = CHAIN_DISABLED_REASON,
    private readonly now: () => Date = () => new Date(),
    /** hata ayrıntısı buraya (varsayılan: stderr); `/healthz` cevabına girmez */
    private readonly onError: (e: unknown) => void = (e) => logDetail("zincir denetimi başarısız", e),
  ) {
    this.state = {
      enabled: !!checker,
      anchored: "UNKNOWN",
      reason: checker ? "henüz denetlenmedi" : disabledReason,
      checked_at: null,
      lists: [],
    };
  }
  current(): ChainHealth {
    return this.state;
  }
  async refresh(): Promise<ChainHealth> {
    if (!this.checker) return this.state;
    try {
      const lists = await this.checker();
      this.state = { enabled: true, ...summarizeChain(lists), checked_at: this.now().toISOString(), lists };
    } catch (e) {
      // erişilemeyen zincir → UNKNOWN (kötüleştirmez); ayrıntı günlüğe, herkese açık cevaba sabit metin
      this.onError(e);
      this.state = {
        enabled: true,
        anchored: "UNKNOWN",
        reason: CHAIN_UNREACHABLE_REASON,
        checked_at: this.now().toISOString(),
        lists: [],
      };
    }
    return this.state;
  }
}

/**
 * Ortamdan denetçi: bayrak kapalı ya da sandbox → null (monitör `UNKNOWN` ve gerekçe döner). Bayrak açıksa liste yayıncısının
 * zincir istemcisi (TAMGA_CHAIN_RPC_URL, TAMGA_CHAIN_ANCHOR_REGISTRY) ile güven listesi klasöründeki listeler denetlenir.
 */
export async function chainHealthFromEnv(
  network: "production" | "sandbox" | undefined,
  trustDist: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ChainHealthMonitor> {
  if (env.TAMGA_CHAIN_ENABLED !== "1") return new ChainHealthMonitor(null, CHAIN_DISABLED_REASON);
  if (network === "sandbox") return new ChainHealthMonitor(null, CHAIN_SANDBOX_REASON);
  const { chainClientFromEnv } = await import("../../trust-publisher/src/chain/cli.js");
  const { checkDistAnchored } = await import("../../trust-publisher/src/chain/verify.js");
  let client;
  try {
    client = chainClientFromEnv(env, false);
  } catch (e) {
    // eksik ayar doğrulayıcıyı durdurmaz: sağlık sayfası UNKNOWN + gerekçe
    logDetail("zincir ayarı eksik", e);
    return new ChainHealthMonitor(null, CHAIN_MISCONFIGURED_REASON);
  }
  return new ChainHealthMonitor(async () => checkDistAnchored(client, "production", trustDist));
}
