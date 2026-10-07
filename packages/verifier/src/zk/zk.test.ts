/**
 * ADR-0032 Aşama 3 — `mso_mdoc_zk` doğrulaması (paketle gelen WASM; Rust gerekmez). Fikstürler GERÇEK Longfellow ispatıdır
 * (`scripts/zk-fixtures.ts`): deneme kök CA → kurum yaprağı → Tamga kimlik belgesi → "age_over_18 = true" ispatı.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeIssuerId, computeSchemaId } from "@tamga-network/core";
import { buildZkDeviceResponse, parseZkDeviceResponse, decode, encode, CborTag } from "@tamga-network/mdoc";
import type { TrustSource, ZkCircuit } from "@tamga-network/trust";
import { dcqlFromPolicy, verifyPresentation, MemoryStatusCache, type Policy } from "../index.js";
import { verifyMdocZkFormat, WasmZkBackend, NativeZkBackend, zkBackendFromEnv, type ZkBackend } from "./index.js";

const FX = resolve(import.meta.dirname, "fixtures");
const rootDer = new Uint8Array(readFileSync(resolve(FX, "root.der")));
const issuerDer = new Uint8Array(readFileSync(resolve(FX, "issuer.der")));
const otherDer = new Uint8Array(readFileSync(resolve(FX, "other-issuer.der")));
const valid = new Uint8Array(readFileSync(resolve(FX, "valid.cbor")));
const S = JSON.parse(readFileSync(resolve(FX, "session.json"), "utf8")) as {
  clientId: string;
  nonce: string;
  responseUri: string;
  timestamp: string;
  now: number;
  docType: string;
  namespace: string;
  circuitId: string;
};
const b64u = (b: Uint8Array) => Buffer.from(b).toString("base64url");
const CIRCUIT: ZkCircuit = {
  circuit_id: S.circuitId,
  system: "longfellow-libzk-v1",
  version: 8,
  attributes: 1,
  sha256: "f44ab1a415f284251ea6ad5451d2588c1e7011eb9ba46091116e8caa4c8e0d83",
  status: "ACTIVE",
};
const issuerId = computeIssuerId("TR", issuerDer);
const schemaId = computeSchemaId(S.docType);
const backend: ZkBackend = new WasmZkBackend();

/** Asgari güven kaynağı: deneme kurumu kayıtlı, kimlik türüne yetkili; devre listede. */
function trustWith(circuits: ZkCircuit[] = [CIRCUIT]): TrustSource {
  const yes = (id: string) => (id === issuerId ? "YES" : "NO");
  return {
    isCredentialAcceptable: (id) => yes(id),
    isCredentialSchemaAcceptable: (id, sid) => (id === issuerId && sid === schemaId ? "YES" : "NO"),
    isRecognizedBy: () => "YES",
    schemaContentHash: () => null,
    schemaContentHashes: () => [],
    statusAnchor: () => null,
    relyingParty: () => null,
    relyingPartyByDnsName: () => null,
    issuer: (id) =>
      id === issuerId
        ? ({
            issuer_id: issuerId,
            legal_name: "Tamga ZK Test Issuer",
            category: "IDENTITY",
            assurance: "I2",
            class: "EAA",
          } as unknown as ReturnType<TrustSource["issuer"]>)
        : null,
    schema: (sid) =>
      sid === schemaId
        ? ({ schema_id: schemaId, vct: S.docType, status: "ACTIVE" } as ReturnType<TrustSource["schema"]>)
        : null,
    isWalletProviderKey: () => "NO",
    zkCircuit: (id) => circuits.find((c) => c.circuit_id === id) ?? null,
    zkCircuits: () => circuits,
    freshness: () => ({ source: "list", version: 1, ageSec: 0, healthy: true }),
  };
}

const base = {
  clientId: S.clientId,
  nonce: S.nonce,
  responseUri: S.responseUri,
  stateCode: "TR",
  now: S.now,
  rootCertsDer: [rootDer],
  expectedDocTypes: [S.docType],
  requestedElements: ["age_over_18"],
  namespace: S.namespace,
  maxSkewSec: 120,
  backend,
};
const run = (presentation: Uint8Array, over: Partial<typeof base> & { trust?: TrustSource } = {}) =>
  verifyMdocZkFormat(b64u(presentation), { ...base, trust: trustWith(), ...over });

