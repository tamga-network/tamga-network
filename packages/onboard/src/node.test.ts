/**
 * `tamga-onboard node` — devlet / işletmeci Besu düğümü: anahtar (bilinen test vektörü, Besu `key` biçimi), anahtar dosyası
 * korumaları (security.test ile aynı: üzerine yazmama, bulut eşitleme reddi, Windows izni, klasör bağı), yapılandırma şablonu
 * (RPC 127.0.0.1, P2P 0.0.0.0 değil, izin bayrakları), bildirim (şema + liste yayıncısının doğrulayıcısıyla aynı karar; kişi adı
 * uyarısı), JSON-RPC taşıyıcısı (salt-okur yöntemler, adres politikası, DNS yeniden bağlama, yönlendirme yok), denetim satırları
 * (sahte düğüm), MCP araçları (özel anahtar yanıtta yok, özel ağ yalnız TAMGA_ önekli ortam değişkeniyle).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer, type Server as HttpServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import _Ajv2020 from "ajv/dist/2020.js";
import _addFormats from "ajv-formats";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { validateNodeDeclaration as publisherValidate } from "../../../apps/trust-publisher/src/chain/node-declaration.js";
import {
  besuTomlTemplate,
  buildNodeDeclaration,
  defaultRpc,
  generateNodeKey,
  initNode,
  nodeAddressOf,
  nodeChecks,
  nodeIdentity,
  normalizePublicKey,
  parseToml,
  privateKeyPermissionOk,
  readNodeDir,
  READ_ONLY_METHODS,
  validateNodeDeclaration,
  type NodeProfile,
  type Rpc,
  type RpcOutcome,
} from "./index.js";
import { createServer, TOOLS } from "./mcp.js";

const tmp = mkdtempSync(join(tmpdir(), "tamga-onboard-node-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

// Hardhat test hesabı #1 (herkesçe bilinen; besu-dev.ps1 izinli kipte TR düğüm anahtarı)
const HH1 = {
  key: "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  pub: "ba5734d8f7091719471e7f7ed6b9df170dc70cc661ca05e688601ad984f068b0d67351e5f06073092499336ab0839ef8a521afd334e53807205fa2f08eec74f4",
  address: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
};
const init = { state: "TR", role: "validator" as const, ip: "192.0.2.10", interface: "10.0.0.10" };

describe("anahtar", () => {
  it("bilinen vektör: özel anahtar → enode açık anahtarı ve adres (Keccak-256)", () => {
    expect(nodeIdentity(Buffer.from(HH1.key, "hex"))).toEqual({ publicKey: HH1.pub, address: HH1.address });
    expect(nodeAddressOf("0x04" + HH1.pub.toUpperCase())).toBe(HH1.address);
    expect(normalizePublicKey("04" + HH1.pub)).toBe(HH1.pub);
    expect(normalizePublicKey("abc")).toBeNull();
    expect(() => nodeIdentity(Buffer.alloc(32))).toThrow(); // 0 geçersiz
  });

  it("yeni anahtar: Besu key biçimi (0x + 64 onaltılık), kimlik tutarlı, her seferinde farklı", () => {
    const a = generateNodeKey();
    const b = generateNodeKey();
    expect(a.keyFile).toMatch(/^0x[0-9a-f]{64}$/);
    expect(nodeIdentity(Buffer.from(a.keyFile.slice(2), "hex"))).toEqual({
      publicKey: a.publicKey,
      address: a.address,
    });
    expect(a.keyFile).not.toBe(b.keyFile);
  });
});

describe("node init — dosyalar ve korumalar", () => {
  it("anahtar yalnız sahibine, açık bilgiler ayrı; şablon kuralları; üzerine yazmaz", () => {
    const dir = join(tmp, "n1");
    const r = initNode(dir, init);
    const key = readFileSync(join(dir, "key"), "utf8");
    expect(key).toMatch(/^0x[0-9a-f]{64}$/); // satır sonu yok (Besu biçimi)
    expect(nodeIdentity(Buffer.from(key.slice(2), "hex")).address).toBe(r.profile.address);
    expect(privateKeyPermissionOk(join(dir, "key"))).toBe(true);
    expect(readFileSync(join(dir, "key.pub"), "utf8").trim()).toBe(`0x${r.profile.node_public_key}`);
    expect(readFileSync(join(dir, ".gitignore"), "utf8")).toMatch(/^key$/m);
    const nodeJson = readFileSync(join(dir, "node.json"), "utf8");
    expect(nodeJson).not.toContain(key.slice(2));
    expect(r.enode).toBe(`enode://${r.profile.node_public_key}@192.0.2.10:30303`);
    const t = parseToml(readFileSync(join(dir, "besu.toml"), "utf8"));
    expect(t).toMatchObject({
      "p2p-host": "192.0.2.10",
      "p2p-interface": "10.0.0.10",
      "rpc-http-host": "127.0.0.1",
      "permissions-nodes-config-file-enabled": true,
      "permissions-accounts-config-file-enabled": true,
      "discovery-enabled": false,
      "rpc-ws-enabled": false,
    });
    expect(t["host-allowlist"]).toEqual(["localhost", "127.0.0.1"]);
    expect(readNodeDir(dir)).toMatchObject({ profile: { address: r.profile.address }, config: { "p2p-port": 30303 } });
    expect(() => initNode(dir, init)).toThrow(/üzerine yazılmaz/);
  });

  it("0.0.0.0 / :: arayüz ve ilan reddedilir; özel ağ ilanı uyarı", () => {
    expect(() => initNode(join(tmp, "n2"), { ...init, interface: "0.0.0.0" })).toThrow(/0\.0\.0\.0/);
    expect(() => initNode(join(tmp, "n2"), { ...init, interface: "::" })).toThrow(/interface/);
    expect(() => initNode(join(tmp, "n2"), { ...init, ip: "0.0.0.0" })).toThrow(/ilan edilemez/);
    expect(() => initNode(join(tmp, "n2"), { ...init, ip: "node.example.org" })).toThrow(/DNS adı değil/);
    expect(() => initNode(join(tmp, "n2"), { ...init, state: "tr" })).toThrow(/state/);
    expect(existsSync(join(tmp, "n2", "key"))).toBe(false);
    const r = initNode(join(tmp, "n3"), { ...init, ip: "10.1.2.3", interface: undefined });
    expect(r.warnings.join()).toMatch(/özel ağ/);
    expect(r.profile.interface).toBe("10.1.2.3");
  });

  it("bulut eşitleme klasörü yalnız açık onayla", () => {
    const od = join(tmp, "OneDriveSim");
    const env = { OneDrive: od };
    expect(() => initNode(join(od, "node"), init, { env })).toThrow(/eşitleme/);
    expect(initNode(join(od, "node"), init, { env, allowSynced: true }).warnings.join()).toMatch(/eşitleme/);
  });

  it("klasör dışarıyı gösteren bağ (junction/symlink) içine anahtar yazılmaz", (ctx) => {
    const outside = join(tmp, "outside-node");
    mkdirSync(outside);
    const dir = join(tmp, "n-link");
    mkdirSync(dir);
    try {
      symlinkSync(outside, join(dir, "key"), process.platform === "win32" ? "junction" : "dir");
    } catch {
      return ctx.skip();
    }
    expect(() => initNode(dir, init)).toThrow(/zaten var|dışında/);
    expect(existsSync(join(outside, "key"))).toBe(false);
  });

  it("node.json bozuksa / bilinmeyen alan varsa durur", () => {
    const dir = join(tmp, "bad-profile");
    mkdirSync(dir);
    writeFileSync(join(dir, "node.json"), JSON.stringify({ state: "TR", person: "x" }));
    expect(() => readNodeDir(dir)).toThrow(/bilinmeyen alan/);
    writeFileSync(
      join(dir, "node.json"),
      JSON.stringify({
        ...init,
        node_public_key: HH1.pub,
        address: "0x" + "1".repeat(40),
        p2p_port: 30303,
        rpc_port: 8545,
      }),
    );
    expect(() => readNodeDir(dir)).toThrow(/address/);
  });
});

describe("node declare — tamga-node-declaration/1", () => {
  type AjvCtor = new (o: object) => { compile(s: object): (d: unknown) => boolean };
  const Ajv = ((_Ajv2020 as unknown as { default?: AjvCtor }).default ?? _Ajv2020) as unknown as AjvCtor;
  const addFormats = ((_addFormats as unknown as { default?: (a: object) => void }).default ??
    _addFormats) as unknown as (a: object) => void;
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const PERM = resolve(import.meta.dirname, "../../../network/permissions");
  const schemaValid = ajv.compile(
    JSON.parse(readFileSync(join(PERM, "schema/node-declaration.schema.json"), "utf8")) as object,
  );
  const base = { state: "TR", role: "validator" as const, node_public_key: HH1.pub, ip: "192.0.2.10", p2p_port: 30303 };

  it("geçerli bildirim: şema, bu paketin ve liste yayıncısının doğrulayıcısı aynı karar", () => {
    const b = buildNodeDeclaration({ ...base, node_public_key: "0x04" + HH1.pub, contact: "noc@example.org" });
    expect(b.problems).toEqual([]);
    expect(b.warnings).toEqual([]);
    expect(b.address).toBe(HH1.address);
    expect(b.declaration).toEqual({ format: "tamga-node-declaration/1", ...base, contact: "noc@example.org" });
    const cases: unknown[] = [
      b.declaration,
      { ...b.declaration, contact: "https://example.org/operations" },
      { ...b.declaration, ip: "2001:db8::10" },
      { ...b.declaration, person: "x" },
      { ...b.declaration, contact: "Ahmet Yılmaz" },
      { ...b.declaration, node_public_key: HH1.pub.toUpperCase() },
      { ...b.declaration, p2p_port: 0 },
      { ...b.declaration, state: "TUR" },
      { ...b.declaration, role: "observer" },
      { ...b.declaration, ip: "node.example.org" },
      ...["tr-rpc.example.json", "tr-validator.example.json"].map((f) =>
        JSON.parse(readFileSync(join(PERM, "examples", f), "utf8")),
      ),
    ];
    for (const c of cases) {
      const mine = validateNodeDeclaration(c).length === 0;
      expect(schemaValid(c), JSON.stringify(c)).toBe(mine);
      expect(publisherValidate(c).length === 0, JSON.stringify(c)).toBe(mine);
    }
  });

  it("kişi adına benzeyen iletişim adresinde uyarı; kişi adı alanı yok", () => {
    expect(buildNodeDeclaration({ ...base, contact: "ahmet.yilmaz@example.org" }).warnings.join()).toMatch(/kişi adı/);
    expect(buildNodeDeclaration({ ...base, contact: "operations@example.org" }).warnings).toEqual([]);
    expect(buildNodeDeclaration({ ...base, contact: "Ahmet Yılmaz" }).problems.join()).toMatch(/contact/);
    expect(buildNodeDeclaration({ ...base, ip: "0.0.0.0", contact: "noc@example.org" }).problems.join()).toMatch(
      /0\.0\.0\.0/,
    );
  });
});

describe("TOML okuyucu", () => {
  it("çizim biçimi, Besu'nun yeniden yazdığı tek satır biçim, yorumlar; desteklenmeyen yapı → hata", () => {
    expect(
      parseToml('# x\naccounts-allowlist=[\n  "0xab",\n  "0xcd", # y\n]\nnodes-allowlist=[]\nflag=true\nport=30303\n'),
    ).toEqual({ "accounts-allowlist": ["0xab", "0xcd"], "nodes-allowlist": [], flag: true, port: 30303 });
    expect(parseToml('accounts-allowlist=["0xab","0xcd"]\nnodes-allowlist=["enode://a@1.2.3.4:1"]')).toMatchObject({
      "nodes-allowlist": ["enode://a@1.2.3.4:1"],
    });
    expect(() => parseToml("[section]\n")).toThrow(/anahtar=değer/);
    expect(() => parseToml("a=[\n")).toThrow(/kapanmadı/);
    expect(() => parseToml("a=1.5")).toThrow(/desteklenmeyen/);
  });
});

describe("JSON-RPC taşıyıcısı", () => {
  let server: HttpServer;
  let port = 0;
  beforeAll(async () => {
    server = createHttpServer((req, res) => {
      if (req.url === "/redirect") return res.writeHead(307, { location: "/" }).end();
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        const m = JSON.parse(body).method as string;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify(
            m === "eth_chainId"
              ? { jsonrpc: "2.0", id: 1, result: "0x7a6a" }
              : { jsonrpc: "2.0", id: 1, error: { code: -32604, message: "Method not enabled\u0007" } },
          ),
        );
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("yalnız salt-okur yöntemler; yazan yöntem çağrılamaz", async () => {
    const rpc = defaultRpc({ policy: () => ({ loopback: true, private: false }) });
    expect(await rpc(`http://127.0.0.1:${port}/`, "eth_chainId")).toEqual({ kind: "result", value: "0x7a6a" });
    const err = (await rpc(`http://127.0.0.1:${port}/`, "admin_nodeInfo")) as Extract<RpcOutcome, { kind: "error" }>;
    expect(err).toMatchObject({ kind: "error", code: -32604 });
    expect(err.message).not.toMatch(/\u0007/); // ağdan gelen metin temizlenir
    for (const m of [
      "qbft_proposeValidatorVote",
      "perm_reloadPermissionsFromFile",
      "admin_addPeer",
      "eth_sendRawTransaction",
    ]) {
      expect(READ_ONLY_METHODS.has(m)).toBe(false);
      await expect(rpc(`http://127.0.0.1:${port}/`, m)).rejects.toThrow(/salt-okur/);
    }
  });

  it("adres politikası: loopback / özel ağ / bulut meta veri ucu / dışta http; DNS yeniden bağlama; yönlendirme yok", async () => {
    const closed = defaultRpc({ policy: () => ({ loopback: false, private: false }) });
    expect(await closed(`http://127.0.0.1:${port}/`, "eth_chainId")).toMatchObject({
      kind: "network",
      message: /loopback/,
    });
    expect(await closed(`http://localhost:${port}/`, "eth_chainId")).toMatchObject({
      kind: "network",
      message: /loopback/,
    });
    const cli = defaultRpc({ policy: () => ({ loopback: true, private: false }) });
    for (const u of [
      "http://10.0.0.5:8545/",
      "http://169.254.169.254/",
      "http://[fd00::1]:8545/",
      "http://100.64.0.1/",
    ])
      expect(await cli(u, "eth_chainId"), u).toMatchObject({ kind: "network", message: /--allow-private/ });
    const pub = defaultRpc({
      policy: () => ({ loopback: true, private: false }),
      resolveAll: async () => [{ address: "93.184.215.14", family: 4 }],
    });
    expect(await pub("http://node.example.org:8545/", "eth_chainId")).toMatchObject({ message: /yalnız https/ });
    const rebinding = defaultRpc({
      policy: () => ({ loopback: true, private: false }),
      resolveAll: async () => [{ address: "10.0.0.5", family: 4 }],
    });
    expect(await rebinding(`https://node.example.org:${port}/`, "eth_chainId")).toMatchObject({
      kind: "network",
      message: /özel ağ/,
    });
    expect(await cli(`http://user:pw@127.0.0.1:${port}/`, "eth_chainId")).toMatchObject({
      message: /kullanıcı bilgisi/,
    });
    expect(await cli(`http://127.0.0.1:${port}/redirect`, "eth_chainId")).toMatchObject({
      kind: "error",
      message: /yönlendirme izlenmez/,
    });
  });
});

/** Sahte düğüm: yöntem → sonuç; çağrılan her yöntem kaydedilir (salt-okur kümede mi). */
const fakeRpc =
  (nodes: Record<string, Record<string, unknown>>, calls: string[] = []): Rpc =>
  async (url, method) => {
    calls.push(method);
    const n = nodes[url];
    if (!n) return { kind: "network", message: "ECONNREFUSED" };
    if (!(method in n)) return { kind: "error", status: 200, code: -32604, message: "Method not enabled" };
    const v = n[method];
    return v instanceof Error ? { kind: "network", message: v.message, tls: true } : { kind: "result", value: v };
  };

