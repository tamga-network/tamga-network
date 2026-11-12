/**
 * trust-publisher CLI (güven listesini İMZALAYAN araç) — iç inceleme Y11. Araç gerçek süreç olarak, geçici klasörde çalışır
 * (TAMGA_TP_REGISTRY / TAMGA_TP_DIST); gerçek registry/ ve dist/'e dokunulmaz. Kanıtlananlar (SPEC-TRUST-0001):
 * sağlıklı ilk set, tekdüze sürüm + önceki sürüm özeti zinciri (TL2), arşiv kopyaları, statü değişiminde geçmişin korunması,
 * çapa günlüğü arşivi + tam zincir doğrulaması (TL10/TL12), kurcalanmış liste dosyasının reddi.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sha256Tag, utf8 } from "@tamga-network/trust";

const ROOT = resolve(import.meta.dirname, "../../..");
const CLI = resolve(ROOT, "apps/trust-publisher/src/cli.ts");
const TSX = resolve(ROOT, "node_modules/tsx/dist/cli.mjs");
const ready =
  existsSync(resolve(ROOT, "ops/pki/tl-signer-1.pkcs8.pem")) &&
  existsSync(resolve(ROOT, "packages/schemas/dist/index.json"));

// Her test tsx ile CLI'yi ayrı süreçte başlatır (spawnSync); tam pakette yük altında 20 sn'lik varsayılan test süresi yetmiyordu
// (kontrol 2026-11-03) — dosya tek başına: `npx vitest run apps/trust-publisher/test/cli.test.ts` (docs/audit/build-and-test.md).
describe.skipIf(!ready)("trust-publisher CLI (geçici klasörde)", { timeout: 180_000 }, () => {
  const tmp = mkdtempSync(join(tmpdir(), "tamga-tp-"));
  const REG = join(tmp, "registry");
  const DIST = join(tmp, "dist");
  const run = (args: string[], extraEnv: Record<string, string> = {}) => {
    const r = spawnSync(process.execPath, [TSX, CLI, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, TAMGA_TP_REGISTRY: REG, TAMGA_TP_DIST: DIST, ...extraEnv },
      timeout: 60_000,
    });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const json = (f: string) => JSON.parse(readFileSync(join(DIST, f), "utf8"));
  const verify = (full = false) => {
    const r = run(full ? ["verify", "--full"] : ["verify"]);
    const start = r.out.indexOf("{");
    return { code: r.code, report: start >= 0 ? JSON.parse(r.out.slice(start)).report : null, err: r.err };
  };

  beforeAll(() => {
    cpSync(resolve(ROOT, "apps/trust-publisher/registry"), REG, { recursive: true });
    mkdirSync(DIST);
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("ilk derleme: imzalı lotl + tl-tr, sürüm 1, önceki özet yok; doğrulama sağlıklı", () => {
    const b = run(["build"]);
    expect(b.code, b.err).toBe(0);
    for (const f of ["lotl.jws", "tl-tr.jws", "lotl.json", "tl-tr.json", "keys/root-fingerprints.json", "CHANGELOG.md"])
      expect(existsSync(join(DIST, f)), f).toBe(true);
    expect(json("lotl.json").version).toBe(1);
    expect(json("tl-tr.json").previous_version_hash).toBeNull();
    // keys/: yalnız listenin andığı sertifikalar (ADR-0042: gerçek ağda cüzdan sağlayıcı anahtarı yok)
    expect(existsSync(join(DIST, "keys", "tl-signer-1.cert.pem"))).toBe(true);
    expect(existsSync(join(DIST, "keys", "root-ca.cert.pem"))).toBe(true);
    expect(existsSync(join(DIST, "keys", "wallet-provider.cert.pem"))).toBe(false);
    const v = verify();
    expect(v.code).toBe(0);
    expect(v.report.healthy).toBe(true);
  });

  it("TL2: her derleme sürümü bir artırır ve önceki .jws'in özetine zincirlenir; eski sürüm arşivde kalır", () => {
    const prevJws = readFileSync(join(DIST, "tl-tr.jws"), "utf8");
    expect(run(["build"]).code).toBe(0);
    const tl = json("tl-tr.json");
    expect(tl.version).toBe(2);
    expect(tl.previous_version_hash).toBe(sha256Tag(utf8(prevJws)));
    const archived = readdirSync(join(DIST, "archive"));
    expect(archived).toContain("tl-tr.v0001.jws");
    expect(archived).toContain("tl-tr.v0002.jws");
    expect(readFileSync(join(DIST, "archive", "tl-tr.v0001.jws"), "utf8")).toBe(prevJws);
  });

  it("statü değişimi: kayıt güncellenir, status_history silinmez, liste yeniden imzalanır ve sağlıklı kalır", () => {
    const src = JSON.parse(readFileSync(join(REG, "tl-tr.source.json"), "utf8"));
    const slug = src.issuers.find((i: { status: string }) => i.status === "ACTIVE").slug as string;
    const before = src.issuers.find((i: { slug: string }) => i.slug === slug).status_history.length;
    // O5: gerçek ağ kayıt defterine yazma açık onay ister (TAMGA_CONFIRM_PROD = hedef); onaysız ya da başka adla RED, dosya değişmez
    const raw = readFileSync(join(REG, "tl-tr.source.json"), "utf8");
    for (const env of [{}, { TAMGA_CONFIRM_PROD: "baska-kurum" }] as Array<Record<string, string>>) {
      const denied = run(["status", slug, "SUSPENDED", "--reason", "test"], env);
      expect(denied.code).toBe(2);
      expect(denied.err).toMatch(/TAMGA_CONFIRM_PROD/);
      expect(readFileSync(join(REG, "tl-tr.source.json"), "utf8")).toBe(raw);
    }
    const r = run(["status", slug, "SUSPENDED", "--reason", "test"], { TAMGA_CONFIRM_PROD: slug });
    expect(r.code, r.err).toBe(0);
    const after = JSON.parse(readFileSync(join(REG, "tl-tr.source.json"), "utf8")).issuers.find(
      (i: { slug: string }) => i.slug === slug,
    );
    expect(after.status).toBe("SUSPENDED");
    expect(after.status_history.length).toBe(before + 1);
    expect(json("tl-tr.json").version).toBe(3);
    const signed = json("tl-tr.json").issuers.find((i: { slug?: string }) => i.slug === slug);
    expect(signed.status).toBe("SUSPENDED");
    expect(verify().report.healthy).toBe(true);
  });

  it("TL10/TL12: çapa günlüğü arşivlenir (imzalı durum kontrol noktası), tam zincir baştan doğrulanır", () => {
    for (let i = 0; i < 4; i++) expect(run(["heartbeat"]).code).toBe(0);
    const a = run(["archive"]);
    expect(a.code, a.err).toBe(0);
    const head = readFileSync(join(DIST, "anchors.jsonl"), "utf8").trim().split("\n");
    expect(head.length).toBeLessThanOrEqual(2); // kontrol noktası (+ varsa sonraki satır)
    expect(readdirSync(join(DIST, "archive")).some((f) => f.startsWith("anchors"))).toBe(true);
    expect(run(["heartbeat"]).code).toBe(0); // arşivden sonra zincir devam eder
    const full = verify(true);
    expect(full.code, full.err).toBe(0);
    expect(full.report.healthy).toBe(true);
  }, 240_000); // alt süreç zinciri: yük altında 20 sn sınırını aşabilir

  it("TL12 sıfırlama: seq 0'dan yeniden başlayan günlüğün arşivi eski arşivi ezmez (ada zaman eki); zincir sağlıklı", () => {
    rmSync(join(DIST, "anchors.jsonl")); // sandbox gece sıfırlaması gibi: günlük gider, arşiv klasörü kalır
    for (let i = 0; i < 2; i++) expect(run(["heartbeat"]).code).toBe(0); // seq 0, 1
    const clash = join(DIST, "archive", "anchors-0000000-0000001.jsonl");
    const old = "eski sıfırlama öncesi arşiv\n";
    writeFileSync(clash, old);
    const a = run(["archive"]);
    expect(a.code, a.err).toBe(0);
    expect(readFileSync(clash, "utf8")).toBe(old); // ezilmedi
    expect(readdirSync(join(DIST, "archive")).some((f) => /^anchors-0000000-0000001-\d+\.jsonl$/.test(f))).toBe(true);
    const full = verify(true);
    expect(full.code, full.err).toBe(0);
    expect(full.report.healthy).toBe(true);
  }, 240_000); // alt süreç zinciri: yük altında 20 sn sınırını aşabilir

  it("ADR-0074 K4: zincir projeksiyonu kapalıyken yeni satır türü yazılmaz; açıkken görünüm ve kayıt sertifikası durum listesi satırları yazılır, kontrol noktası taşır", () => {
    const kinds = () =>
      readFileSync(join(DIST, "anchors.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((l) => JSON.parse(Buffer.from(l.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>);
    const before = kinds().length;
    // LoTE görünümü (ETSI TS 119 602) bu testte açılır; XML görünümü gerçek ağ kayıt defterinde yayın verisi ister
    const lotlSrc = JSON.parse(readFileSync(join(REG, "lotl.source.json"), "utf8"));
    lotlSrc.lote = { ...lotlSrc.lote, enabled: true };
    writeFileSync(join(REG, "lotl.source.json"), JSON.stringify(lotlSrc, null, 2));
    expect(run(["build"]).code).toBe(0);
    expect(run(["heartbeat"]).code).toBe(0);
    expect(kinds().filter((k) => k.kind === "list_view" || k.kind === "registration_status")).toHaveLength(0);
    expect(kinds().length).toBeGreaterThan(before);
    const b = run(["build"], { TAMGA_CHAIN_ENABLED: "1" });
    expect(b.code, b.err).toBe(0);
    const h = run(["heartbeat"], { TAMGA_CHAIN_ENABLED: "1" });
    expect(h.code, h.err).toBe(0);
    const lines = kinds();
    const wp = lines.find((k) => k.kind === "list_view" && k.file === "lote/wallet-providers.jws");
    expect(wp, JSON.stringify(lines.slice(-4))).toBeTruthy();
    expect(wp!.format).toBe("etsi-lote-json");
    expect(wp!.source_file).toBe("lotl");
    expect(wp!.source_version).toBe(json("lotl.json").version);
    expect(wp!.content_hash).toBe(sha256Tag(utf8(readFileSync(join(DIST, "lote", "wallet-providers.jws"), "utf8"))));
    expect(lines.find((k) => k.kind === "list_view" && k.file === "lote/eaa-providers.jws")?.source_file).toBe("tl-tr");
    const rs = lines.filter((k) => k.kind === "registration_status");
    if (existsSync(join(DIST, "wrprc-status.json"))) {
      expect(rs.length).toBeGreaterThan(0);
      expect(Math.max(...rs.map((r) => r.list_version as number))).toBe(rs.length); // liste başına sayaç 1, 2, …
    }
    // arşivleme: kontrol noktası yeni satırların son durumunu taşır; tam zincir sağlıklı
    expect(run(["archive"]).code).toBe(0);
    const cp = kinds()[0] as { kind: string; state: { list_views?: Array<{ file: string }> } };
    expect(cp.kind).toBe("checkpoint");
    expect(cp.state.list_views?.some((v) => v.file === "lote/wallet-providers.jws")).toBe(true);
    const full = verify(true);
    expect(full.code, full.err).toBe(0);
    lotlSrc.lote.enabled = false;
    writeFileSync(join(REG, "lotl.source.json"), JSON.stringify(lotlSrc, null, 2));
  }, 120_000);

  it("kurcalanmış liste: imzalı gövdede tek bayt değişirse doğrulama sağlıksız (çıkış 2 ya da hata)", () => {
    const f = join(DIST, "tl-tr.jws");
    const jws = readFileSync(f, "utf8");
    const [h, p, s] = jws.trim().split(".");
    const body = Buffer.from(p, "base64url").toString("utf8").replace('"SUSPENDED"', '"ACTIVE"');
    writeFileSync(f, [h, Buffer.from(body, "utf8").toString("base64url"), s].join("."));
    const v = verify();
    expect(v.code).not.toBe(0);
    writeFileSync(f, jws);
  });
});

/**
 * 0.8.3 ikinci inceleme — yayın öncesi denetimler ve kayıt komutlarının geri alınması (gerçek süreç, geçici klasör; gerçek kayıt
 * defterinin KOPYASI üzerinde). Her senaryoda imzalı liste yazılmadığı / kaynağın değişmediği dosyadan doğrulanır.
 */