/** Fikstürdeki ispatı başka ZkDocumentData ile yeniden paketler. */
function repack(
  edit: (d: ReturnType<typeof parseZkDeviceResponse>) => Partial<Parameters<typeof buildZkDeviceResponse>[0]>,
) {
  const z = parseZkDeviceResponse(valid);
  return buildZkDeviceResponse({
    docType: z.docType,
    zkSystemId: z.zkSystemId,
    timestamp: z.timestamp,
    disclosed: z.disclosed,
    msoX5chain: z.msoX5chain,
    proof: z.proof,
    ...edit(z),
  });
}

describe("mso_mdoc_zk — biçim (ZkDocument, TS13)", () => {
  it("çözülür: docType, devre, zaman damgası, açıklanan öğe; düz belge taşıyan yanıt reddedilir", () => {
    const z = parseZkDeviceResponse(valid);
    expect(z.docType).toBe(S.docType);
    expect(z.zkSystemId).toBe(S.circuitId);
    expect(z.disclosed).toEqual({ namespace: S.namespace, elements: { age_over_18: true } });
    expect(Buffer.from(z.elementCbor.age_over_18).toString("hex")).toBe("f5");
    const r = decode(valid) as Map<string, unknown>;
    r.set("documents", []);
    expect(() => parseZkDeviceResponse(encode(r as never))).toThrow(/zkDocuments only/);
    expect(new CborTag(24, new Uint8Array()).tag).toBe(24);
  });
});