describe("node check — denetim satırları", () => {
  const profile: NodeProfile = {
    state: "TR",
    role: "validator",
    node_public_key: HH1.pub,
    address: HH1.address,
    ip: "192.0.2.10",
    interface: "10.0.0.10",
    p2p_port: 30303,
    rpc_port: 8545,
  };
  const config = parseToml(besuTomlTemplate(join(tmp, "cfg"), profile));
  const now = new Date(1_800_000_000_000);
  const enode = `enode://${HH1.pub}@192.0.2.10:30303`;
  const perms = { "accounts-allowlist": ["0xaa", HH1.address], "nodes-allowlist": [enode] };
  const healthy = {
    eth_chainId: "0x7a6a",
    eth_syncing: false,
    eth_blockNumber: "0x64",
    net_peerCount: "0x3",
    eth_getBlockByNumber: { hash: "0xgenesis00000000", timestamp: "0x" + (1_800_000_000 - 2).toString(16) },
    admin_nodeInfo: { id: HH1.pub, ports: { listener: 30303 } },
    perm_getNodesAllowlist: [enode + "?discport=0"],
    perm_getAccountsAllowlist: ["0xAA", HH1.address],
    qbft_getValidatorsByBlockNumber: [HH1.address],
  };
  const ref = { eth_chainId: "0x7a6a", eth_blockNumber: "0x65", eth_getBlockByNumber: { hash: "0xgenesis00000000" } };
  const proxy = { eth_blockNumber: "0x65", net_version: "31338" };
  const L = "http://127.0.0.1:8545";

  it("sağlıklı düğüm: hepsi geçer; yalnız salt-okur yöntemler çağrılır", async () => {
    const calls: string[] = [];
    const rows = await nodeChecks(
      { rpc: L, chainRpc: "https://ref", publicRpc: "https://pub", profile, config, permissions: perms, now },
      { rpc: fakeRpc({ [L]: healthy, "https://ref": ref, "https://pub": proxy }, calls) },
    );
    expect(rows.filter((r) => r.result !== "pass")).toEqual([]);
    expect(rows.map((r) => r.id)).toEqual(["N1", "N2", "N3", "N4", "N5", "N6", "N7", "N8", "N9", "N10"]);
    expect(calls.every((m) => READ_ONLY_METHODS.has(m))).toBe(true);
  });

  it("dış uçta yönetim yöntemi yanıt verirse, P2P 0.0.0.0 ise, izin listesi farklıysa, saat kaymışsa: kaldı", async () => {
    const bad = parseToml(
      besuTomlTemplate(join(tmp, "cfg"), profile).replace('p2p-interface="10.0.0.10"', 'p2p-interface="0.0.0.0"'),
    );
    const rows = await nodeChecks(
      {
        rpc: L,
        chainRpc: "https://ref",
        publicRpc: "https://pub",
        profile,
        config: bad,
        permissions: { ...perms, "accounts-allowlist": ["0xbb"] },
        now: new Date(now.getTime() + 120_000),
      },
      { rpc: fakeRpc({ [L]: healthy, "https://ref": ref, "https://pub": { ...proxy, admin_nodeInfo: { id: "x" } } }) },
    );
    const by = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(by.N8).toMatchObject({ result: "fail", detail: expect.stringMatching(/admin_nodeInfo/) });
    expect(by.N9).toMatchObject({ result: "fail", detail: expect.stringMatching(/p2p-interface "0\.0\.0\.0"/) });
    expect(by.N6).toMatchObject({ result: "fail", detail: expect.stringMatching(/hesap eksik 1 \/ fazla 2/) });
    expect(by.N10.result).toBe("fail");
  });

  it("p2p-interface hiç yoksa (Besu varsayılanı 0.0.0.0) kaldı; RPC dış arayüzde kaldı", async () => {
    const t = besuTomlTemplate(join(tmp, "cfg"), profile)
      .replace(/^p2p-interface=.*$/m, "")
      .replace('rpc-http-host="127.0.0.1"', 'rpc-http-host="0.0.0.0"');
    const rows = await nodeChecks({ rpc: L, profile, config: parseToml(t), now }, { rpc: fakeRpc({ [L]: healthy }) });
    const n9 = rows.find((r) => r.id === "N9")!;
    expect(n9.result).toBe("fail");
    expect(n9.detail).toMatch(/p2p-interface yok/);
    expect(n9.detail).toMatch(/rpc-http-host/);
  });

  it("yerel uç dış adresteyse ve admin yanıtlıyorsa kaldı; mTLS reddi uyarı; başka anahtar kaldı; kümede değil uyarı", async () => {
    const X = "https://203.0.113.5:8545";
    const rows = await nodeChecks(
      { rpc: X, publicRpc: "https://pub", profile: { ...profile, node_public_key: "1".repeat(128) }, now },
      {
        rpc: fakeRpc({
          [X]: { ...healthy, qbft_getValidatorsByBlockNumber: ["0x" + "2".repeat(40)] },
          "https://pub": Object.fromEntries(
            [
              "admin_nodeInfo",
              "perm_getNodesAllowlist",
              "qbft_getValidatorsByBlockNumber",
              "debug_getBadBlocks",
              "txpool_besuStatistics",
              "eth_accounts",
              "eth_blockNumber",
              "net_version",
            ].map((m) => [m, new Error("certificate required")]),
          ),
        }),
      },
    );
    const by = Object.fromEntries(rows.map((r) => [r.id + (r.check.includes("Dış uçta") ? "x" : ""), r]));
    expect(by.N8.result).toBe("fail"); // yönetim yöntemi dış adresten
    expect(by.N8x).toMatchObject({ result: "warn", detail: expect.stringMatching(/mTLS/) });
    expect(by.N5.result).toBe("fail");
    expect(by.N7).toMatchObject({ result: "warn", detail: expect.stringMatching(/henüz kümede değil/) });
  });

  it("düğüm yanıtsızsa yalnız yapılandırma satırı ile durur", async () => {
    const rows = await nodeChecks({ rpc: L, config }, { rpc: fakeRpc({}) });
    expect(rows.map((r) => [r.id, r.result])).toEqual([
      ["N1", "fail"],
      ["N9", "pass"],
    ]);
  });
});