describe.skipIf(!ready)("trust-publisher CLI — yayın öncesi denetimler (0.8.3)", { timeout: 300_000 }, () => {
  const tmp = mkdtempSync(join(tmpdir(), "tamga-tp2-"));
  const REG = join(tmp, "registry");
  const DIST = join(tmp, "dist");
  const SRC = join(REG, "tl-tr.source.json");
  const run = (args: string[], extraEnv: Record<string, string> = {}) => {
    const r = spawnSync(process.execPath, [TSX, CLI, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, TAMGA_TP_REGISTRY: REG, TAMGA_TP_DIST: DIST, ...extraEnv },
      timeout: 60_000,
    });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Rec = Record<string, any>;
  const readSrc = () => JSON.parse(readFileSync(SRC, "utf8")) as Rec;
  const json = (f: string) => JSON.parse(readFileSync(join(DIST, f), "utf8")) as Rec;
  const payload = (f: string) =>
    JSON.parse(
      Buffer.from(readFileSync(join(DIST, f), "utf8").trim().split(".")[1], "base64url").toString("utf8"),
    ) as Rec;
  /** Kaynağı geçici olarak değiştirip `build` çalıştırır, sonra eski hâline döndürür. */
  const buildWith = (file: string, change: (s: Rec) => void) => {
    const path = join(REG, file);
    const raw = readFileSync(path, "utf8");
    const s = JSON.parse(raw) as Rec;
    change(s);
    writeFileSync(path, JSON.stringify(s, null, 2) + "\n");
    try {
      return run(["build"]);
    } finally {
      writeFileSync(path, raw);
    }
  };

  beforeAll(() => {
    cpSync(resolve(ROOT, "apps/trust-publisher/registry"), REG, { recursive: true });
    mkdirSync(DIST);
  });
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("kaynak sorunluysa hiçbir liste imzalanmaz: işletmeci değeri yok (OP2), bilinmeyen / hesaplanan alan (TL11, CI3), yinelenen ad (RO5), işletmeci durumu (TL1)", () => {
    // ADR-0070 OP2: gerçek ağ kayıt defterinde değer dosyası yoksa yayın durur (önce: denetim sessizce atlanıyordu)
    const cfg = join(REG, "provisional-operator.json");
    const cfgRaw = readFileSync(cfg, "utf8");
    rmSync(cfg);
    const op2 = run(["build"]);
    writeFileSync(cfg, cfgRaw);
    expect(op2.code).not.toBe(0);
    expect(op2.err).toMatch(/ADR-0070.*provisional-operator\.json yok/);

    const unknown = buildWith("tl-tr.source.json", (s) => (s.relying_parties[0].internal_note = "x"));
    expect(unknown.code).not.toBe(0);
    expect(unknown.err).toMatch(/TL11.*bilinmeyen alan "internal_note"/);

    // CI3: kaynakta client_id yazılamaz — hesaplanan değeri ezemez
    const cid = buildWith("tl-tr.source.json", (s) => (s.relying_parties[0].client_id = "x509_hash:" + "A".repeat(43)));
    expect(cid.code).not.toBe(0);
    expect(cid.err).toMatch(/bilinmeyen alan "client_id"/);

    // RO5: aynı ad başka yazımla ikinci kayıtta
    const dup = buildWith("tl-tr.source.json", (s) =>
      s.relying_parties.push({ ...s.relying_parties[0], dns_name: "Verify.Tamga.Network." }),
    );
    expect(dup.code).not.toBe(0);
    expect(dup.err).toMatch(/ADR-0075 RO5.*sonda nokta/);
    expect(dup.err).toMatch(/iki kayıtta/);

    const tl1 = buildWith("lotl.source.json", (s) => (s.operator.status = "designated"));
    expect(tl1.code).not.toBe(0);
    expect(tl1.err).toMatch(/TL1.*lotl operator.*provisional/);

    expect(existsSync(join(DIST, "tl-tr.jws"))).toBe(false);
    expect(existsSync(join(DIST, "lotl.jws"))).toBe(false);
  });

  it("sıradaki sürüm ve şema kayıt zamanı imzalı .jws'den okunur: imzasız .json kopya değiştirilse de etkilemez; imzası tutmayan önceki liste yayını durdurur", () => {
    const b1 = run(["build"]);
    expect(b1.code, b1.err).toBe(0);
    const registeredAt = payload("lotl.jws").schemas[0].registered_at as string;
    // imzasız okunabilir kopyalar kurcalanır
    const tlJson = json("tl-tr.json");
    writeFileSync(join(DIST, "tl-tr.json"), JSON.stringify({ ...tlJson, version: 41 }, null, 2));
    const lotlJson = json("lotl.json");
    lotlJson.version = 77;
    lotlJson.schemas[0].registered_at = "2020-01-01T00:00:00.000Z";
    lotlJson.schemas[0].status_history = [{ status: "ACTIVE", since: "2020-01-01T00:00:00.000Z" }];
    writeFileSync(join(DIST, "lotl.json"), JSON.stringify(lotlJson, null, 2));
    const b2 = run(["build"]);
    expect(b2.code, b2.err).toBe(0);
    expect(payload("tl-tr.jws").version).toBe(2); // 42 değil
    expect(payload("lotl.jws").version).toBe(2); // 78 değil
    expect(payload("lotl.jws").schemas[0].registered_at).toBe(registeredAt); // TL9: kalıcı, kopyadan etkilenmez
    expect(payload("lotl.jws").schemas[0].status_history[0].since).toBe(registeredAt);

    // önceki .jws'in imzası tutmuyorsa (gövde değişmiş) sürüm ondan okunmaz: yayın durur, dosyalar değişmez
    const f = join(DIST, "tl-tr.jws");
    const jws = readFileSync(f, "utf8");
    const [h, p, s] = jws.trim().split(".");
    const body = Buffer.from(p, "base64url").toString("utf8").replace('"version":2', '"version":1');
    writeFileSync(f, [h, Buffer.from(body, "utf8").toString("base64url"), s].join("."));
    const bad = run(["build"]);
    expect(bad.code).not.toBe(0);
    expect(bad.err).toMatch(/tl-tr\.jws: önceki yayımlanmış listenin imzası.*doğrulanamadı/);
    writeFileSync(f, jws);
    expect(payload("lotl.jws").version).toBe(2);
  });

  it("TL2: listede kalan kayıttan kullanım ya da durum geçmişi satırı silinirse yayın durur", () => {
    const before = payload("tl-tr.jws").version;
    const scope = buildWith("tl-tr.source.json", (s) => s.relying_parties[0].scopes.pop());
    expect(scope.code).not.toBe(0);
    expect(scope.err).toMatch(/TL2: tl-tr.*kullanım 1.*DURDU/s);
    const hist = buildWith("tl-tr.source.json", (s) => {
      s.issuers[0].status_history = [{ status: "ACTIVE", since: "2026-11-01T00:00:00Z", reason: "rewritten" }];
    });
    expect(hist.code).not.toBe(0);
    expect(hist.err).toMatch(/TL2: tl-tr.*durum geçmişi satırı 1/s);
    expect(payload("tl-tr.jws").version).toBe(before);
  });

  it("kayıt komutu: liste doğrulaması başarısızsa kaynak geri alınır ve günlüğe yazılmaz; --reason süzülür; kayıt kilidi beklenir", () => {
    const raw = readFileSync(SRC, "utf8");
    const version = payload("tl-tr.jws").version;
    const base = readSrc().relying_parties[0] as Rec;
    // Başvuru kayıt denetiminden geçer ama erişim sertifikasının SAN'ı bu alan adını taşımaz → `build` reddeder
    const app = {
      dns_name: "shop.example",
      legal_name: "Example Shop Ltd",
      trade_name: "Example Shop",
      access_cert: "issuer-id",
      uses_intermediaries: [base.dns_name],
      identifiers: [{ scheme: "TR-VKN", value: "TR1234567890" }],
      postal_address: { street_address: "Example St. 1", country: "TR" },
      contact: { support_uri: "https://shop.example/support" },
      service_description: { "en-US": "Example shop" },
      is_public_sector_body: false,
      entitlements: ["service_provider"],
      supervisory_authority: base.supervisory_authority,
      scopes: [
        {
          scope_id: "example-shop-1",
          purpose: "Example purpose",
          vct: base.scopes[0].vct,
          claims: [],
          privacy_policy_uri: "https://shop.example/privacy",
        },
      ],
    };
    const appFile = join(tmp, "rp-app.json");
    writeFileSync(appFile, JSON.stringify(app));
    const r = run(["register", "rp", appFile], { TAMGA_CONFIRM_PROD: "shop.example" });
    expect(r.code).not.toBe(0);
    expect(r.err).toMatch(/alan adı erişim sertifikasının SAN'ında yok/);
    expect(r.err).toMatch(/kayıt geri alındı/);
    expect(readFileSync(SRC, "utf8")).toBe(raw); // önce: reddedilen kayıt kaynakta kalıyordu
    expect(readFileSync(join(DIST, "CHANGELOG.md"), "utf8")).not.toMatch(/shop\.example/); // ve günlükte "registered" görünüyordu
    expect(payload("tl-tr.jws").version).toBe(version);
    // bilinmeyen alan taşıyan başvuru kaynağa hiç yazılmaz (--check de görür)
    writeFileSync(appFile, JSON.stringify({ ...app, account_manager: "x" }));
    const unk = run(["register", "rp", appFile, "--check"]);
    expect(unk.code).toBe(2);
    expect(unk.err).toMatch(/bilinmeyen alan "account_manager"/);

    // TL11: --reason herkese açık listeye ve günlüğe girer — e-posta / ad / numara taşıyan gerekçe reddedilir
    const slug = readSrc().issuers[0].slug as string;
    for (const reason of ["contact ali@example.com", "Requested by Ali Veli", "call 0555 123 45 67"]) {
      const bad = run(["status", slug, "SUSPENDED", "--reason", reason], { TAMGA_CONFIRM_PROD: slug });
      expect(bad.code, reason).toBe(2);
      expect(bad.err, reason).toMatch(/--reason herkese açık listeye/);
    }
    expect(readFileSync(SRC, "utf8")).toBe(raw);

    // kayıt komutu `registry.lock` alır: kilit başka süreçteyken (taze) yazmaz
    mkdirSync(join(DIST, "registry.lock"));
    const locked = run(["status", slug, "SUSPENDED", "--reason", "test"], { TAMGA_CONFIRM_PROD: slug });
    rmSync(join(DIST, "registry.lock"), { recursive: true, force: true });
    expect(locked.code).not.toBe(0);
    expect(locked.err).toMatch(/registry\.lock: kilit alınamadı/);
    expect(readFileSync(SRC, "utf8")).toBe(raw);
    expect(payload("tl-tr.jws").version).toBe(version);
  });
});