describe("mso_mdoc_zk — doğrulama (WASM)", () => {
  it("geçerli ispat → A1–A3b, A8, Z1; açıklanan yalnız age_over_18; A4–A7 ispatın içinde", async () => {
    const r = await run(valid);
    expect(r.ok, r.ok ? "" : `${r.failedStep}: ${r.reason}`).toBe(true);
    if (!r.ok) return;
    expect(r.format).toBe("mso_mdoc_zk");
    expect(r.issuerId).toBe(issuerId);
    expect(r.claims).toEqual({ age_over_18: true });
    expect(r.aDone).toEqual(["A1", "A2", "A3", "A3b", "A8", "Z1"]);
    expect(r.status).toBeUndefined(); // ZK4: indeks yok
  }, 60_000);
  it("başka oturum (nonce) → Z1 RED (oturum dökümü ispata bağlı)", async () => {
    const r = await run(valid, { nonce: "n-baska" });
    expect(r).toMatchObject({ ok: false, failedStep: "Z1" });
  }, 60_000);
  it("değer kurcalanmış (false) → Z1 RED", async () => {
    const r = await run(
      repack((z) => ({ disclosed: { namespace: z.disclosed.namespace, elements: { age_over_18: false } } })),
    );
    expect(r).toMatchObject({ ok: false, failedStep: "Z1" });
  }, 60_000);
  it("başka kurumun sertifikası (aynı köke zincirli) → Z1 RED (kurum anahtarı ispata bağlı)", async () => {
    const r = await run(repack(() => ({ msoX5chain: [otherDer] })));
    expect(r).toMatchObject({ ok: false, failedStep: "Z1" });
  }, 60_000);
  it("bozulmuş ispat → Z1 RED", async () => {
    const r = await run(
      repack((z) => {
        const p = new Uint8Array(z.proof);
        p[1000] ^= 0x01;
        return { proof: p };
      }),
    );
    expect(r).toMatchObject({ ok: false, failedStep: "Z1" });
  }, 60_000);
  it("listede olmayan devre → Z1 RED (ZK2), ispat çalıştırılmaz", async () => {
    expect(await run(valid, { trust: trustWith([]) })).toMatchObject({ ok: false, failedStep: "Z1" });
  });
  it("devre dosyası listedeki özetle tutmuyor → Z1 RED", async () => {
    const r = await run(valid, {
      trust: trustWith([{ ...CIRCUIT, sha256: "0".repeat(64) }]),
      backend: new WasmZkBackend(),
    });
    expect(r).toMatchObject({ ok: false, failedStep: "Z1" });
    if (!r.ok) expect(r.reason).toMatch(/trusted list/);
  });
  it("devre listede ama ACTIVE değil → Z1 RED (derinlemesine savunma), ispat çalıştırılmaz", async () => {
    const r = await run(valid, { trust: trustWith([{ ...CIRCUIT, status: "SUSPENDED" }]) });
    expect(r).toMatchObject({ ok: false, failedStep: "Z1" });
    if (!r.ok) expect(r.indeterminate).toBeUndefined();
  });
  it("devre dosyası doğrulayıcıda yok → Z1 DOĞRULANAMADI (AP2; sunumun suçu değil)", async () => {
    const r = await run(valid, { backend: new WasmZkBackend({ circuitDir: FX }) });
    expect(r).toMatchObject({ ok: false, failedStep: "Z1", indeterminate: "SDK_VERSION_MISMATCH" });
  });
  it("WASM manifestle tutmuyor / yüklenemiyor → Z1 DOĞRULANAMADI", async () => {
    const mismatch = await run(valid, { backend: new WasmZkBackend({ expectedWasmSha256: "0".repeat(64) }) });
    expect(mismatch).toMatchObject({ ok: false, failedStep: "Z1", indeterminate: "SDK_VERSION_MISMATCH" });
    const broken = await run(valid, {
      backend: new WasmZkBackend({ wasmPath: resolve(FX, "session.json"), expectedWasmSha256: null }),
    });
    expect(broken).toMatchObject({ ok: false, failedStep: "Z1", indeterminate: "SDK_VERSION_MISMATCH" });
    const missing = await run(valid, { backend: new WasmZkBackend({ wasmPath: resolve(FX, "yok.wasm") }) });
    expect(missing).toMatchObject({ ok: false, failedStep: "Z1", indeterminate: "SDK_VERSION_MISMATCH" });
  });
  it("aynı iş parçacığında (inThread) da aynı sonuç; işçi olay döngüsünü kilitlemez", async () => {
    const inThread = new WasmZkBackend({ inThread: true });
    expect((await run(valid, { backend: inThread })).ok).toBe(true);
    const worker = new WasmZkBackend();
    let ticks = 0;
    const timer = setInterval(() => ticks++, 20);
    try {
      expect((await run(valid, { backend: worker })).ok).toBe(true);
    } finally {
      clearInterval(timer);
      await worker.close();
    }
    expect(ticks).toBeGreaterThan(0); // doğrulama sürerken zamanlayıcılar çalıştı
  }, 60_000);
  it("istenmeyen öğe açıklanmış → Z1 RED (ZK3)", async () => {
    const r = await run(
      repack((z) => ({
        disclosed: { namespace: z.disclosed.namespace, elements: { age_over_18: true, nationality: "TR" } },
      })),
    );
    expect(r).toMatchObject({ ok: false, failedStep: "Z1" });
    if (!r.ok) expect(r.reason).toMatch(/ZK3/);
  });
  it("zaman damgası pencere dışı → Z1 RED", async () => {
    expect(await run(valid, { now: S.now + 3600 })).toMatchObject({ ok: false, failedStep: "Z1" });
  });
  it("kök yok / zincir kurulmuyor → A3 RED", async () => {
    expect(await run(valid, { rootCertsDer: [] })).toMatchObject({ ok: false, failedStep: "A3" });
  });
  it("docType politikada değil → A8 RED", async () => {
    expect(await run(valid, { expectedDocTypes: ["org.iso.18013.5.1.mDL"] })).toMatchObject({
      ok: false,
      failedStep: "A8",
    });
  });
});

