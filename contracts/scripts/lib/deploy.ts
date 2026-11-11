/**
 * Güven katmanı dağıtımı — SPEC-BC-0001 §8 topolojisi, SIRA BAĞLAYICIDIR (eski Deploy.s.sol'un TypeScript karşılığı).
 * Testler (test/helpers/fixture.ts) ve yerel geliştirme dağıtımı (scripts/deploy-dev.ts) aynı fonksiyonu kullanır; böylece
 * test edilen kurulum ile dağıtılan kurulum aynıdır.
 *
 * Üretim dağıtımı YOKTUR: zincir ≥2 bağımsız validator operatörüyle kurulur (ADR-0009 K4). Bu dosya yalnız yerel/dev ağ içindir.
 */
import type { HardhatEthers } from "@nomicfoundation/hardhat-ethers/types";
import type { BaseContract, Signer } from "ethers";

export interface Founder {
  /** ISO 3166-1 alpha-2, ör. "TR" */
  code: string;
  /** QBFT validator adresi (Governance oyu bu adresten verilir) */
  validator: string;
}

export interface TrustLayerDeployment {
  governance: BaseContract;
  rootCAs: BaseContract;
  schemas: BaseContract;
  issuers: BaseContract;
  relyingParties: BaseContract;
  recognition: BaseContract;
  statusLists: BaseContract;
  networkRegistry: BaseContract;
  trustQueries: BaseContract;
  addresses: Record<string, string>;
}

/** "TR" → bytes2 (0x5452). */
export function stateCode(ethers: HardhatEthers, code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) throw new Error(`devlet kodu iki büyük harf olmalı: ${code}`);
  return ethers.hexlify(ethers.toUtf8Bytes(code));
}

/**
 * Dağıtır ve işlemin bloğa girmesini bekler. Hardhat süreç içi ağı anında kazdığı için orada bekleme hemen döner; Besu
 * (QBFT, blok süresi 2 sn) gibi gerçek bir düğümde ise sonraki adım (ör. proxy'nin `initialize` gaz tahmini) henüz kodu
 * olmayan adrese bakıp `ERC1967InvalidImplementation` verirdi.
 */
export async function deployed(
  ethers: HardhatEthers,
  name: string,
  args: unknown[],
  deployer: Signer,
): Promise<BaseContract> {
  const c = await ethers.deployContract(name, args, deployer);
  return c.waitForDeployment();
}

/**
 * Governance → SchemaRegistry bağı beklenen adreste mi (kurulum denetimi). `setSchemaRegistry` bir kez ve herhangi bir üye
 * validator'ı tarafından çağrılabilir; yanlış adrese kurulmuş bağ yalnız protokol yükseltmesiyle (2/3) düzelir — bu yüzden
 * dağıtım ve ağ kurulumu bağı okuyup doğrular, tutmuyorsa durur.
 */
export async function assertSchemaRegistryBound(governance: BaseContract, expected: string): Promise<void> {
  const got = String(await (governance as any).schemaRegistry());
  if (got.toLowerCase() !== expected.toLowerCase())
    throw new Error(
      `deploy: Governance.schemaRegistry ${got} — beklenen ${expected}; dağıtım geçersiz, yeniden dağıtın`,
    );
}

/**
 * Bütün kontratları UUPS (ERC1967) proxy arkasında dağıtır ve bağlar.
 * @param deployer İmplementasyon ve proxy'leri dağıtan hesap. `setSchemaRegistry` `onlyValidator` olduğundan (review R5)
 *                 ilk kurucunun validator'ı bu çağrıyı yapar; `founders[0].validator` için bir Signer verilmelidir.
 */
