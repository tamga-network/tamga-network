/**
 * Test kurulumu — üç kurucu devlet (TR, KZ, AZ; 2/3 kuralı n<3'te dejenere olduğu için — review R6), TR kök CA + bir
 * üniversite (EDUCATION, I2) + üniversitenin operasyon anahtarı. Eski TamgaTestBase.sol'un TypeScript karşılığı.
 */
import { network } from "hardhat";
import type { Signer } from "ethers";

import { deployTrustLayer, stateCode, type TrustLayerDeployment } from "../../scripts/lib/deploy.js";

export const conn = await network.create();
export const { ethers, networkHelpers } = conn;

export const TR = stateCode(ethers, "TR");
export const KZ = stateCode(ethers, "KZ");
export const AZ = stateCode(ethers, "AZ");
export const ZERO = ethers.ZeroHash;
export const id = (s: string) => ethers.id(s); // keccak256(utf8)
export const DAY = 86_400;
/**
 * ADR-0086 K1: kabul önerisinde yönetişim anahtarından ayrı, belirlenimli bir düğüm (QBFT) adresi. Düğüm anahtarı zincirde imza
 * atmadığı için testlerde anahtarsız adres yeter.
 */
export const nodeOf = (governance: string) =>
  ethers.getAddress(ethers.dataSlice(ethers.keccak256(ethers.concat([ethers.toUtf8Bytes("node:"), governance])), 12));

export enum IssuerCategory {
  GOVERNMENT,
  IDENTITY,
  EDUCATION,
  HEALTH,
  FINANCE,
  LOGISTICS,
  OTHER,
  EVENTS,
}
export enum IssuerAssurance {
  I1,
  I2,
  I3,
}
export enum Status {
  NONE,
  ACTIVE,
  SUSPENDED,
  REVOKED,
}
export enum CAStatus {
  NONE,
  ACTIVE,
  SUSPENDED,
  RETIRED,
  REVOKED,
}
export enum SchemaTier {
  NETWORK,
  NATIONAL,
}
export enum SchemaStatus {
  NONE,
  ACTIVE,
  DEPRECATED,
  REVOKED,
}
export enum RecognitionMode {
  NONE,
  FULL,
  CATEGORY_LIMITED,
}

export interface Fixture extends TrustLayerDeployment {
  deployer: Signer;
  /** kurucuların yönetişim (oy) anahtarları — öneri, oy, delege listesi (ADR-0086 K1) */
  trGov: Signer;
  kzGov: Signer;
  azGov: Signer;
  /** kurucuların QBFT düğüm adresleri — zincirde yetkisi yok (ADR-0086 K1) */
  trNode: string;
  kzNode: string;
  azNode: string;
  trDelegate: Signer;
  kzDelegate: Signer;
  uniOperator: Signer;
  stranger: Signer;
  trCA: string;
  uniIssuer: string;
  now: () => Promise<number>;
  registerCA: (st: string, who: Signer, fp: string) => Promise<string>;
  registerIssuer: (
    st: string,
    who: Signer,
    caId: string,
    fp: string,
    cat: IssuerCategory,
    asr: IssuerAssurance,
  ) => Promise<string>;
  registerNationalSchema: (st: string, who: Signer, vct: string, hash: string) => Promise<string>;
  schemaRecord: (vct: string, tier: SchemaTier, st: string, hash?: string) => Record<string, unknown>;
  as: <T>(c: T, s: Signer) => T;
}

export async function deployFixture(): Promise<Fixture> {
  const signers = await ethers.getSigners();
  const [deployer, trGov, kzGov, azGov, trDelegate, kzDelegate, uniOperator, stranger] = signers;
  // ADR-0086 K1: düğüm adresleri ayrı hesaplar (#17–#19); düğüm anahtarı zincirde imza atmaz.
  const [trNode, kzNode, azNode] = await Promise.all([17, 18, 19].map((i) => signers[i].getAddress()));
  const founders = [
    { code: "TR", validator: trNode, governance: await trGov.getAddress() },
    { code: "KZ", validator: kzNode, governance: await kzGov.getAddress() },
    { code: "AZ", validator: azNode, governance: await azGov.getAddress() },
  ];
  const d = await deployTrustLayer(ethers, deployer, founders, trGov);
  const as = <T>(c: T, s: Signer): T => (c as any).connect(s) as T;
  const now = async () => (await ethers.provider.getBlock("latest"))!.timestamp;

  // Delege anahtarları — devletin kendi iç işi, oy gerekmez
  await (await as(d.governance, trGov).setDelegateKeys(TR, [await trDelegate.getAddress()])).wait();
  await (await as(d.governance, kzGov).setDelegateKeys(KZ, [await kzDelegate.getAddress()])).wait();

  const registerCA = async (st: string, who: Signer, fp: string) => {
    const t = await now();
    await (
      await as(d.rootCAs, who).registerRootCA({
        caId: ZERO,
        stateCode: st,
        certFingerprint: fp,
        subjectHash: id("subject"),
        certURI: "https://pki.example/root.der",
        crlURI: "",
        status: CAStatus.ACTIVE,
        validFrom: 0,
        validUntil: t + 3650 * DAY,
        registeredAt: 0,
      })
    ).wait();
    return d.rootCAs.caIdOf(st, fp) as Promise<string>;
  };

  const registerIssuer = async (
    st: string,
    who: Signer,
    caId: string,
    fp: string,
    cat: IssuerCategory,
    asr: IssuerAssurance,
  ) => {
    const t = await now();
    await (
      await as(d.issuers, who).registerIssuer({
        issuerId: ZERO,
        stateCode: st,
        nameHash: id("Example University"),
        category: cat,
        assurance: asr,
        certFingerprint: fp,
        parentCA: caId,
        metadataURI: "",
        status: Status.ACTIVE,
        validFrom: 0,
        validUntil: t + 365 * DAY,
        successorId: ZERO,
        registeredAt: 0,
        revokedAt: 0,
      })
    ).wait();
    return ethers.keccak256(ethers.concat([st, fp]));
  };

  const schemaRecord = (vct: string, tier: SchemaTier, st: string, hash = id("meta")) => ({
    vctURI: vct,
    contentHash: hash,
    version: "1.0.0",
    tier,
    stateCode: st,
    status: SchemaStatus.ACTIVE,
    validFrom: 0,
    supersededBy: ZERO,
  });

  const registerNationalSchema = async (st: string, who: Signer, vct: string, hash: string) => {
    await (await as(d.schemas, who).registerSchema(schemaRecord(vct, SchemaTier.NATIONAL, st, hash))).wait();
    return id(vct);
  };

  // TR Root CA + üniversite + operasyon anahtarı
  const trCA = await registerCA(TR, trDelegate, id("TR-ROOT-CA-1"));
  const uniIssuer = await registerIssuer(
    TR,
    trDelegate,
    trCA,
    id("BILGI-CERT"),
    IssuerCategory.EDUCATION,
    IssuerAssurance.I2,
  );
  await (await as(d.issuers, trDelegate).setIssuerDelegates(uniIssuer, [await uniOperator.getAddress()])).wait();

  return {
    ...d,
    deployer,
    trGov,
    kzGov,
    azGov,
    trNode,
    kzNode,
    azNode,
    trDelegate,
    kzDelegate,
    uniOperator,
    stranger,
    trCA,
    uniIssuer,
    now,
    registerCA,
    registerIssuer,
    registerNationalSchema,
    schemaRecord,
    as,
  };
}

export const loadFixture = () => networkHelpers.loadFixture(deployFixture);
