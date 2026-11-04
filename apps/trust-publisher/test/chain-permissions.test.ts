/**
 * ADR-0052 K2/K3 — `trust:chain-permissions` ağsız parçaları (kontrat durumundan çizim: contracts/test/chain-permissions.test.ts):
 *   - düğüm bildirimi: JSON şeması (network/permissions/schema) ve TS doğrulayıcısı aynı kararı verir; örnekler geçerli;
 *   - eşleşme kuralı (aktif üye + validator adresi; rpc yalnız kendi işletmecisinde; çift anahtar ret);
 *   - belirleyicilik (sahte okuyucu, farklı okuma sırası → aynı bayt), okuyucu geri okur, fark hesabı;
 *   - `check` yalnız loopback yönetim ucu; sahte Besu ucuna karşı fark ve eşitlik (çıkış 3 / 0).
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import _Ajv2020 from "ajv/dist/2020.js";
import _addFormats from "ajv-formats";
import { HDNodeWallet } from "ethers";

import { enodeOf, matchDeclarations, nodeAddressOf, validateNodeDeclaration } from "../src/chain/node-declaration.js";
import {
  assertLoopbackRpc,
  diffPermissions,
  nodeAllowlists,
  parsePermissionsToml,
  readPermissionsState,
  renderPermissions,
  type PermissionsReader,
} from "../src/chain/permissions.js";
import { chainPermissionsCommand } from "../src/chain/permissions-cli.js";

const ROOT = resolve(import.meta.dirname, "../../..");
const PERM = resolve(ROOT, "network/permissions");
type AjvCtor = new (o: object) => { compile(s: object): ((d: unknown) => boolean) & { errors?: unknown } };
const Ajv = ((_Ajv2020 as unknown as { default?: AjvCtor }).default ?? _Ajv2020) as unknown as AjvCtor;
const addFormats = ((_addFormats as unknown as { default?: (a: object) => void }).default ??
  _addFormats) as unknown as (a: object) => void;
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const schemaValid = ajv.compile(JSON.parse(readFileSync(resolve(PERM, "schema/node-declaration.schema.json"), "utf8")));

const MNEMONIC = "test test test test test test test test test test test junk";
const w = (i: number) => HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`);
const pub = (i: number) => w(i).signingKey.publicKey.slice(4);
const decl = (state: string, i: number, port = 30303, role = "validator") => ({
  format: "tamga-node-declaration/1",
  state,
  role,
  node_public_key: pub(i),
  ip: "192.0.2.10",
  p2p_port: port,
  contact: "noc@example.org",
});

describe("düğüm bildirimi (network/permissions)", () => {
  it("örnekler şemaya ve doğrulayıcıya uyar", () => {
    const dir = resolve(PERM, "examples");
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const f of files) {
      const x = JSON.parse(readFileSync(resolve(dir, f), "utf8"));
      expect(schemaValid(x), `${f}: ${JSON.stringify(schemaValid.errors)}`).toBe(true);
      expect(validateNodeDeclaration(x), f).toEqual([]);
    }
  });

  it("şema ve doğrulayıcı aynı kararı verir (geçersiz örnekler)", () => {
    const good = decl("TR", 1);
    const bad: Array<Record<string, unknown>> = [
      { ...good, state: "tr" },
      { ...good, state: "TUR" },
      { ...good, role: "observer" },
      { ...good, node_public_key: "0x" + pub(1) },
      { ...good, node_public_key: "04" + pub(1) },
      { ...good, node_public_key: pub(1).toUpperCase() },
      { ...good, ip: "node1.example.org" },
      { ...good, ip: "300.1.1.1" },
      { ...good, p2p_port: 0 },
      { ...good, p2p_port: 70000 },
      { ...good, contact: "Ayşe Yılmaz" },
      { ...good, contact: "http://example.org" },
      { ...good, format: "tamga-node-declaration/2" },
      { ...good, note: "serbest metin yok" },
      (({ contact: _c, ...rest }) => rest)(good),
    ];
    expect(schemaValid(good)).toBe(true);
    expect(validateNodeDeclaration(good)).toEqual([]);
    for (const b of bad) {
      expect(schemaValid(b), JSON.stringify(b)).toBe(false);
      expect(validateNodeDeclaration(b).length, JSON.stringify(b)).toBeGreaterThan(0);
    }
    // IPv6 ve mailto geçerli
    const v6 = { ...good, ip: "2001:db8::10", contact: "mailto:noc@example.org" };
    expect(schemaValid(v6)).toBe(true);
    expect(validateNodeDeclaration(v6)).toEqual([]);
    expect(enodeOf(v6)).toBe(`enode://${pub(1)}@[2001:db8::10]:30303`);
  });

  it("eşleşme: aktif üyenin validator adresi; rpc yalnız kendi işletmecisinde; çift anahtar ve ikinci validator ret", () => {
    expect(nodeAddressOf(pub(1))).toBe(w(1).address.toLowerCase());
    const members = [
      { code: "TR", validator: w(1).address, active: true },
      { code: "KZ", validator: w(2).address, active: true },
      { code: "AZ", validator: w(3).address, active: false },
      { code: "UZ", validator: w(4).address, active: true },
    ];
    const m = matchDeclarations(
      [
        { file: "tr.json", decl: decl("TR", 1) },
        { file: "kz.json", decl: decl("KZ", 2) },
        { file: "az.json", decl: decl("AZ", 3) }, // üye aktif değil
        { file: "kz-2.json", decl: decl("KZ", 5) }, // adres eşleşmez
        { file: "tr-rpc.json", decl: decl("TR", 8, 30310, "rpc") },
        { file: "kz-rpc.json", decl: decl("KZ", 7, 30311, "rpc") }, // başka işletmecinin rpc'si → sessizce dışarıda
        { file: "dup-a.json", decl: decl("TR", 9, 1, "rpc") },
        { file: "dup-b.json", decl: decl("TR", 9, 2, "rpc") },
        { file: "bozuk.json", decl: null },
      ],
      members,
      "TR",
    );
    expect(m.validatorNodes.sort()).toEqual([enodeOf(decl("KZ", 2)), enodeOf(decl("TR", 1))].sort());
    expect(m.ownNodes).toEqual([enodeOf(decl("TR", 8, 30310))]);
    expect(m.rejected.map((r) => r.file)).toEqual(["az.json", "bozuk.json", "dup-a.json", "dup-b.json", "kz-2.json"]);
    expect(m.missing).toEqual(["UZ"]);
    const twice = matchDeclarations(
      [
        { file: "a.json", decl: decl("TR", 1, 1) },
        { file: "b.json", decl: { ...decl("TR", 1, 2), node_public_key: pub(1) } },
      ],
      members,
      null,
    );
    expect(twice.rejected).toHaveLength(2); // aynı anahtar
  });
});

function fakeReader(order: "a" | "b"): PermissionsReader {
  const flip = <T>(xs: T[]) => (order === "a" ? xs : [...xs].reverse());
  const A = (i: number) => w(i).address; // karışık büyük/küçük harf (EIP-55)
  return {
    chainId: async () => 31338,
    blockNumber: async () => 42,
    contracts: () => ({ Governance: "0xAa00000000000000000000000000000000000001", IssuerRegistry: "0xbb" }),
    memberCodes: async () => flip(["TR", "KZ", "AZ"]),
    member: async (code) =>
      ({ TR: { validator: A(1), status: 1 }, KZ: { validator: A(2), status: 1 }, AZ: { validator: A(3), status: 2 } })[
        code
      ]!,
    stateDelegates: async (code) => (code === "TR" ? flip([A(4), A(5)]) : code === "AZ" ? [A(6)] : []),
    issuersOf: async (code) => (code === "TR" ? flip(["0x01", "0x02"]) : code === "AZ" ? ["0x03"] : []),
    issuerOperational: async (id) => id !== "0x02",
    issuerDelegates: async (id) => ({ "0x01": [A(7), A(4)], "0x02": [A(11)], "0x03": [A(12)] })[id] ?? [],
    anchorers: async () => flip([A(0), A(4)]),
    migrationExecutors: async () => [],
  };
}

describe("render — belirleyicilik ve biçim", () => {
  const decls = [
    { file: "tr.json", decl: decl("TR", 1) },
    { file: "kz.json", decl: decl("KZ", 2, 30304) },
  ];

  it("aynı durum, farklı okuma sırası → bayt bayt aynı; hesaplar kurala göre", async () => {
    const a = renderPermissions(await readPermissionsState(fakeReader("a")), decls);
    const b = renderPermissions(await readPermissionsState(fakeReader("b")), [...decls].reverse());
    expect(b.toml).toBe(a.toml);
    expect(b.sha256).toBe(a.sha256);
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
    const lc = (i: number) => w(i).address.toLowerCase();
    // AZ askıda: validator'ı (#3) ve delegesi (#6) yok; AZ'nin çalışır kurumu (#12) var (kontrat yalnız kurum durumuna bakar);
    // TR'nin askıdaki kurumu (0x02 → #11) yok
    expect(a.accounts).toEqual([lc(0), lc(1), lc(2), lc(4), lc(5), lc(7), lc(12)].sort());
    expect(a.toml).not.toContain("\r");
    expect(a.toml).not.toMatch(/block|42\b/); // blok numarası dosyaya girmez
    expect(a.toml.split("\n")[0]).toMatch(/^# Tamga Network/);
    expect(parsePermissionsToml(a.toml)).toEqual({ accounts: a.accounts, nodes: a.nodes });
  });

  it("okuyucu yalnız kendi biçimini kabul eder; fark hesabı büyük/küçük harf ve enode sorgusunu yok sayar", () => {
    expect(() => parsePermissionsToml('accounts-allowlist=["0x1"]\nnodes-whitelist=[]\n')).toThrow(/beklenmeyen/);
    expect(() => parsePermissionsToml("accounts-allowlist=[0x1]\n")).toThrow(/tırnaksız/);
    expect(() => parsePermissionsToml('accounts-allowlist=["0x1"]\nfoo\n')).toThrow(/tanınmayan/);
    expect(parsePermissionsToml("accounts-allowlist=[]\nnodes-allowlist=[]\n")).toEqual({ accounts: [], nodes: [] });
    const e = { accounts: ["0xab", "0xcd"], nodes: [`enode://${pub(1)}@127.0.0.1:30313`] };
    expect(
      diffPermissions(e, { accounts: ["0xAB", "0xCD"], nodes: [`enode://${pub(1)}@127.0.0.1:30313?discport=0`] }).equal,
    ).toBe(true);
    const d = diffPermissions(e, { accounts: ["0xab", "0xef"], nodes: [] });
    expect(d.equal).toBe(false);
    expect(d.accounts).toEqual({ missingOnNode: ["0xcd"], extraOnNode: ["0xef"] });
    expect(d.nodes.missingOnNode).toHaveLength(1);
  });
});

describe("check — düğümün yönetim ucu", () => {
  it("yalnız loopback (PERM dışarı açılmaz)", async () => {
    expect(() => assertLoopbackRpc("http://127.0.0.1:8545")).not.toThrow();
    expect(() => assertLoopbackRpc("http://localhost:8545")).not.toThrow();
    expect(() => assertLoopbackRpc("http://[::1]:8545")).not.toThrow();
    expect(() => assertLoopbackRpc("http://10.0.0.5:8545")).toThrow(/loopback/);
    expect(() => assertLoopbackRpc("https://rpc.example.org")).toThrow(/loopback/);
    await expect(nodeAllowlists("http://192.0.2.1:8545", async () => [])).rejects.toThrow(/loopback/);
  });

  it("sahte Besu ucu: eşit → 0, fark → 3", async () => {
    let accounts = ["0xAB", "0xcd"];
    const srv = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const { method, id } = JSON.parse(body) as { method: string; id: number };
        const result = method === "perm_getAccountsAllowlist" ? accounts : [`enode://${pub(1)}@127.0.0.1:30313`];
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
      });
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    const port = (srv.address() as { port: number }).port;
    const dir = mkdtempSync(join(tmpdir(), "perm-"));
    const file = join(dir, "permissions_config.toml");
    writeFileSync(
      file,
      `accounts-allowlist=[\n  "0xab",\n  "0xcd",\n]\nnodes-allowlist=[\n  "enode://${pub(1)}@127.0.0.1:30313",\n]\n`,
    );
    const log = console.log;
    const err = console.error;
    console.log = () => {};
    console.error = () => {};
    try {
      const args = ["check", "--file", file, "--node-rpc", `http://127.0.0.1:${port}`];
      expect(await chainPermissionsCommand(args, {})).toBe(0);
      accounts = ["0xab"];
      expect(await chainPermissionsCommand(args, {})).toBe(3);
      await expect(
        chainPermissionsCommand(["check", "--file", file, "--node-rpc", "http://192.0.2.1:1"], {}),
      ).rejects.toThrow(/loopback/);
      expect(await chainPermissionsCommand(["nope"], {})).toBe(2);
      // render: RPC yoksa kullanım hatası (2), hiçbir şey yazılmaz
      expect(await chainPermissionsCommand(["render"], {})).toBe(2);
    } finally {
      console.log = log;
      console.error = err;
      srv.close();
    }
  });
});
