/**
 * `trust:chain-gov` — ağsız testler: bayrak kapalıyken zincire bağlanmaması ("disabled"), kuru çalıştırmada çağrı verisinin
 * dağıtım dosyasından kodlanması, öneri türlerinin kontrat çağrılarına eşlenmesi ve girdi denetimleri (gerekçe yalnız özetiyle,
 * göç penceresi ≤ 30 gün, parametresiz başlangıç seçicisi), donanım anahtar kasası yolunun bugün açık iletiyle durması.
 * Zincirde uçtan uca (öneri → oy → yürütme, kuyruk, yeniden oy): contracts/test/governance-tool.test.ts.
 */
import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Interface } from "ethers";

import { chainGovCommand, parseArgs } from "../src/chain/governance-cli.js";
import {
  PROPOSE_KINDS,
  governanceAbi,
  hsmGovernanceSigner,
  initSelector,
  proposalCall,
  reasonHash,
} from "../src/chain/governance.js";

const A = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;
const H = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;
const REG: Record<string, string> = {
  IssuerRegistry: A(0x11),
  TrustListAnchorRegistry: A(0x12),
  CrossRecognition: A(0x13),
};
const resolve = (v: string) => {
  if (REG[v]) return REG[v];
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) return v;
  throw new Error(`kayıt yok: ${v}`);
};

async function capture(fn: () => Promise<number>) {
  const out: string[] = [];
  const err: string[] = [];
  const l = vi.spyOn(console, "log").mockImplementation((x: unknown) => void out.push(String(x)));
  const e = vi.spyOn(console, "error").mockImplementation((x: unknown) => void err.push(String(x)));
  try {
    const code = await fn();
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    l.mockRestore();
    e.mockRestore();
  }
}

describe("trust:chain-gov — bayrak ve kuru çalıştırma", () => {
  it("bayrak kapalıyken okuma ve yazma zincire bağlanmaz: disabled, çıkış 0", async () => {
    for (const argv of [["status"], ["vote", H(1), "--yes", "--as", "TR"], ["revote", "--as", "TR"]]) {
      const r = await capture(() =>
        chainGovCommand(argv, { TAMGA_CHAIN_ENABLED: "0", TAMGA_CHAIN_RPC_URL: "http://127.0.0.1:1" }),
      );
      expect(r.code).toBe(0);
      expect(JSON.parse(r.out).chain).toBe("disabled");
    }
  });

  it("bayrak kapalıyken --dry-run çağrı verisini dağıtım dosyasından kodlar (gönderim yok)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "chain-gov-"));
    const dep = join(dir, "deployment.json");
    writeFileSync(dep, JSON.stringify({ chainId: 31339, contracts: { Governance: A(0xabc), ...REG } }));
    const r = await capture(() =>
      chainGovCommand(
        [
          "propose",
          "admit",
          "--as",
          "TR",
          "--state",
          "UZ",
          "--node",
          A(1),
          "--governance",
          A(2),
          "--dry-run",
          "--deployment",
          dep,
        ],
        {},
      ),
    );
    expect(r.code).toBe(0);
    const j = JSON.parse(r.out);
    expect(j.chain).toBe("disabled");
    expect(j.tx.sent).toBe(false);
    expect(j.tx.to.toLowerCase()).toBe(A(0xabc));
    const iface = new Interface(governanceAbi());
    const d = iface.parseTransaction({ data: j.tx.data })!;
    expect(d.name).toBe("proposeStateAdmission");
    expect(d.args[0]).toBe("0x555a"); // "UZ"
    expect(d.args[2].toLowerCase()).toBe(A(2));
    // dağıtım dosyası yoksa durur
    const no = await capture(() => chainGovCommand(["vote", H(1), "--yes", "--as", "TR", "--dry-run"], {}));
    expect(no.code).toBe(2);
  });

  it("bayrak açık ama RPC yoksa yapılandırma hatası (2)", async () => {
    const r = await capture(() => chainGovCommand(["status"], { TAMGA_CHAIN_ENABLED: "1" }));
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/TAMGA_CHAIN_RPC_URL/);
  });

  it("bilinmeyen alt komut kullanım iletisi verir (2); eksik değerli seçenek reddedilir", async () => {
    expect((await capture(() => chainGovCommand(["nope"], {}))).code).toBe(2);
    expect(() => parseArgs(["--as"])).toThrow(/bir değer ister/);
    expect(parseArgs(["vote", H(1), "--yes", "--as", "TR"])).toEqual({
      pos: ["vote", H(1)],
      o: { yes: true, as: "TR" },
    });
  });

  it("donanım anahtar kasası yolu bugün tanımlı değil (ADR-0084 LS6)", () => {
    expect(() => hsmGovernanceSigner("TR")).toThrow(/donanım anahtar kasası.*ADR-0084 LS6/);
  });
});

