// Tamga Network — Besu JSON-RPC method filter (ADR-0052 K5 / LP5). No dependencies; Node >= 22.
//
// Sits between nginx (TLS + mandatory client certificate, nginx.conf.example) and the Besu node's local RPC port:
//   client --mTLS--> nginx :443 --> filter 127.0.0.1:8550 --> Besu 127.0.0.1:8545
// Only the ETH, NET and WEB3 namespaces pass (read + eth_sendRawTransaction). Everything else — ADMIN, PERM, QBFT, DEBUG, TXPOOL,
// TRACE, MINER, … — and the eth_* methods that would ask the node to sign are refused. The JSON-RPC body is parsed: a single call
// or a batch; one refused method refuses the whole batch. Nothing is logged except counts (no addresses, no bodies).
//
//   TAMGA_RPC_FILTER_LISTEN=127.0.0.1:8550 TAMGA_RPC_FILTER_UPSTREAM=http://127.0.0.1:8545 node filter.mjs
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

export const ALLOWED_NAMESPACES = ["eth", "net", "web3"];
/** eth_* methods that sign with node-held keys, mine or subscribe — refused although in the ETH namespace. */
export const DENIED_METHODS = new Set([
  "eth_sendTransaction",
  "eth_sign",
  "eth_signTransaction",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "eth_accounts",
  "eth_coinbase",
  "eth_mining",
  "eth_getWork",
  "eth_submitWork",
  "eth_submitHashrate",
  "eth_subscribe",
  "eth_unsubscribe",
  // node topology (the node's own enode URL with its address, the services it runs) — not needed by clients
  "net_enode",
  "net_services",
]);
export const LIMITS = { maxBodyBytes: 256 * 1024, maxBatch: 50 };

export function methodAllowed(method) {
  if (typeof method !== "string" || !/^[a-z0-9]+_[A-Za-z0-9_]+$/.test(method)) return false;
  const ns = method.slice(0, method.indexOf("_"));
  return ALLOWED_NAMESPACES.includes(ns) && !DENIED_METHODS.has(method);
}

const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

/**
 * Decides on a request body. `{ ok: true, forward }` or `{ ok: false, status, body }` (JSON-RPC error object or array).
 * `forward` is the body re-serialised from what was parsed and checked here: the node never sees the client's bytes. A body with
 * a repeated key (`"method":"admin_peers", …, "method":"eth_blockNumber"`) is read differently by different JSON parsers; passing
 * the original bytes on would let the node act on a method this filter did not check.
 */
export function decide(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 400, body: rpcError(null, -32700, "parse error") };
  }
  const calls = Array.isArray(parsed) ? parsed : [parsed];
  if (calls.length === 0) return { ok: false, status: 400, body: rpcError(null, -32600, "empty batch") };
  if (calls.length > LIMITS.maxBatch)
    return { ok: false, status: 413, body: rpcError(null, -32600, "batch too large") };
  const errors = [];
  for (const c of calls) {
    if (typeof c !== "object" || c === null || c.jsonrpc !== "2.0" || typeof c.method !== "string")
      errors.push(rpcError(c?.id, -32600, "invalid request"));
    else if (!methodAllowed(c.method)) errors.push(rpcError(c.id, -32601, "method not allowed"));
  }
  if (errors.length === 0) return { ok: true, forward: JSON.stringify(parsed) };
  return { ok: false, status: 403, body: Array.isArray(parsed) ? errors : errors[0] };
}

export function createFilterServer({ upstream, maxBodyBytes = LIMITS.maxBodyBytes, onRefuse = () => {} }) {
  const up = new URL(upstream);
  if (!/^https?:$/.test(up.protocol)) throw new Error("upstream must be http(s)");
  return createServer((req, res) => {
    const send = (status, obj) => {
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(obj));
    };
    if (req.method !== "POST" || (req.url ?? "/").split("?")[0] !== "/")
      return send(405, rpcError(null, -32600, "POST / only"));
    if (!/^application\/json\b/i.test(req.headers["content-type"] ?? ""))
      return send(415, rpcError(null, -32600, "content-type must be application/json"));
    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on("data", (c) => {
      size += c.length;
      if (size > maxBodyBytes && !aborted) {
        aborted = true;
        send(413, rpcError(null, -32600, "body too large"));
        req.destroy();
      } else if (!aborted) chunks.push(c);
    });
    req.on("end", async () => {
      if (aborted) return;
      const text = Buffer.concat(chunks).toString("utf8");
      const d = decide(text);
      if (!d.ok) {
        onRefuse(d.status);
        return send(d.status, d.body);
      }
      try {
        const r = await fetch(up, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: d.forward,
          signal: AbortSignal.timeout(30_000),
        });
        res.writeHead(r.status, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(Buffer.from(await r.arrayBuffer()));
      } catch {
        send(502, rpcError(null, -32603, "upstream unavailable"));
      }
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const listen = process.env.TAMGA_RPC_FILTER_LISTEN ?? "127.0.0.1:8550";
  const upstream = process.env.TAMGA_RPC_FILTER_UPSTREAM ?? "http://127.0.0.1:8545";
  const i = listen.lastIndexOf(":");
  const host = listen.slice(0, i);
  if (!["127.0.0.1", "::1", "localhost"].includes(host.replace(/^\[|\]$/g, "")))
    throw new Error("the filter listens on loopback only; nginx terminates TLS in front of it");
  let refused = 0;
  const srv = createFilterServer({ upstream, onRefuse: () => refused++ });
  srv.listen(Number(listen.slice(i + 1)), host.replace(/^\[|\]$/g, ""), () =>
    console.log(`[rpc-filter] ${listen} -> ${upstream} (eth/net/web3 only)`),
  );
  setInterval(() => {
    if (refused) console.log(`[rpc-filter] refused requests in the last hour: ${refused}`);
    refused = 0;
  }, 3_600_000).unref();
}