export async function deployTrustLayer(
  ethers: HardhatEthers,
  deployer: Signer,
  founders: Founder[],
  firstValidatorSigner: Signer,
): Promise<TrustLayerDeployment> {
  if (founders.length === 0) throw new Error("en az bir kurucu gerekir");
  const codes = founders.map((f) => stateCode(ethers, f.code));
  const validators = founders.map((f) => f.validator);

  const proxy = async (name: string, initArgs: unknown[]) => {
    const impl = await deployed(ethers, name, [], deployer);
    const data = impl.interface.encodeFunctionData("initialize", initArgs);
    const p = await deployed(ethers, "ERC1967Proxy", [await impl.getAddress(), data], deployer);
    return ethers.getContractAt(name, await p.getAddress(), deployer);
  };

  // 1) Governance — ISovereignty'yi de uygular; herkes ona bakar.
  const governance = await proxy("Governance", [codes, validators]);
  const gov = await governance.getAddress();
  // 2) RootCARegistry — IssuerRegistry buna bağımlı.
  const rootCAs = await proxy("RootCARegistry", [gov, gov]);
  // 3) SchemaRegistry — IssuerRegistry buna bağımlı.
  const schemas = await proxy("SchemaRegistry", [gov, gov]);
  // 4) IssuerRegistry — 2 ve 3'ten sonra.
  const issuers = await proxy("IssuerRegistry", [gov, gov, await rootCAs.getAddress(), await schemas.getAddress()]);
  // 5) Geri kalanlar
  const relyingParties = await proxy("RelyingPartyRegistry", [gov, gov, await issuers.getAddress()]);
  const recognition = await proxy("CrossRecognition", [gov, gov, await issuers.getAddress()]);
  const statusLists = await proxy("StatusListRegistry", [await issuers.getAddress(), gov]);
  // ADR-0074 K3: ağ düzeyi kayıtlar (yalnız Governance önerisiyle ya da göç kipinde göç yürütücüsüyle)
  const networkRegistry = await proxy("NetworkRegistry", [gov]);

  // 6) Governance → SchemaRegistry bağı (BİR KEZ, geri alınamaz; onlyValidator — R5)
  //    Kontrol 2026-11-10: bağ dağıtım ile bu çağrı arasında başka bir validator tarafından BAŞKA bir adrese kurulmuş olabilir
  //    (tek seferlik; geri alınamaz). Zaten kuruluysa çağrı yapılmaz; her durumda bağın beklenen kayda gittiği doğrulanır —
  //    değilse dağıtım geçersizdir (yeniden dağıtılır).
  const bound = String(await (governance as any).schemaRegistry());
  if (/^0x0+$/.test(bound))
    await (
      await (governance.connect(firstValidatorSigner) as any).setSchemaRegistry(await schemas.getAddress())
    ).wait();
  await assertSchemaRegistryBound(governance, await schemas.getAddress());

  // 7) Kurucular arası FULL tanıma (ADR-0002 #3) — `onlyGovernance`: Governance kontratının kendisi çağırmalıdır.
  //    Gerçek ağda bu, Governance önerisiyle yapılır: `proposeFounderRecognition` → 2/3 oy → `execute` (ADR-0055 K3).
  //    Dev betiği kurucular arası tanımayı her devletin kendi `setRecognition` çağrısıyla kurar (oy turu gerektirmez).

  // 8) Doğrulayıcı cephesi (yükseltilemez, durumsuz)
  const trustQueries = await deployed(
    ethers,
    "TrustQueries",
    [
      await issuers.getAddress(),
      await schemas.getAddress(),
      await recognition.getAddress(),
      await statusLists.getAddress(),
    ],
    deployer,
  );

  const addresses: Record<string, string> = {
    Governance: gov,
    RootCARegistry: await rootCAs.getAddress(),
    SchemaRegistry: await schemas.getAddress(),
    IssuerRegistry: await issuers.getAddress(),
    RelyingPartyRegistry: await relyingParties.getAddress(),
    CrossRecognition: await recognition.getAddress(),
    StatusListRegistry: await statusLists.getAddress(),
    NetworkRegistry: await networkRegistry.getAddress(),
    TrustQueries: await trustQueries.getAddress(),
  };
  return {
    governance,
    rootCAs,
    schemas,
    issuers,
    relyingParties,
    recognition,
    statusLists,
    networkRegistry,
    trustQueries,
    addresses,
  };
}