describe("MCP — düğüm araçları", () => {
  const root = join(tmp, "mcp-node");
  mkdirSync(root);
  const connect = async (env: NodeJS.ProcessEnv = {}, rpc?: Rpc) => {
    const server = createServer({ root, env, rpc, http: async () => ({ status: 404, text: "", contentType: "" }) });
    const client = new Client({ name: "test", version: "1" });
    const [a, c] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(c)]);
    return client;
  };
  const call = async (client: Client, name: string, args: Record<string, unknown>) => {
    const r = (await client.callTool({ name, arguments: args })) as {
      isError?: boolean;
      content: Array<{ text: string }>;
    };
    return { isError: !!r.isError, text: r.content[0].text };
  };

  it("araç adları listede", () => {
    expect(TOOLS.map((t) => t.name)).toEqual(
      expect.arrayContaining(["generate_node_key", "create_node_declaration", "check_node"]),
    );
  });

  it("generate_node_key: özel anahtar yanıtta yok; kök dışı reddedilir; create_node_declaration yazar", async () => {
    const c = await connect();
    const r = await call(c, "generate_node_key", { dir: "node-a", ...init, p2p_port: 30303 });
    expect(r.isError).toBe(false);
    const key = readFileSync(join(root, "node-a", "key"), "utf8");
    expect(r.text).not.toContain(key.slice(2));
    expect(r.text).not.toContain(key.slice(10, 40));
    expect(JSON.parse(r.text)).toMatchObject({ private_key_file: join("node-a", "key"), role: "validator" });
    expect(await call(c, "generate_node_key", { dir: "../escape", ...init })).toMatchObject({
      isError: true,
      text: "path is outside the server root",
    });
    const d = await call(c, "create_node_declaration", { dir: "node-a", contact: "noc@example.org" });
    expect(JSON.parse(d.text)).toMatchObject({ written: true, file: join("node-a", "tr-validator.json") });
    expect(d.text).not.toContain(key.slice(2));
    expect((await call(c, "create_node_declaration", { dir: "node-a", contact: "noc@example.org" })).isError).toBe(
      true,
    );
    expect(
      (await call(c, "create_node_declaration", { dir: "node-a", contact: "noc@example.org", out: "x.txt" })).text,
    ).toMatch(/file type/);
  });

  it("check_node: loopback yalnız TAMGA_ONBOARD_PRIVATE_NODES listesindeyse; satırlar güvenilmeyen veri notuyla", async () => {
    const closed = await connect();
    const r1 = JSON.parse((await call(closed, "check_node", { rpc: "http://127.0.0.1:1/" })).text);
    expect(r1.untrusted_data_notice).toMatch(/untrusted/);
    expect(r1.rows[0]).toMatchObject({ id: "N1", result: "fail", detail: expect.stringMatching(/loopback/) });
    const open = await connect({ TAMGA_ONBOARD_PRIVATE_NODES: "http://127.0.0.1:1" });
    const r2 = JSON.parse((await call(open, "check_node", { rpc: "http://127.0.0.1:1/" })).text);
    expect(r2.rows[0].detail).not.toMatch(/izinli değil/); // politika geçti, bağlantı reddedildi
    const fake = await connect({}, fakeRpc({ "http://127.0.0.1:8545": { eth_chainId: "0x1" } }));
    const r3 = JSON.parse((await call(fake, "check_node", { dir: "node-a" })).text);
    expect(r3.rows.find((x: { id: string }) => x.id === "N9").result).toBe("pass");
    expect((await call(fake, "check_node", { config: "node-a/key" })).text).toMatch(/file type/);
  });
});
