/**
 * Anahtar haritası (`tamga-chain-keys/1`) — YALNIZ test/staging zincirleri (GUIDE-0018 yol C; network/testnet/make-network.sh
 * `--keys generate` yazar). Rol → adres + özel anahtar dosyası: dağıtan, göç yürütücüsü, liste çapası yazıcıları ve eşik, her
 * devlet için doğrulayıcı (= QBFT düğüm anahtarı, ADR-0052 K2) ve delege. Ortam: `TAMGA_CHAIN_KEYS` (haritanın yolu).
 *
 * Üretim anahtarları HSM'dedir ve her devlet kendi anahtarını kendi donanımında üretir (ARCH-0002 §2); bu biçim gerçek ağda
 * KULLANILMAZ: `purpose` yalnız "test", zincir kimliği yalnız `STAGING_CHAIN_IDS` (yerel geliştirme kimlikleri 31337/31338 de
 * reddedilir — onlar Hardhat'in herkesçe bilinen anahtarlarına ayrılmıştır).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { Contract, SigningKey, Wallet, computeAddress, type Provider, type Signer } from "ethers";

import { LOCAL_CHAIN_IDS } from "./local-dev.js";
import type { ReplaySigners } from "./replay-exec.js";

/**
 * Test/staging zincir kimlikleri (yol C). 31337 Hardhat ve 31338 yerel Besu (herkesçe bilinen test anahtarları) ile karışmasın
 * diye ayrı: depodaki araçlar bu kimliği "yerel zincir" saymaz (sandbox seti yazılmaz, test anımsatıcısı kullanılmaz), "gerçek ağ"
 * da saymaz (TAMGA_CONFIRM_PROD kapısı ve üretim yapılandırması gerekmez; anahtarlar bu haritadan gelir).
 */
export const STAGING_CHAIN_IDS: ReadonlySet<number> = new Set([31339]);
export const CHAIN_KEYS_FORMAT = "tamga-chain-keys/1";

export interface KeyRef {
  address: string;
  /** özel anahtar dosyası (haritanın klasörüne göre); içerik 0x'li ya da 0x'siz 64 onaltılık karakter (Besu `key` biçimi) */
  key: string;
}
export interface StateKeys {
  code: string;
  /** kurucu üye (Governance'a dağıtımda oy olmadan girer, ADR-0002 #3); öteki devletler 2/3 oyla kabul edilir */
  founder: boolean;
  /** genesis doğrulayıcısı mı (make-network --validators); ek düğümler sonradan oyla eklenir */
  genesis_validator: boolean;
  /** make-network düğüm numarası (node<n>) */
  node: number;
  validator: KeyRef;
  delegate: KeyRef;
}
export interface ChainKeyMap {
  format: typeof CHAIN_KEYS_FORMAT;
  purpose: "test";
  chainId: number;
  deployer: KeyRef;
  migration_executor: KeyRef;
  anchor: { threshold: number; anchorers: KeyRef[] };
  states: StateKeys[];
}
export interface LoadedChainKeys {
  file: string;
  map: ChainKeyMap;
  privateKey(ref: KeyRef): string;
  wallet(ref: KeyRef, provider?: Provider): Wallet;
  state(code: string): StateKeys;
}

const ADDR = /^0x[0-9a-fA-F]{40}$/;
const KEY = /^(0x)?[0-9a-fA-F]{64}$/;

