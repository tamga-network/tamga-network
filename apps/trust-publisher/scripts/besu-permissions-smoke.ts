/**
 * Yerel izinli Besu ağı duman testi (ADR-0052, C33 (4)) — YALNIZ yerel geliştirme zinciri (31338); elle çalıştırılır, CI'da değil.
 *
 *   powershell -File scripts\besu-dev.ps1 -Init -Permissioned
 *   powershell -File scripts\besu-dev.ps1 -Start -Permissioned           # düğüm 1 (tek kurucu doğrulayıcı), başlangıç izin dosyası
 *   npm run chain:besu:deploy                                            # kontratlar (hesaplar #0..#4 başlangıç listesinde)
 *   powershell -File scripts\besu-dev.ps1 -Apply -Permissioned           # izin listesi zincirden → yükle → check
 *   npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts accounts
 *   powershell -File scripts\besu-dev.ps1 -Start -Permissioned -Node 2   # düğüm 2 (tam düğüm, düğüm 1'e statik eş)
 *   powershell -File scripts\besu-dev.ps1 -Apply -Permissioned
 *   npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-add      # düğüm 2 doğrulayıcı olur (QBFT oyu)
 *   npx tsx apps/trust-publisher/scripts/besu-permissions-smoke.ts vote-remove   # iki doğrulayıcı da çıkarma oyu verir
 *   powershell -File scripts\besu-dev.ps1 -Stop -Permissioned
 *
 * accounts    : izin listesinde OLMAYAN hesap (#9) işlem gönderemez; listedeki devlet delegesi (#3) gönderir.
 * vote-add    : düğüm 1 `qbft_proposeValidatorVote(#2, true)`; doğrulayıcı kümesi [#1, #2] olur ve bloklar iki doğrulayıcıyla sürer.
 * vote-remove : düğüm 1 ve 2 `qbft_proposeValidatorVote(#2, false)` (2 doğrulayıcıda çoğunluk = 2 oy); küme [#1]'e döner.
 * Çıkış 0 = beklenen oldu.
 */
import { HDNodeWallet, JsonRpcProvider } from "ethers";

const MNEMONIC = "test test test test test test test test test test test junk";
const RPC = { 1: "http://127.0.0.1:8546", 2: "http://127.0.0.1:8547" } as const;
const wallet = (i: number) => HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`);
const V2 = wallet(2).address.toLowerCase();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rpc(url: string, method: string, params: unknown[] = []): Promise<any> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = (await r.json()) as { result?: unknown; error?: { message?: string } };
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}
const validators = async (url: string) =>
  ((await rpc(url, "qbft_getValidatorsByBlockNumber", ["latest"])) as string[]).map((a) => a.toLowerCase()).sort();
const blockNo = async (url: string) => Number(await rpc(url, "eth_blockNumber"));

async function waitFor(what: string, f: () => Promise<boolean>, sec = 90) {
  for (let i = 0; i < sec; i++) {
    if (await f()) return;
    await sleep(1000);
  }
  throw new Error(`${what}: ${sec} sn içinde olmadı`);
}

async function blocksAdvance(url: string, n = 3) {
  const b0 = await blockNo(url);
  await waitFor(`blok ${b0} → ${b0 + n}`, async () => (await blockNo(url)) >= b0 + n, 30);
  return { from: b0, to: await blockNo(url) };
}

async function accounts() {
  const provider = new JsonRpcProvider(RPC[1], undefined, { cacheTimeout: -1 });
  const chainId = Number((await provider.getNetwork()).chainId);
  if (chainId !== 31338) throw new Error(`yalnız yerel geliştirme zinciri (chainId ${chainId})`);
  const send = async (i: number) => {
    const w = wallet(i).connect(provider);
    const tx = await w.sendTransaction({ to: w.address, value: 0n, type: 0, gasPrice: 0n, gasLimit: 21_000n });
    const rc = await tx.wait();
    return { hash: tx.hash, status: rc?.status, block: rc?.blockNumber };
  };
  let unlisted: unknown;
  try {
    unlisted = { sent: await send(9) };
  } catch (e) {
    // düğümün kendi hata metni (ethers "could not coalesce error" ile sarar)
    const x = e as { error?: { message?: string }; info?: { error?: { message?: string } }; shortMessage?: string };
    unlisted = { rejected: x.error?.message ?? x.info?.error?.message ?? x.shortMessage ?? (e as Error).message };
  }
  const listed = await send(3);
  const out = { unlisted_account_9: unlisted, listed_state_delegate_3: listed };
  console.log(JSON.stringify(out, null, 2));
  provider.destroy();
  return (unlisted as { rejected?: string }).rejected && listed.status === 1 ? 0 : 1;
}

async function voteAdd() {
  const before = await validators(RPC[1]);
  if (before.includes(V2)) throw new Error("düğüm 2 zaten doğrulayıcı");
  const peers = Number(await rpc(RPC[1], "net_peerCount"));
  if (peers < 1) throw new Error("düğüm 1'in eşi yok — düğüm 2 bağlı değil (izin listesi uygulandı mı?)");
  await rpc(RPC[1], "qbft_proposeValidatorVote", [V2, true]);
  await waitFor("düğüm 2 doğrulayıcı kümesinde", async () => (await validators(RPC[1])).includes(V2));
  await rpc(RPC[1], "qbft_discardValidatorVote", [V2]); // bekleyen oy temizlenir (yeniden oylanmasın)
  const advance = await blocksAdvance(RPC[1]);
  const after = await validators(RPC[2]);
  console.log(JSON.stringify({ before, after_on_node2: after, peers, advance }, null, 2));
  return after.includes(V2) && after.length === 2 ? 0 : 1;
}

async function voteRemove() {
  const before = await validators(RPC[1]);
  if (!before.includes(V2)) throw new Error("düğüm 2 doğrulayıcı değil");
  // 2 doğrulayıcıda çıkarma çoğunluğu (> 1/2) = iki oy; oy, düğüm sıra kendisine gelip blok önerdiğinde bloğa girer
  await rpc(RPC[1], "qbft_proposeValidatorVote", [V2, false]);
  await rpc(RPC[2], "qbft_proposeValidatorVote", [V2, false]);
  await waitFor("düğüm 2 kümeden çıktı", async () => !(await validators(RPC[1])).includes(V2));
  for (const n of [1, 2] as const) await rpc(RPC[n], "qbft_discardValidatorVote", [V2]).catch(() => undefined);
  const advance = await blocksAdvance(RPC[1]);
  const after = await validators(RPC[1]);
  console.log(JSON.stringify({ before, after, advance }, null, 2));
  return after.length === 1 && !after.includes(V2) ? 0 : 1;
}

const cmd = process.argv[2];
const code =
  cmd === "accounts"
    ? await accounts()
    : cmd === "vote-add"
      ? await voteAdd()
      : cmd === "vote-remove"
        ? await voteRemove()
        : 2;
if (code === 2) console.error("kullanım: besu-permissions-smoke.ts accounts | vote-add | vote-remove");
process.exit(code);
