/**
 * ADR-0074 K4 (PJ5) — çapa günlüğünün yeni satır türleri: `registration_status` (kayıt sertifikası durum listesi, ADR-0068) ve
 * `list_view` (ETSI XML / LoTE görünümleri, ADR-0066). Yükleyici bunları tanır (bilinmeyen tür hâlâ DURDURUR), depoya son satırı
 * yazar, sürüm/sayaç geri gidemez; baştaki kontrol noktasının `state`'i bu satırları da taşır (TL12).
 */
import { beforeAll, describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { CompactSign, importPKCS8 } from "jose";
import { Anchor, certFingerprintSha256Hex, loadTrustSet, sha256Tag, utf8, TL_TYP } from "./index.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const ALG = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
const NOW = new Date("2026-11-04T12:00:00Z");
const H = (c: string) => `sha256:${c.repeat(64)}`;

let signer: { fp: string; sign: (o: unknown) => Promise<string> };
beforeAll(async () => {
  const keys = (await webcrypto.subtle.generateKey(ALG, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=anchor kinds",
    notBefore: new Date(NOW.getTime() - 86400_000),
    notAfter: new Date(NOW.getTime() + 86400_000 * 30),
    signingAlgorithm: ALG,
    keys,
  });
  const der = new Uint8Array(cert.rawData);
  const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", keys.privateKey)).toString("base64");
  const key = await importPKCS8(`-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----`, "ES256");
  const x5c = [Buffer.from(der).toString("base64")];
  signer = {
    fp: certFingerprintSha256Hex(der),
    sign: (o) =>
      new CompactSign(utf8(JSON.stringify(o))).setProtectedHeader({ alg: "ES256", typ: TL_TYP, x5c }).sign(key),
  };
});

async function load(bodies: Array<Record<string, unknown>>) {
  const lotl = {
    list_format_version: "1.0",
    list_type: "lotl",
    version: 1,
    issued_at: "2026-11-01T00:00:00Z",
    next_update: "2026-12-01T00:00:00Z",
    previous_version_hash: null,
    operator: { name: "Tamga", status: "provisional", on_behalf_of: "consortium" },
    anchor_signing_keys: [{ fingerprint_sha256: signer.fp, status: "ACTIVE" }],
    national_lists: [],
    schemas: [],
    wallet_providers: [],
    pid_providers: [],
  };
  const lines: string[] = [];
  let prev: string | null = null;
  for (const [i, b] of bodies.entries()) {
    const line = await signer.sign({ seq: i, previous_hash: prev, ts: "2026-11-04T11:30:00Z", ...b });
    lines.push(line);
    prev = sha256Tag(utf8(line));
  }
  return loadTrustSet({
    lotlJws: await signer.sign(lotl),
    nationalListJws: {},
    anchorsJsonl: lines.join("\n") + "\n",
    rootFingerprints: [signer.fp],
    now: NOW,
    versionMemory: "none",
  });
}

const rs = (v: number, h = "a") => ({
  kind: "registration_status",
  list_uri: "https://trust.tamga.network/status/wrprc/1",
  content_hash: H(h),
  list_version: v,
  published_at: "2026-11-04T11:00:00Z",
});
const lv = (v: number, file = "tl-tr.xml") => ({
  kind: "list_view",
  file,
  format: "etsi-tl-xml",
  source_file: "tl-tr",
  source_version: v,
  content_hash: H("b"),
});

describe("ADR-0074 K4 — çapa günlüğü satır türleri", () => {
  it("registration_status ve list_view yüklenir; depoda son satır tutulur", async () => {
    const { store, report } = await load([rs(1), lv(7), rs(2, "c"), lv(8, "lote/wallet-providers.jws")]);
    expect(report.anchorsLoaded).toBe(4);
    const r = store.registration_status_anchors.get("https://trust.tamga.network/status/wrprc/1");
    expect(r?.list_version).toBe(2);
    expect(r?.content_hash).toBe(H("c"));
    expect(store.list_view_anchors.get("tl-tr.xml")?.source_version).toBe(7);
    expect(store.list_view_anchors.get("lote/wallet-providers.jws")?.seq).toBe(3);
    // doğrulama kararına girmez: durum çapası ve şema çapası etkilenmez
    expect(store.status_anchors.size).toBe(0);
  });

  it("sayaç ya da kaynak sürümü geri giderse yükleme DURUR (CH4 karşılığı)", async () => {
    await expect(load([rs(2), rs(2)])).rejects.toThrow(/registration_status list_version not monotonic/);
    await expect(load([lv(5), lv(4)])).rejects.toThrow(/list_view source_version not monotonic/);
  });

  it("biçim: özet sha256:<hex>, dosya yolunda `..` yok, bilinmeyen biçim ve tür reddedilir", () => {
    const base = { seq: 0, previous_hash: null, ts: "2026-11-04T11:30:00Z" };
    expect(Anchor.safeParse({ ...base, ...rs(1) }).success).toBe(true);
    expect(Anchor.safeParse({ ...base, ...rs(1), content_hash: "sha256-AAAA" }).success).toBe(false);
    expect(Anchor.safeParse({ ...base, ...lv(1, "lote/../tl-tr.jws") }).success).toBe(false);
    expect(Anchor.safeParse({ ...base, ...lv(1), format: "pdf" }).success).toBe(false);
    expect(Anchor.safeParse({ ...base, kind: "future_kind" }).success).toBe(false);
  });

  it("TL12: baştaki kontrol noktasının durumu yeni satırları taşır", async () => {
    const state = {
      status_lists: [],
      schemas: [],
      registration_status: [{ ...rs(4), seq: 3 }].map(({ kind: _k, ...r }) => r),
      list_views: [{ ...lv(9), seq: 2 }].map(({ kind: _k, ...r }) => r),
    };
    const cp = {
      kind: "checkpoint",
      archive: { file: "archive/anchors-0000000-0000003.jsonl", sha256: H("d"), seq_from: 0, seq_to: 3, lines: 4 },
      state,
    };
    // kontrol noktası seq 4; previous_hash arşivin son satırı (yükleyici arşivi okumaz)
    const line = await signer.sign({ seq: 4, previous_hash: H("e"), ts: "2026-11-04T11:40:00Z", ...cp });
    const next = await signer.sign({
      seq: 5,
      previous_hash: sha256Tag(utf8(line)),
      ts: "2026-11-04T11:50:00Z",
      ...rs(5),
    });
    const { store } = await loadTrustSet({
      lotlJws: await signer.sign({
        list_format_version: "1.0",
        list_type: "lotl",
        version: 1,
        issued_at: "2026-11-01T00:00:00Z",
        next_update: "2026-12-01T00:00:00Z",
        previous_version_hash: null,
        operator: { name: "Tamga", status: "provisional", on_behalf_of: "consortium" },
        anchor_signing_keys: [{ fingerprint_sha256: signer.fp, status: "ACTIVE" }],
        national_lists: [],
        schemas: [],
        wallet_providers: [],
        pid_providers: [],
      }),
      nationalListJws: {},
      anchorsJsonl: `${line}\n${next}\n`,
      rootFingerprints: [signer.fp],
      now: NOW,
      versionMemory: "none",
    });
    expect(store.list_view_anchors.get("tl-tr.xml")?.source_version).toBe(9);
    expect(store.registration_status_anchors.get(rs(1).list_uri)?.list_version).toBe(5);
  });
});