describe("trust:chain-gov — öneri türleri", () => {
  it("her tür bir Governance öneri fonksiyonuna eşlenir ve ABI'de vardır", () => {
    const iface = new Interface(governanceAbi());
    const opts: Record<string, Record<string, string | boolean>> = {
      admit: { state: "UZ", node: A(1), governance: A(2) },
      remove: { state: "AZ", reason: "gerekçe" },
      "key-change": { state: "TR", governance: A(3) },
      upgrade: { target: "IssuerRegistry", impl: A(4), init: "initializeV2()" },
      anchorer: { registry: "TrustListAnchorRegistry", anchorer: A(5), allow: true },
      "anchor-threshold": { registry: "TrustListAnchorRegistry", required: "2" },
      "founder-recognition": { registry: "CrossRecognition", founders: "TR,KZ" },
      "migration-open": { registry: "IssuerRegistry", "plan-hash": H(7), window: "86400", executor: A(6) },
      "migration-extend": { registry: "IssuerRegistry", deadline: "2000000000" },
      "migration-close": { registry: "IssuerRegistry" },
      "schema-deprecate": { "schema-id": H(8) },
      "schema-revoke": { "schema-id": H(8), "reason-hash": H(9) },
      "schema-hash": { "schema-id": H(8), "content-hash": H(10) },
      "network-record": { registry: A(0x20), "stage-id": H(11) },
      "rp-reassign": { registry: A(0x21), "stage-id": H(12) },
      "rp-reregister": { registry: A(0x21), "stage-id": H(13) },
    };
    for (const k of PROPOSE_KINDS) {
      if (k === "network-schema") continue; // dosyadan (aşağıda)
      const c = proposalCall(k, opts[k], resolve);
      expect(iface.getFunction(c.fn), `${k} → ${c.fn}`).toBeTruthy();
      expect(() => iface.encodeFunctionData(c.fn, c.args)).not.toThrow();
    }
    expect(proposalCall("upgrade", { target: "IssuerRegistry", impl: A(4) }, resolve).fn).toBe(
      "proposeProtocolUpgrade",
    );
  });

  it("ağ şeması kaydı dosyadan; tier NETWORK (0) olmalı", () => {
    const dir = mkdtempSync(join(tmpdir(), "chain-gov-"));
    const rec = {
      vctURI: "urn:tamga:edu:Example:1",
      contentHash: H(1),
      version: "1.0.0",
      tier: 0,
      stateCode: "0x0000",
      status: 1,
      validFrom: 0,
      supersededBy: H(0),
    };
    writeFileSync(join(dir, "ok.json"), JSON.stringify(rec));
    writeFileSync(join(dir, "nat.json"), JSON.stringify({ ...rec, tier: 1 }));
    const c = proposalCall("network-schema", { file: join(dir, "ok.json") }, resolve);
    expect(c.fn).toBe("proposeNetworkSchema");
    expect(() => new Interface(governanceAbi()).encodeFunctionData(c.fn, c.args)).not.toThrow();
    expect(() => proposalCall("network-schema", { file: join(dir, "nat.json") }, resolve)).toThrow(/tier 0/);
  });

  it("girdi denetimleri: gerekçe metni yalnız özetiyle, pencere ≤ 30 gün, parametresiz başlangıç, tek yön", () => {
    expect(proposalCall("remove", { state: "AZ", reason: "x" }, resolve).args[1]).toBe(reasonHash("x"));
    expect(reasonHash("x")).toMatch(/^0x[0-9a-f]{64}$/);
    expect(() => proposalCall("remove", { state: "AZ" }, resolve)).toThrow(/--reason/);
    expect(() =>
      proposalCall(
        "migration-open",
        { registry: "IssuerRegistry", "plan-hash": H(1), window: String(31 * 86400), executor: A(1) },
        resolve,
      ),
    ).toThrow(/30 gün/);
    expect(() => initSelector("initialize(uint256)")).toThrow(/parametresiz/);
    expect(initSelector("0xAABBCCDD")).toBe("0xaabbccdd");
    expect(() => proposalCall("anchorer", { registry: "TrustListAnchorRegistry", anchorer: A(1) }, resolve)).toThrow(
      /--allow/,
    );
    expect(() => proposalCall("admit", { state: "tr", node: A(1), governance: A(2) }, resolve)).toThrow(
      /iki büyük harf/,
    );
    expect(() => proposalCall("admit", { state: "UZ", node: "0x12", governance: A(2) }, resolve)).toThrow(/--node/);
    expect(() => proposalCall("nope", {}, resolve)).toThrow(/bilinmeyen öneri türü/);
    expect(() => proposalCall("migration-close", { registry: "Yok" }, resolve)).toThrow(/kayıt yok/);
  });
});
