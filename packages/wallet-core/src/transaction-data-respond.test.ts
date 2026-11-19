/**
 * ADR-0091 K4 — işlem verisinin `respond`'da sunuma bağlanması: öğe `credential_ids` sırasında seçilen ilk SD-JWT VC sunumuna
 * bağlanır (seçimin sırasına bağlı değil); işlem verisi `checkRp` onayına bağlıdır — onaydan sonra istek nesnesinde değiştirilen ya
 * da silinen işlem verisiyle sunum yapılmaz.
 */
import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import {
  MemoryKeyStore,
  SoftwareKeyProvider,
  checkRp,
  confirmTransactionData,
  parseTransactionData,
  rawToJwk,
  respond,
  transactionDataFor,
  transactionDataHash,
  type Match,
  type RpRecord,
  type VpRequest,
} from "./index.js";
import { epochMillis } from "@tamga-network/core/time";

const FP = "ab".repeat(32);
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const creds = [
  { id: "a", format: "dc+sd-jwt" },
  { id: "b", format: "dc+sd-jwt" },
];
const rp = {
  legal_name: "Örnek",
  status: "ACTIVE",
  access_cert_fingerprint_sha256: FP,
  scopes: [],
} as unknown as RpRecord;
const anyMatch = { requested: [], credential: { vct: "v" } } as unknown as Match;
// imzası denetlenmeyen sahte SD-JWT (respond yalnız KB-JWT ekler; açıklama yok)
const combined = `${enc({ alg: "ES256" })}.${enc({})}.c2ln~`;

async function setup(items: unknown[]) {
  const td = parseTransactionData(items.map(enc), creds, ["t1"])!;
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  await keys.generate("k");
  const request = {
    clientId: "x509_hash:abc",
    nonce: "n-1",
    responseUri: "",
    origin: "https://site.example",
    leafFingerprint: FP,
    dcql: { credentials: creds },
    encJwk: { ...rawToJwk(p256.getPublicKey(p256.utils.randomSecretKey(), false)), use: "enc" },
    enc: "A128GCM",
    transactionData: td,
  } as unknown as VpRequest;
  const sel = (queryId: string) => ({
    match: { queryId, format: "dc+sd-jwt", credential: { vct: "v" } } as unknown as Match,
    keyRef: "k",
    combined,
    disclose: [] as string[],
  });
  return { td, keys, request, sel };
}
const kbHashes = (pres: string) => {
  const kb = pres.split("~").at(-1)!;
  return JSON.parse(Buffer.from(kb.split(".")[1], "base64url").toString("utf8")).transaction_data_hashes as
    string[] | undefined;
};

describe("işlem verisi → respond bağlaması (ADR-0091 K4)", () => {
  it("çok kimlikli öğe credential_ids sırasındaki ilk seçilen sunuma bağlanır (seçim sırası fark etmez)", async () => {
    const { td, keys, request, sel } = await setup([{ type: "t1", credential_ids: ["b", "a"] }]);
    const approval = checkRp(rp, request, anyMatch, epochMillis(Date.now())).approval!;
    confirmTransactionData(approval, td);
    const out = await respond({ request, approval, matches: [sel("a"), sel("b")], keys, http: (() => 0) as never });
    expect(kbHashes(out.vpToken.b[0])).toEqual([transactionDataHash(td[0].raw)]);
    expect(kbHashes(out.vpToken.a[0])).toBeUndefined();
    // aynı kural dışarıdan da: yanıttaki sorgulara göre
    expect(transactionDataFor(td, "b", ["a", "b"])).toHaveLength(1);
    expect(transactionDataFor(td, "a", ["a", "b"])).toHaveLength(0);
    expect(transactionDataFor(td, "a", ["a"])).toHaveLength(1);
  });

  it("onaydan sonra istekte işlem verisi silinir ya da değiştirilirse sunum yapılmaz (onay bağı)", async () => {
    const { td, keys, request, sel } = await setup([{ type: "t1", credential_ids: ["a"], amount: "10" }]);
    const now = epochMillis(Date.now());
    const a1 = checkRp(rp, request, anyMatch, now).approval!;
    confirmTransactionData(a1, td);
    const stripped = { ...request, transactionData: undefined } as VpRequest;
    await expect(
      respond({ request: stripped, approval: a1, matches: [sel("a")], keys, http: (() => 0) as never }),
    ).rejects.toMatchObject({ code: "trust_error" });
    const other = parseTransactionData([enc({ type: "t1", credential_ids: ["a"], amount: "9999" })], creds, ["t1"])!;
    const a2 = checkRp(rp, request, anyMatch, now).approval!;
    const swapped = { ...request, transactionData: other } as VpRequest;
    confirmTransactionData(a2, other);
    await expect(
      respond({ request: swapped, approval: a2, matches: [sel("a")], keys, http: (() => 0) as never }),
    ).rejects.toMatchObject({ code: "trust_error" });
  });
});
