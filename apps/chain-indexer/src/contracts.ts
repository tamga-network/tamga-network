/**
 * Güven katmanı kontratlarına bağlantı (SPEC-BC-0001 §8 topolojisi) — ABI kopyaları `abi/` (contracts/scripts/export-abi.mjs
 * üretir; `contracts:check` farkı yakalar), adresler dağıtım dosyasından (`contracts/deployments/<ağ>.json` biçimi). Zincir
 * yeniden oynatması (ADR-0073 K1, `trust:chain-replay`) ve indeksleyici (ADR-0074 K5) aynı bağlantıyı kullanır.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Contract, type ContractRunner, type InterfaceAbi } from "ethers";

const ABI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "abi");
const abi = (name: string): InterfaceAbi =>
  (JSON.parse(readFileSync(resolve(ABI_DIR, `${name}.json`), "utf8")) as { abi: InterfaceAbi }).abi;

/** Kayıt adı → ABI dosyası. Adlar dağıtım dosyasındaki anahtarlarla aynıdır. */
export const REGISTRY_ABIS = {
  Governance: "governance",
  RootCARegistry: "root-ca-registry",
  SchemaRegistry: "schema-registry",
  IssuerRegistry: "issuer-registry",
  RelyingPartyRegistry: "relying-party-registry",
  CrossRecognition: "cross-recognition",
  StatusListRegistry: "status-list-registry",
  NetworkRegistry: "network-registry",
  TrustQueries: "trust-queries",
} as const;
export type RegistryName = keyof typeof REGISTRY_ABIS;
export type TrustAddresses = Record<RegistryName, string>;

/** Göç kipi olan kayıtlar (ADR-0073 K1: RootCA/Issuer/Schema/RelyingParty/CrossRecognition/StatusList + ağ düzeyi kayıt). */
export const MIGRATING_REGISTRIES: RegistryName[] = [
  "RootCARegistry",
  "SchemaRegistry",
  "IssuerRegistry",
  "RelyingPartyRegistry",
  "CrossRecognition",
  "StatusListRegistry",
  "NetworkRegistry",
];

export type TrustContracts = Record<RegistryName, Contract>;

/**
 * Sağlayıcı seçenekleri: ethers'ın istek önbelleği KAPALI. ethers v6 aynı istekleri (yöntem + parametre) 250 ms boyunca tek
 * cevapla paylaşır; durum değiştiren yürütücüde bu bayat okuma ve bayat gaz tahmini demektir. Örnek (CI, 2026-11-04): aynı
 * doğrulayıcıya aynı kayıt verisi dönem 0'da ve yeniden kayıttan sonra dönem 1'de yazılır — çağrı verisi birebir aynı; hızlı
 * makinede ikinci yazımın gaz tahmini birincinin önbellekteki değeri (dönem anahtarı özeti hesaplanmadan) çıktı ve işlem
 * proxy içinde gazı bitip veri taşımadan geri alındı. Zincire yazan ya da yazımdan sonra okuyan her sağlayıcı bununla kurulur.
 */
export const UNCACHED_PROVIDER = { cacheTimeout: -1 } as const;

/** Dağıtım dosyasının `contracts` bölümünden adresler (eksik ad → hata). */
export function addressesFrom(deployment: { contracts: Record<string, string> }): TrustAddresses {
  const out = {} as TrustAddresses;
  for (const k of Object.keys(REGISTRY_ABIS) as RegistryName[]) {
    const a = deployment.contracts[k];
    if (!a || !/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error(`chain: dağıtım dosyasında ${k} adresi yok`);
    out[k] = a;
  }
  return out;
}

export function connectTrustContracts(addresses: TrustAddresses, runner: ContractRunner): TrustContracts {
  const out = {} as TrustContracts;
  for (const [k, file] of Object.entries(REGISTRY_ABIS) as Array<[RegistryName, string]>)
    out[k] = new Contract(addresses[k], abi(file), runner);
  return out;
}

/** Kontrat enum'ları (SPEC-BC-0001; değerler yalnız sona eklenir). */
export const IssuerStatus = { NONE: 0, ACTIVE: 1, SUSPENDED: 2, REVOKED: 3 } as const;
export const CAStatus = { NONE: 0, ACTIVE: 1, SUSPENDED: 2, RETIRED: 3, REVOKED: 4 } as const;
export const SchemaStatus = { NONE: 0, ACTIVE: 1, DEPRECATED: 2, REVOKED: 3 } as const;
export const SchemaTier = { NETWORK: 0, NATIONAL: 1 } as const;
export const RPStatus = { NONE: 0, ACTIVE: 1, SUSPENDED: 2, REVOKED: 3 } as const;
export const RecognitionMode = { NONE: 0, FULL: 1, CATEGORY_LIMITED: 2 } as const;
export const PeriodAction = { NONE: 0, REASSIGNMENT: 1, RE_REGISTRATION: 2 } as const;
export const MigrationPhase = { NOT_STARTED: 0, OPEN: 1, CLOSED: 2 } as const;
export const RecordKind = { NONE: 0, WALLET_PROVIDER: 1, WALLET_PROVIDER_KEY: 2 } as const;
export const RecordStatus = {
  NONE: 0,
  ACTIVE: 1,
  SUSPENDED: 2,
  REVOKED: 3,
  RETIRED: 4,
  RESERVED: 5,
  PROVISIONAL: 6,
  DEPRECATED: 7,
  DESIGNATED: 8,
} as const;
export const ISSUER_CATEGORIES = [
  "GOVERNMENT",
  "IDENTITY",
  "EDUCATION",
  "HEALTH",
  "FINANCE",
  "LOGISTICS",
  "OTHER",
  "EVENTS",
] as const;
export const ISSUER_CLASSES = ["NONE", "PUB", "QUALIFIED", "EAA"] as const;
export const PRESENTATION_FORMATS = ["dc+sd-jwt", "mso_mdoc", "mso_mdoc_zk"] as const;
