import { describe, it, expect } from "vitest";
import { parseTransactionData, transactionDataFor, transactionDataHash } from "./transaction-data.js";
import { WalletError } from "./http.js";

const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const creds = [
  { id: "pid", format: "dc+sd-jwt" },
  { id: "md", format: "mso_mdoc" },
  { id: "nb", format: "dc+sd-jwt", require_cryptographic_holder_binding: false },
];
const code = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    return e instanceof WalletError ? e.code : "other";
  }
  return "none";
};

describe("işlem verisi (ADR-0091, OpenID4VP 1.0 §5.1)", () => {
  it("alan yoksa undefined; tanınan tür kabul edilir ve sorguya bağlanır", () => {
    expect(parseTransactionData(undefined, creds)).toBeUndefined();
    const raw = enc({ type: "t1", credential_ids: ["pid"], transaction_data_hashes_alg: ["sha-256"], amount: "10" });
    const [t] = parseTransactionData([raw], creds, ["t1"])!;
    expect(t).toMatchObject({ raw, type: "t1", credentialIds: ["pid"], hashesAlgRequested: true });
    expect(transactionDataFor([t], "pid")).toHaveLength(1);
    expect(transactionDataFor([t], "md")).toHaveLength(0);
    expect(transactionDataHash(raw)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("varsayılan: hiçbir tür tanınmaz → işlem verili istek reddedilir (yok sayılmaz)", () => {
    expect(code(() => parseTransactionData([enc({ type: "t1", credential_ids: ["pid"] })], creds))).toBe(
      "invalid_transaction_data",
    );
  });

  it("kurala uymayan öğeler reddedilir", () => {
    const t = (o: unknown) => code(() => parseTransactionData([typeof o === "string" ? o : enc(o)], creds, ["t1"]));
    expect(t("not base64url!")).toBe("invalid_transaction_data");
    expect(t(enc([1]))).toBe("invalid_transaction_data");
    expect(t({ credential_ids: ["pid"] })).toBe("invalid_transaction_data");
    expect(t({ type: "t1", credential_ids: [] })).toBe("invalid_transaction_data");
    expect(t({ type: "t1", credential_ids: ["yok"] })).toBe("invalid_transaction_data");
    expect(t({ type: "t1", credential_ids: ["md"] })).toBe("invalid_transaction_data");
    expect(t({ type: "t1", credential_ids: ["nb"] })).toBe("invalid_transaction_data");
    expect(t({ type: "t1", credential_ids: ["pid"], transaction_data_hashes_alg: ["sha-512"] })).toBe(
      "invalid_transaction_data",
    );
    expect(code(() => parseTransactionData([], creds, ["t1"]))).toBe("invalid_transaction_data");
    const one = enc({ type: "t1", credential_ids: ["pid"] });
    expect(code(() => parseTransactionData([one, one], creds, ["t1"]))).toBe("invalid_transaction_data");
    expect(
      code(() =>
        parseTransactionData(
          Array.from({ length: 11 }, (_, i) => enc({ type: "t1", credential_ids: ["pid"], n: i })),
          creds,
          ["t1"],
        ),
      ),
    ).toBe("invalid_transaction_data");
    expect(t({ type: "t1", credential_ids: ["pid"], pad: "x".repeat(9000) })).toBe("invalid_transaction_data");
  });

  it("onay: checkRp onayı olmadan işlem verisi onaylanamaz", async () => {
    const { confirmTransactionData } = await import("./oid4vp.js");
    expect(code(() => confirmTransactionData({}, []))).toBe("trust_error");
  });
});