const policy: Policy = {
  policy_id: "age-over-18-zk",
  purpose: { "en-GB": "Confirm age 18+" },
  credentials: [
    {
      id: "age",
      vct_values: [S.docType],
      required_claims: ["age_over_18"],
      constraints: { age_over_18: true },
      format: "mso_mdoc_zk",
      namespace: S.namespace,
      accept_unrevocable_zk: true, // ZK4: iptal denetlenemez — bilerek kabul
    },
  ],
  trust: { min_issuer_assurance: "I1", allowed_categories: ["IDENTITY"], require_recognition: false, state_code: "TR" },
  freshness: { max_status_token_age_sec: 3600, max_trust_age_sec: 86400 },
};

describe("mso_mdoc_zk — politika ve tam hat", () => {
  it("DCQL: mso_mdoc_zk + zk_system_type (imzalı listedeki devre) + eşitlik değeri", () => {
    const q = dcqlFromPolicy(policy, { zkCircuits: [CIRCUIT] });
    expect(q.credentials[0]).toMatchObject({
      format: "mso_mdoc_zk",
      meta: {
        doctype_value: S.docType,
        zk_system_type: [
          {
            zkSystemId: S.circuitId,
            system: "longfellow-libzk-v1",
            params: { circuit_hash: S.circuitId, num_attributes: 1, version: 8 },
          },
        ],
      },
      claims: [{ path: [S.namespace, "age_over_18"], values: [true] }],
    });
    expect(() => dcqlFromPolicy(policy)).toThrow(/no trusted ZK circuit/);
    const range: Policy = {
      ...policy,
      credentials: [{ ...policy.credentials[0], constraints: { age_over_18: { min: 1 } } }],
    };
    expect(() => dcqlFromPolicy(range, { zkCircuits: [CIRCUIT] })).toThrow(/equality/);
  });
  it("verifyPresentation: ACCEPTED; Z1 yapıldı, D uygulanmaz (ZK4), değer ayrı kanalda", async () => {
    const { result, claims } = await verifyPresentation({
      presentation: b64u(valid),
      format: "mso_mdoc_zk",
      responseUri: S.responseUri,
      aud: S.clientId,
      nonce: S.nonce,
      policy,
      policyCredentialId: "age",
      trust: trustWith(),
      statusCache: new MemoryStatusCache(),
      rootCertsDer: [rootDer],
      now: S.now,
      zk: backend,
    });
    expect(result.outcome, `${result.failed_step}: ${result.failed_reason}`).toBe("ACCEPTED");
    expect(result.checks_performed).toContain("Z1");
    expect(result.checks_skipped).toEqual(expect.arrayContaining(["A4", "A6", "D1", "D6", "C4"]));
    expect(result.status.value).toBe("NOT_APPLICABLE");
    expect(result.status.reason).toMatch(/ZK4/);
    expect(result.disclosed_claims).toEqual(["age_over_18"]);
    expect(claims).toEqual({ age_over_18: true });
  }, 60_000);
  it("accept_unrevocable_zk: false → INDETERMINATE (D1, iptal denetlenemez — ZK4)", async () => {
    const strict: Policy = { ...policy, credentials: [{ ...policy.credentials[0], accept_unrevocable_zk: false }] };
    const { result } = await verifyPresentation({
      presentation: b64u(valid),
      format: "mso_mdoc_zk",
      responseUri: S.responseUri,
      aud: S.clientId,
      nonce: S.nonce,
      policy: strict,
      policyCredentialId: "age",
      trust: trustWith(),
      statusCache: new MemoryStatusCache(),
      rootCertsDer: [rootDer],
      now: S.now,
      zk: backend,
    });
    expect(result.outcome).toBe("INDETERMINATE");
    expect(result.failed_step).toBe("D1");
    expect(result.indeterminate_reason).toBe("STATUS_UNREACHABLE");
  }, 60_000);
  it("verifyPresentation: devre dosyası yok → INDETERMINATE (Z1), E4 denetim kaydı yine düşer", async () => {
    const audits: string[] = [];
    const { result } = await verifyPresentation({
      presentation: b64u(valid),
      format: "mso_mdoc_zk",
      responseUri: S.responseUri,
      aud: S.clientId,
      nonce: S.nonce,
      policy,
      policyCredentialId: "age",
      trust: trustWith(),
      statusCache: new MemoryStatusCache(),
      rootCertsDer: [rootDer],
      now: S.now,
      zk: new WasmZkBackend({ circuitDir: FX }),
      audit: (e) => audits.push(e.outcome),
    });
    expect(result.outcome).toBe("INDETERMINATE");
    expect(result.failed_step).toBe("Z1");
    expect(result.indeterminate_reason).toBe("SDK_VERSION_MISMATCH");
    expect(audits).toEqual(["INDETERMINATE"]);
  });
});