/** Haritayı okur ve doğrular: biçim, amaç, zincir kimliği, her anahtar dosyası (varlık, izin, adres eşleşmesi), tekrar yok. */
export function loadChainKeys(file: string): LoadedChainKeys {
  if (!existsSync(file)) throw new Error(`chain-keys: harita yok: ${file}`);
  const map = JSON.parse(readFileSync(file, "utf8")) as ChainKeyMap;
  const dir = dirname(resolve(file));
  const errs: string[] = [];
  if (map.format !== CHAIN_KEYS_FORMAT) errs.push(`format ${String(map.format)} (beklenen ${CHAIN_KEYS_FORMAT})`);
  if (map.purpose !== "test") errs.push(`purpose "${String(map.purpose)}" — yalnız "test" (üretim anahtarları HSM'de)`);
  if (LOCAL_CHAIN_IDS.has(map.chainId))
    errs.push(
      `chainId ${map.chainId} yerel geliştirme kimliği — Hardhat test anahtarlarına ayrılmış; yol C ${[...STAGING_CHAIN_IDS].join("/")}`,
    );
  else if (!STAGING_CHAIN_IDS.has(map.chainId))
    errs.push(`chainId ${map.chainId} test/staging kimliği değil (${[...STAGING_CHAIN_IDS].join(", ")})`);
  const keys = new Map<string, string>();
  const seen = new Map<string, string>();
  const check = (ref: KeyRef | undefined, role: string) => {
    if (!ref || typeof ref.key !== "string" || !ADDR.test(ref.address ?? "")) {
      errs.push(`${role}: adres ya da anahtar dosyası eksik`);
      return;
    }
    const p = isAbsolute(ref.key) ? ref.key : resolve(dir, ref.key);
    if (!existsSync(p)) {
      errs.push(`${role}: anahtar dosyası yok (${ref.key})`);
      return;
    }
    if (process.platform !== "win32" && (statSync(p).mode & 0o077) !== 0)
      errs.push(`${role}: ${ref.key} başkalarınca okunabilir (0600 olmalı)`);
    const raw = readFileSync(p, "utf8").trim();
    if (!KEY.test(raw)) {
      errs.push(`${role}: ${ref.key} özel anahtar değil`);
      return;
    }
    const pk = raw.startsWith("0x") ? raw : `0x${raw}`;
    const addr = computeAddress(new SigningKey(pk));
    if (addr.toLowerCase() !== ref.address.toLowerCase())
      errs.push(`${role}: anahtar ${ref.address} adresine ait değil`);
    const prev = seen.get(addr.toLowerCase());
    // aynı doğrulayıcı anahtarı birden çok rolde olmaz (rol ayrımı); dosya yolu aynıysa aynı roldür
    if (prev && prev !== role) errs.push(`${role}: adres ${prev} ile aynı`);
    seen.set(addr.toLowerCase(), role);
    keys.set(ref.address.toLowerCase(), pk);
  };
  check(map.deployer, "deployer");
  check(map.migration_executor, "migration_executor");
  const anchorers = map.anchor?.anchorers ?? [];
  anchorers.forEach((a, i) => check(a, `anchorer[${i}]`));
  const t = map.anchor?.threshold;
  if (!Number.isInteger(t) || t < 1 || t > anchorers.length)
    errs.push(
      `anchor.threshold ${String(t)} — 1 ile yazıcı sayısı (${anchorers.length}) arasında olmalı (ADR-0053 AC4)`,
    );
  const states = map.states ?? [];
  if (!states.some((s) => s.founder)) errs.push("states: en az bir kurucu gerekir");
  const codes = new Set<string>();
  for (const s of states) {
    if (!/^[A-Z]{2}$/.test(s.code ?? "")) errs.push(`states: devlet kodu iki büyük harf olmalı (${String(s.code)})`);
    if (codes.has(s.code)) errs.push(`states: ${s.code} iki kez`);
    codes.add(s.code);
    if (s.founder && !s.genesis_validator) errs.push(`${s.code}: kurucu genesis doğrulayıcısı olmalı`);
    check(s.validator, `${s.code}.validator`);
    check(s.delegate, `${s.code}.delegate`);
  }
  if (errs.length) throw new Error(`chain-keys: ${file} geçersiz — ${errs.join("; ")}`);
  const privateKey = (ref: KeyRef) => {
    const k = keys.get(ref.address.toLowerCase());
    if (!k) throw new Error(`chain-keys: ${ref.address} haritada yok`);
    return k;
  };
  return {
    file,
    map,
    privateKey,
    wallet: (ref, provider) => new Wallet(privateKey(ref), provider ?? null),
    state: (code) => {
      const s = states.find((x) => x.code === code);
      if (!s) throw new Error(`chain-keys: ${code} haritada yok`);
      return s;
    },
  };
}

const GOVERNANCE_VIEW = ["function isActiveMember(bytes2) view returns (bool)"];
const bytes2 = (cc: string) => `0x${Buffer.from(cc, "utf8").toString("hex")}`;

/**
 * Yeniden oynatma imzacıları anahtar haritasından: devlet → delegesi, göç yürütücüsü, Governance = zincirde AKTİF üye devletlerin
 * doğrulayıcıları (öneren ilk aktif kurucu). Test/staging zincirinde bütün devletlerin anahtarı tek yerdedir; gerçek ağda her devlet
 * kendi oyunu verir ve bu fonksiyon kullanılmaz.
 */
export async function keyMapSigners(
  provider: Provider,
  keys: LoadedChainKeys,
  governance: string,
): Promise<ReplaySigners> {
  const chainId = Number((await provider.getNetwork()).chainId);
  if (chainId !== keys.map.chainId || !STAGING_CHAIN_IDS.has(chainId))
    throw new Error(`chain-keys: zincir ${chainId}, harita ${keys.map.chainId} — yalnız aynı test/staging zinciri`);
  const gov = new Contract(governance, GOVERNANCE_VIEW, provider);
  const active: StateKeys[] = [];
  for (const s of keys.map.states) if ((await gov.isActiveMember(bytes2(s.code))) as boolean) active.push(s);
  const voters: Signer[] = [...active]
    .sort((a, b) => Number(b.founder) - Number(a.founder))
    .map((s) => keys.wallet(s.validator, provider));
  if (!voters.length) throw new Error("chain-keys: Governance'ta haritadaki devletlerden aktif üye yok");
  return {
    state: (cc) => keys.wallet(keys.state(cc).delegate, provider),
    executor: keys.wallet(keys.map.migration_executor, provider),
    governance: { proposer: voters[0], voters },
  };
}
