/**
 * ADR-0052 K5 / LP5 — JSON-RPC method filter in front of a Besu node: only ETH / NET / WEB3 pass (no signing eth_* methods);
 * ADMIN, PERM, QBFT, DEBUG, TXPOOL are refused, also inside a batch; malformed, oversized and non-POST requests are refused;
 * allowed calls reach the upstream unchanged.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";

// @ts-expect-error — plain ESM module without type declarations (runs on bare Node on the RPC host)
import { createFilterServer, decide, methodAllowed } from "./filter.mjs";

describe("rpc filter — decide", () => {
  it("namespaces", () => {
    for (const m of [
      "eth_blockNumber",
      "eth_call",
      "eth_getLogs",
      "eth_sendRawTransaction",
      "net_version",
      "web3_clientVersion",
    ])
      expect(methodAllowed(m), m).toBe(true);
    for (const m of [
      "admin_peers",
      "admin_addPeer",
      "perm_addAccountsToAllowlist",
      "perm_getNodesAllowlist",
      "qbft_proposeValidatorVote",
      "debug_traceTransaction",
      "txpool_besuTransactions",
      "trace_block",
      "miner_start",
      "eth_sendTransaction",
      "eth_sign",
      "eth_accounts",
      "eth_subscribe",
      "net_enode",
      "net_services",
      "rpc_modules",
      "ETH_blockNumber",
      "eth",
      "",
    ])
      expect(methodAllowed(m), m).toBe(false);
  });

  it("single call, batch, malformed", () => {
    const single = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] });
    expect(decide(single)).toEqual({ ok: true, forward: single });
    const one = decide(JSON.stringify({ jsonrpc: "2.0", id: 7, method: "admin_nodeInfo" }));
    expect(one).toMatchObject({ ok: false, status: 403, body: { id: 7, error: { code: -32601 } } });
    const batch = decide(
      JSON.stringify([
        { jsonrpc: "2.0", id: 1, method: "eth_blockNumber" },
        { jsonrpc: "2.0", id: 2, method: "perm_getAccountsAllowlist" },
      ]),
    );
    expect(batch.ok).toBe(false);
    expect(batch.body).toEqual([{ jsonrpc: "2.0", id: 2, error: { code: -32601, message: "method not allowed" } }]);
    expect(decide("{not json")).toMatchObject({ ok: false, status: 400 });
    expect(decide("[]")).toMatchObject({ ok: false, status: 400 });
    expect(decide(JSON.stringify({ id: 1, method: "eth_blockNumber" }))).toMatchObject({ ok: false, status: 403 });
    const big = Array.from({ length: 51 }, (_, i) => ({ jsonrpc: "2.0", id: i, method: "eth_blockNumber" }));
    expect(decide(JSON.stringify(big))).toMatchObject({ ok: false, status: 413 });
  });
});

describe("rpc filter — server", () => {
  let upstream: Server;
  let filter: Server;
  let seen: string[] = [];
  let base = "";
  beforeAll(async () => {
    upstream = createServer((req, res) => {
      let b = "";
      req.on("data", (c) => (b += c));
      req.on("end", () => {
        seen.push(b);
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x10" }));
      });
    });
    await new Promise<void>((r) => upstream.listen(0, "127.0.0.1", r));
    filter = createFilterServer({
      upstream: `http://127.0.0.1:${(upstream.address() as { port: number }).port}`,
      maxBodyBytes: 1024,
    });
    await new Promise<void>((r) => filter.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(filter.address() as { port: number }).port}`;
  });
  afterAll(() => {
    filter.close();
    upstream.close();
  });
  const post = (body: string, path = "/", type = "application/json") =>
    fetch(base + path, { method: "POST", headers: { "content-type": type }, body });

  it("allowed call is forwarded unchanged; refused one never reaches the node", async () => {
    seen = [];
    const ok = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] });
    const r = await post(ok);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { result: string }).result).toBe("0x10");
    expect(seen).toEqual([ok]);
    const bad = await post(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "admin_peers" }));
    expect(bad.status).toBe(403);
    expect(seen).toHaveLength(1);
  });

  it("repeated keys: the node receives what the filter checked, never the client's bytes (review 2026-11-10)", async () => {
    // JSON parsers disagree on a repeated key (first wins / last wins). The filter reads the LAST one; a node reading the FIRST
    // would run the unchecked method if the original bytes were passed on.
    const smuggle = '{"jsonrpc":"2.0","id":1,"method":"admin_peers","params":[],"method":"eth_blockNumber"}';
    const d = decide(smuggle);
    expect(d.ok).toBe(true);
    expect(d.forward).toBe('{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}');
    expect(d.forward).not.toContain("admin_peers");
    // the other order is refused outright
    expect(decide('{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[],"method":"admin_peers"}').ok).toBe(false);
    // a "__proto__" member does not change the method that is checked or forwarded
    const proto = decide('{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","__proto__":{"method":"admin_peers"}}');
    expect(proto.ok).toBe(true);
    expect(JSON.parse(proto.forward).method).toBe("eth_blockNumber");
    seen = [];
    expect((await post(smuggle)).status).toBe(200);
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toContain("admin_peers");
    expect(JSON.parse(seen[0]).method).toBe("eth_blockNumber");
    // batch with a repeated key inside one call
    seen = [];
    const batch = '[{"jsonrpc":"2.0","id":1,"method":"debug_traceBlock","method":"net_version"}]';
    expect((await post(batch)).status).toBe(200);
    expect(seen[0]).toBe('[{"jsonrpc":"2.0","id":1,"method":"net_version"}]');
  });

  it("method, path, content type and size limits", async () => {
    expect((await fetch(base + "/", { method: "GET" })).status).toBe(405);
    expect((await post("{}", "/admin")).status).toBe(405);
    expect((await post("{}", "/", "text/plain")).status).toBe(415);
    const huge = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: ["x".repeat(4096)] });
    expect((await post(huge)).status).toBe(413);
  });
});