/**
 * Yerel arka uç (C7): ikili yoksa ya da yanıt vermezse WASM'a düşer, hata asla "geçerli" sayılmaz. Gerçek ikiliyle test yalnız
 * `TAMGA_ZK_NATIVE_BIN` verildiğinde çalışır (CI'da Rust yok): `cargo build --release --locked --features native --bin
 * tamga-zk-verify` (packages/verifier/zk).
 */
describe("mso_mdoc_zk — yerel arka uç (NativeZkBackend)", () => {
  it("ikili yok → WASM'a düşer, sonuç aynı; uyarı bir kez", async () => {
    const warns: string[] = [];
    const nb = new NativeZkBackend({
      binPath: resolve(FX, "yok-boyle-bir-ikili"),
      fallback: backend,
      onWarn: (m) => warns.push(m),
    });
    const r = await run(valid, { backend: nb });
    expect(r.ok).toBe(true);
    expect(nb.lastBackend).toBe("fallback");
    const r2 = await run(valid, { nonce: "n-baska", backend: nb });
    expect(r2).toMatchObject({ ok: false, failedStep: "Z1" });
    expect(warns).toHaveLength(1); // bekleme süresince yeniden denenmez
  }, 60_000);
  it("ikili yanıt vermiyor → süre aşımı, süreç kapatılır, WASM'a düşer", async () => {
    // node, stdin'i betik olarak okur ve hiç yanıt yazmaz: yanıtsız bir süreç yerine geçer
    const nb = new NativeZkBackend({ binPath: process.execPath, fallback: backend, timeoutMs: 300 });
    const r = await run(valid, { backend: nb });
    expect(r.ok).toBe(true);
    expect(nb.lastBackend).toBe("fallback");
    nb.close();
  }, 60_000);
  it("zkBackendFromEnv: değişken yoksa WASM, varsa yerel", () => {
    expect(zkBackendFromEnv({})).toBeInstanceOf(WasmZkBackend);
    expect(zkBackendFromEnv({ TAMGA_ZK_NATIVE_BIN: "/yok" })).toBeInstanceOf(NativeZkBackend);
  });
  const bin = process.env.TAMGA_ZK_NATIVE_BIN;
  it.skipIf(!bin)(
    "gerçek ikili: geçerli → kabul, başka nonce / kurcalanmış → RED; sıralı çağrılar aynı süreçte",
    async () => {
      const nb = new NativeZkBackend({ binPath: bin!, fallback: backend });
      try {
        const times: number[] = [];
        for (let i = 0; i < 5; i++) {
          const t0 = performance.now();
          const r = await run(valid, { backend: nb });
          times.push(performance.now() - t0);
          expect(r.ok).toBe(true);
          expect(nb.lastBackend).toBe("native");
        }
        times.sort((a, b) => a - b);
        console.log(
          `yerel ZK doğrulama (ilk: başlatma dahil) ortanca ${Math.round(times[2])} ms, en kısa ${Math.round(times[0])} ms`,
        );
        expect(await run(valid, { nonce: "n-baska", backend: nb })).toMatchObject({ ok: false, failedStep: "Z1" });
        const tampered = repack((z) => ({
          disclosed: { namespace: z.disclosed.namespace, elements: { age_over_18: false } },
        }));
        expect(await run(tampered, { backend: nb })).toMatchObject({ ok: false, failedStep: "Z1" });
        expect(nb.lastBackend).toBe("native");
      } finally {
        nb.close();
      }
    },
    120_000,
  );
});
