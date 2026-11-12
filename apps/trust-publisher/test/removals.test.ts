/**
 * TL2 — listeden kayıt çıkarma denetimi (src/removals.ts): önceki yayımlanmış sürümdeki kayıt yeni listede yoksa yayın durur;
 * yalnız kayıt defterindeki onaylı, sayıları birebir tutan çıkarma kaydıyla yayımlanır ve CHANGELOG satırı ad taşımaz.
 * Gerçek kayıt defteri: çıkarma kaydı (`registry/removals.json`) biçimi ve kaynakta test kurumu kalmadığı.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { removalChangelogLine, removedRecords } from "../src/removals.js";
import {
  addScope,
  endRpUse,
  setAuthorization,
  setIssuerStatus,
  setRpStatus,
  type RegistryEnv,
} from "../src/registry-ops.js";
import { setWalletProviderStatus } from "../src/wallet-provider-ops.js";

const prev = {
  issuers: [{ issuer_id: "0xa1" }, { issuer_id: "0xa2" }, { issuer_id: "0xa3" }],
  relying_parties: [
    { rp_id: "r1", dns_name: "verify.example", terminal_groups: [{ group_id: "g1" }, { group_id: "g2" }] },
    { rp_id: "r2", dns_name: "old.example" },
  ],
};
const next = {
  issuers: [{ issuer_id: "0xa2" }],
  relying_parties: [{ rp_id: "r1-renewed", dns_name: "Verify.Example" }],
};
const approved = [
  {
    list: "tl-tr",
    date: "2026-11-11",
    issuers: 2,
    relying_parties: 1,
    terminal_groups: 2,
    note: "test records removed",
    previous_version: 7,
  },
];
// çıkarma kaydının yazıldığı geçiş: önceki imzalı sürüm 7
const at = { version: 7, hash: "sha-256:" + "a".repeat(64) };

describe("TL2: listeden kayıt çıkarma", () => {
  it("sayım: çıkan belge veren, doğrulayıcı (alan adıyla; sertifika yenilemesi çıkarma değil) ve kapı grubu", () => {
    expect(removedRecords(prev, next)).toEqual({ issuers: 2, relying_parties: 1, terminal_groups: 2 });
    expect(removedRecords(prev, prev)).toEqual({ issuers: 0, relying_parties: 0, terminal_groups: 0 });
    expect(removedRecords(null, next)).toEqual({ issuers: 0, relying_parties: 0, terminal_groups: 0 }); // ilk yayın
    // yeni kayıt eklemek çıkarma değildir
    expect(removedRecords(next, prev)).toEqual({ issuers: 0, relying_parties: 0, terminal_groups: 0 });
  });

  it("çıkarma yoksa satır yok; onaysız çıkarma yayını durdurur; sayılar birebir tutmalı", () => {
    expect(removalChangelogLine("tl-tr", removedRecords(prev, prev), [], at)).toBeNull();
    const counts = removedRecords(prev, next);
    expect(() => removalChangelogLine("tl-tr", counts, [], at)).toThrow(/TL2.*DURDU/s);
    expect(() => removalChangelogLine("tl-tr", counts, undefined, at)).toThrow(/TL2/);
    expect(() => removalChangelogLine("tl-tr", counts, [{ ...approved[0], issuers: 3 }], at)).toThrow(/TL2/);
    expect(() => removalChangelogLine("tl-tr", counts, [{ ...approved[0], list: "tl-kz" }], at)).toThrow(/TL2/);
    expect(() => removalChangelogLine("tl-tr", counts, [{ ...approved[0], note: "x" }], at)).toThrow(/TL2/);
    // tek kayıt bile onaysız çıkamaz (kaynaktan yanlışlıkla silinen kurum)
    expect(() =>
      removalChangelogLine("tl-tr", { issuers: 1, relying_parties: 0, terminal_groups: 0 }, approved, at),
    ).toThrow(/TL2/);
  });

  it("çıkarma kaydı tek sürüm geçişine bağlıdır: başka geçişte aynı sayılarla yeniden kullanılamaz", () => {
    const counts = removedRecords(prev, next);
    expect(removalChangelogLine("tl-tr", counts, approved, at)).not.toBeNull();
    // yayın yapıldı, sürüm ilerledi: aynı sayıda BAŞKA kayıt silinse de eski onay geçmez
    expect(() => removalChangelogLine("tl-tr", counts, approved, { version: 8, hash: at.hash })).toThrow(
      /TL2.*previous_version: 8.*yeniden kullanılamaz.*DURDU/s,
    );
    expect(() => removalChangelogLine("tl-tr", counts, approved, { version: 6, hash: at.hash })).toThrow(/TL2/);
    expect(() => removalChangelogLine("tl-tr", counts, approved, null)).toThrow(/TL2/);
    // geçişi yazılmamış (eski biçim) ya da sayı olmayan kayıt hiçbir geçişte geçmez
    const { previous_version: _v, ...old } = approved[0];
    expect(() => removalChangelogLine("tl-tr", counts, [old], at)).toThrow(/TL2/);
    expect(() => removalChangelogLine("tl-tr", counts, [{ ...old, previous_version: "7" }], at)).toThrow(/TL2/);
    // özet yazılmışsa o da tutmalı (yayın klasörü sıfırlanıp aynı numaraya yeniden gelinse de geçmez)
    const pinned = [{ ...approved[0], previous_version_hash: at.hash }];
    expect(removalChangelogLine("tl-tr", counts, pinned, at)).not.toBeNull();
    expect(() =>
      removalChangelogLine("tl-tr", counts, pinned, { version: 7, hash: "sha-256:" + "b".repeat(64) }),
    ).toThrow(/TL2/);
    expect(() => removalChangelogLine("tl-tr", counts, pinned, { version: 7, hash: null })).toThrow(/TL2/);
  });

  it("onaylı çıkarma: CHANGELOG satırı sayıları ve gerekçeyi taşır, kimlik ve ad taşımaz", () => {
    const line = removalChangelogLine("tl-tr", removedRecords(prev, next), approved, at)!;
    expect(line).toMatch(/^records removed from tl-tr: 2 issuer\(s\), 1 relying part\(y\/ies\), 2 terminal group\(s\)/);
    expect(line).toContain("test records removed");
    expect(line).toContain("earlier list versions remain in the archive");
    expect(line).not.toMatch(/0xa1|0xa3|old\.example|g1|g2/);
  });

  it("0.8.3: kaydın içi de sayılır — kök CA, şema, kalan kayıtta kullanım, şema yetkisi ve durum geçmişi satırı", () => {
    const h = (status: string, since: string) => ({ status, since });
    const A0 = h("ACTIVE", "2026-01-01T00:00:00Z");
    const before = {
      root_cas: [
        { ca_id: "0xc1", status_history: [A0] },
        { ca_id: "0xc2", status_history: [] },
      ],
      issuers: [
        {
          issuer_id: "0xa1",
          status_history: [A0, h("SUSPENDED", "2026-02-01T00:00:00Z")],
          schema_authorizations: [
            { schema_id: "0xs1", valid_from: "2026-01-01T00:00:00Z" },
            { schema_id: "0xs2", valid_from: "2026-01-01T00:00:00Z" },
          ],
        },
        { issuer_id: "0xa2", status_history: [A0] },
      ],
      relying_parties: [
        { dns_name: "verify.example", scopes: [{ scope_id: "s1" }, { scope_id: "s2" }], status_history: [A0] },
        { dns_name: "old.example", scopes: [{ scope_id: "x1" }], status_history: [A0] },
      ],
      national_schemas: [{ schema_id: "0xn1" }],
    };
    // hiçbir şey çıkmadı; ekleme (yeni geçmiş satırı, yeni kullanım) çıkarma değildir
    const grown = JSON.parse(JSON.stringify(before)) as typeof before;
    grown.issuers[0].status_history.push(h("ACTIVE", "2026-03-01T00:00:00Z"));
    grown.relying_parties[0].scopes.push({ scope_id: "s3" });
    expect(removedRecords(before, grown)).toEqual({ issuers: 0, relying_parties: 0, terminal_groups: 0 });
    // kaydın içinden silme
    const after = {
      root_cas: [{ ca_id: "0xc1", status_history: [] }], // 0xc2 gitti; 0xc1'in geçmiş satırı gitti
      issuers: [
        {
          issuer_id: "0xa1",
          status_history: [A0], // SUSPENDED satırı silindi
          schema_authorizations: [{ schema_id: "0xs1", valid_from: "2026-01-01T00:00:00Z" }], // 0xs2 yetkisi silindi
        },
        { issuer_id: "0xa2", status_history: [A0] },
      ],
      // old.example tümüyle çıktı: kullanımı ve geçmişi ayrıca sayılmaz
      relying_parties: [{ dns_name: "verify.example", scopes: [{ scope_id: "s1" }], status_history: [A0] }],
      national_schemas: [],
    };
    const counts = removedRecords(before, after);
    expect(counts).toEqual({
      issuers: 0,
      relying_parties: 1,
      terminal_groups: 0,
      root_cas: 1,
      schemas: 1,
      scopes: 1,
      schema_authorizations: 1,
      status_history: 2,
    });
    // yalnız kayıt sayılarını taşıyan onay bunu KAPSAMAZ (önce: bu silmeler hiç görülmüyordu)
    const row = { ...approved[0], issuers: 0, relying_parties: 1, terminal_groups: 0 };
    expect(() => removalChangelogLine("tl-tr", counts, [row], at)).toThrow(
      /TL2.*kök CA 1.*şema 1.*kullanım 1.*şema yetkisi 1.*durum geçmişi satırı 2.*DURDU/s,
    );
    // tek bir geçmiş satırı bile onaysız silinemez
    expect(() =>
      removalChangelogLine(
        "tl-tr",
        { issuers: 0, relying_parties: 0, terminal_groups: 0, status_history: 1 },
        approved,
        at,
      ),
    ).toThrow(/TL2/);
    // sayıları birebir tutan onayla yayımlanır; satır sayıları taşır
    const full = { ...row, root_cas: 1, schemas: 1, scopes: 1, schema_authorizations: 1, status_history: 2 };
    expect(removalChangelogLine("tl-tr", counts, [full], at)).toContain(
      "1 root CA(s), 1 schema(s), 1 scope(s), 1 schema authorization(s), 2 status history row(s)",
    );
    // ayrıntı sayısı fazla yazılmış onay da tutmaz
    expect(() =>
      removalChangelogLine("tl-tr", { issuers: 0, relying_parties: 1, terminal_groups: 0 }, [full], at),
    ).toThrow(/TL2/);
    // LOTL: katalogdan kalkan şema
    expect(
      removedRecords({ schemas: [{ schema_id: "0x1" }, { schema_id: "0x2" }] }, { schemas: [{ schema_id: "0x2" }] }),
    ).toEqual({ issuers: 0, relying_parties: 0, terminal_groups: 0, schemas: 1 });
  });

  it("gerçek kayıt defteri: çıkarma kaydı geçerli; kaynakta test kurumu ve kurumuna bağlı kapı grubu kalmadı", () => {
    const reg = resolve(import.meta.dirname, "../registry");
    const removals = JSON.parse(readFileSync(resolve(reg, "removals.json"), "utf8")) as typeof approved;
    for (const r of removals) {
      expect(r.note).toMatch(/^[\x20-\x7e]{8,200}$/);
      expect(Object.keys(r).sort()).toEqual([
        "date",
        "issuers",
        "list",
        "note",
        "previous_version",
        "relying_parties",
        "terminal_groups",
      ]);
      expect(Number.isInteger(r.previous_version)).toBe(true);
    }
    // 2026-11-11 kararı yalnız sürüm 240 → 241 geçişinde geçerliydi (ADR-0081); bugün aynı sayılarla yeniden kullanılamaz
    const used = { issuers: 2, relying_parties: 1, terminal_groups: 2 };
    expect(removalChangelogLine("tl-tr", used, removals, { version: 240, hash: null })).not.toBeNull();
    for (const version of [239, 241, 242, 500])
      expect(() => removalChangelogLine("tl-tr", used, removals, { version, hash: null })).toThrow(/TL2/);
    const src = JSON.parse(readFileSync(resolve(reg, "tl-tr.source.json"), "utf8")) as {
      operator: { status: string; on_behalf_of: string };
      issuers: Array<{ slug: string; status: string }>;
      relying_parties: Array<{ dns_name: string; status: string; terminal_groups?: unknown[] }>;
    };
    // gerçek listede iptal edilmiş test kaydı yok: kalan her kayıt etkin
    expect(src.issuers.map((i) => [i.slug, i.status])).toEqual([["tamga-id", "ACTIVE"]]);
    expect(src.relying_parties.map((r) => [r.dns_name, r.status])).toEqual([["verify.tamga.network", "ACTIVE"]]);
    expect(src.relying_parties.every((r) => !r.terminal_groups?.length)).toBe(true);
    // geçici işletmeci kaydı yerinde (ADR-0070)
    expect(src.operator.status).toBe("provisional");
    expect(src.operator.on_behalf_of.length).toBeGreaterThan(0);
  });

  // ---- 0.8.3 ikinci inceleme: geçmiş satırları içerikleriyle korunur; kayıt komutlarının ürettiği değişiklikler geçer
  const NONE = { issuers: 0, relying_parties: 0, terminal_groups: 0 };
  const T0 = "2026-01-01T00:00:00.000Z";
  const T1 = "2026-02-01T00:00:00.000Z";
  const base = () => ({
    issuers: [
      {
        issuer_id: "0xa1",
        status_history: [
          { status: "ACTIVE", since: T0, reason: "initial-registration" },
          { status: "REVOKED", since: T1, reason: "key compromise", invalidates_from: T0 },
        ],
        schema_authorizations: [
          { schema_id: "0xs1", vct: "urn:x:1", allowed: true, valid_from: T0, valid_until: T1 },
          { schema_id: "0xs2", vct: "urn:x:2", allowed: true, valid_from: T0, valid_until: null as string | null },
        ],
        delegate_keys: [
          { fingerprint_sha256: "f1", purpose: "status_list", status: "ACTIVE" },
          { fingerprint_sha256: "f0", purpose: "status_list", status: "ACTIVE" },
        ] as Array<Record<string, unknown>>,
      },
    ],
    relying_parties: [] as never[],
  });

  it("geçmiş satırı içeriğiyle korunur: invalidates_from ileri çekilemez, gerekçe değiştirilemez; alan sırası fark değildir", () => {
    const softened = base();
    softened.issuers[0].status_history[1].invalidates_from = "2026-09-01T00:00:00.000Z"; // iptal geriye dönük yumuşar
    expect(removedRecords(base(), softened)).toEqual({ ...NONE, status_history: 1 });
    const dropped = base();
    delete (dropped.issuers[0].status_history[1] as { invalidates_from?: string }).invalidates_from;
    expect(removedRecords(base(), dropped)).toEqual({ ...NONE, status_history: 1 });
    const reworded = base();
    reworded.issuers[0].status_history[0].reason = "rewritten";
    expect(removedRecords(base(), reworded)).toEqual({ ...NONE, status_history: 1 });
    // onaysız yayımlanmaz
    expect(() => removalChangelogLine("tl-tr", removedRecords(base(), softened), approved, at)).toThrow(
      /TL2.*durum geçmişi satırı 1.*DURDU/s,
    );
    // aynı içerik, başka alan sırası: fark yok
    const reordered = base();
    reordered.issuers[0].status_history = reordered.issuers[0].status_history.map((r) =>
      Object.fromEntries(Object.entries(r).reverse()),
    ) as never;
    expect(removedRecords(base(), reordered)).toEqual(NONE);
    // yeni satır eklemek (sonradan anlaşılan ele geçirilme: ikinci REVOKED satırı) çıkarma değildir
    const escalated = base();
    escalated.issuers[0].status_history.push({ status: "REVOKED", since: T1, reason: "x", invalidates_from: T0 });
    expect(removedRecords(base(), escalated)).toEqual(NONE);
  });

  it("şema yetkisi: açık dönem kapatılabilir; kapanmış yetki yeniden açılamaz, bitişi değiştirilemez", () => {
    const closed = base();
    closed.issuers[0].schema_authorizations[1].valid_until = T1; // null → tarih: kapatma
    expect(removedRecords(base(), closed)).toEqual(NONE);
    const reopened = base();
    reopened.issuers[0].schema_authorizations[0].valid_until = null; // tarih → null: iptal geriye dönük yumuşar
    expect(removedRecords(base(), reopened)).toEqual({ ...NONE, schema_authorizations: 1 });
    const extended = base();
    extended.issuers[0].schema_authorizations[0].valid_until = "2027-01-01T00:00:00.000Z";
    expect(removedRecords(base(), extended)).toEqual({ ...NONE, schema_authorizations: 1 });
    const backdated = base();
    backdated.issuers[0].schema_authorizations[1].valid_from = "2025-01-01T00:00:00.000Z";
    expect(removedRecords(base(), backdated)).toEqual({ ...NONE, schema_authorizations: 1 });
    const disallowed = base();
    disallowed.issuers[0].schema_authorizations[0].allowed = false;
    expect(removedRecords(base(), disallowed)).toEqual({ ...NONE, schema_authorizations: 1 });
    // aynı türe kapanmış + yeni açık dönem (yetki bitirildi, sonra yeniden verildi): ikisi de kalır, fark yok
    const again = base();
    again.issuers[0].schema_authorizations.push({
      schema_id: "0xs1",
      vct: "urn:x:1",
      allowed: true,
      valid_from: T1,
      valid_until: null,
    });
    expect(removedRecords(base(), again)).toEqual(NONE);
    // …ama kapanmış satır silinip yalnız yenisi bırakılırsa satır eksiktir
    again.issuers[0].schema_authorizations.shift();
    expect(removedRecords(base(), again)).toEqual({ ...NONE, schema_authorizations: 1 });
  });

  it("yetkili anahtar (delegate_keys) ve LOTL kayıtları (ülke listesi, cüzdan sağlayıcı, dış liste) silinirse sayılır", () => {
    const retired = base();
    retired.issuers[0].delegate_keys[1] = { ...retired.issuers[0].delegate_keys[1], status: "RETIRED", valid_to: T1 };
    expect(removedRecords(base(), retired)).toEqual(NONE); // anahtar kapatılır (durum, bitiş), satır kalır
    const gone = base();
    gone.issuers[0].delegate_keys.pop(); // iptal listesi anahtarı yenilenirken eskisi listeden atıldı
    expect(removedRecords(base(), gone)).toEqual({ ...NONE, delegate_keys: 1 });
    expect(() => removalChangelogLine("tl-tr", removedRecords(base(), gone), approved, at)).toThrow(
      /TL2.*yetkili anahtar 1/s,
    );

    const H = [{ status: "ACTIVE", since: T0, reason: "signing-certificate-registered" }];
    const lotl = {
      national_lists: [{ state_code: "TR" }, { state_code: "AZ" }],
      wallet_providers: [
        { provider_id: "WP-1", status_history: H },
        { provider_id: "WP-2", status_history: H },
      ],
      external_lists: [{ list_id: "ext-1" }, { list_id: "ext-2" }],
    };
    expect(removedRecords(lotl, lotl)).toEqual(NONE);
    const counts = removedRecords(lotl, {
      national_lists: [{ state_code: "TR" }],
      wallet_providers: [{ provider_id: "WP-1", status_history: [] }], // WP-2 gitti; WP-1'in geçmiş satırı gitti
      external_lists: [],
    });
    expect(counts).toEqual({ ...NONE, status_history: 1, national_lists: 1, wallet_providers: 1, external_lists: 2 });
    expect(() => removalChangelogLine("lotl", counts, [{ ...approved[0], list: "lotl" }], at)).toThrow(
      /TL2: lotl.*durum geçmişi satırı 1.*ülke listesi kaydı 1.*cüzdan sağlayıcı 1.*dış liste 2.*DURDU/s,
    );
    const ok = { ...approved[0], list: "lotl", ...NONE, ...counts };
    expect(removalChangelogLine("lotl", counts, [ok], at)).toContain(
      "1 status history row(s), 1 national list entr(y/ies), 1 wallet provider(s), 2 external list(s)",
    );
  });

  // Kaynak kaydı listeye girerken yalnız kimlik alanları hesaplanır; geçmiş satırları olduğu gibi taşınır. Karşılaştırma için
  // kaynak → liste biçimi: belge verenin kimliği yerine kısa adı, şema kimliği yerine tür adı (ikisi de kalıcı ve tekil).
  type Src = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const asList = (src: Src) => ({
    root_cas: (src.root_cas as Src[]).map((c) => ({ ...c, ca_id: c.cert })),
    issuers: (src.issuers as Src[]).map((i) => ({ ...i, issuer_id: i.slug })),
    relying_parties: src.relying_parties,
    national_schemas: src.national_schemas,
  });
  const read = (dir: string, f: string) =>
    JSON.parse(readFileSync(resolve(import.meta.dirname, "..", dir, f), "utf8")) as Src;

  it.each(["registry", "registry-sandbox"])(
    "%s: kayıt defteri yeni denetimden geçer ve kayıt komutlarının ürettiği her değişiklik çıkarma sayılmaz",
    (dir) => {
      const src = read(dir, "tl-tr.source.json");
      const lotl = read(dir, "lotl.source.json");
      // kendisiyle: fark yok (yeniden yayın)
      expect(removedRecords(asList(src), asList(src))).toEqual(NONE);
      expect(removedRecords(lotl, lotl)).toEqual(NONE);

      const env: RegistryEnv = {
        now: new Date("2026-11-12T10:00:00.000Z"),
        certExists: () => true,
        knownVcts: new Set<string>([
          "urn:tamga:test:New:1",
          ...(src.issuers as Src[]).flatMap((i) => (i.schema_authorizations as Src[]).map((a) => a.vct as string)),
          ...(src.relying_parties as Src[]).flatMap((r) => (r.scopes as Src[]).map((s) => s.vct as string)),
        ]),
      };
      const later = { ...env, now: new Date("2026-11-13T10:00:00.000Z") };
      const issuer = (src.issuers as Src[]).find((i) => i.status === "ACTIVE")!;
      const slug = issuer.slug as string;
      const openVct = (issuer.schema_authorizations as Src[]).find((a) => a.allowed && !a.valid_until)!.vct as string;
      const rp = (src.relying_parties as Src[]).find((r) => r.status === "ACTIVE")!;
      const dns = rp.dns_name as string;
      const openScope = (rp.scopes as Src[]).find((s) => Date.parse(s.valid_until) > later.now.getTime())!;
      const steps: Array<[string, (s: Src) => Src]> = [
        ["authorize", (s) => setAuthorization(s, slug, "urn:tamga:test:New:1", true, env)],
        ["authorize --revoke", (s) => setAuthorization(s, slug, openVct, false, env)],
        ["authorize (yeniden)", (s) => setAuthorization(s, slug, openVct, true, later)],
        ["status SUSPENDED", (s) => setIssuerStatus(s, slug, "SUSPENDED", { reason: "review" }, env)],
        ["status ACTIVE", (s) => setIssuerStatus(s, slug, "ACTIVE", { reason: "review closed" }, later)],
        ["status RETIRED", (s) => setIssuerStatus(s, slug, "RETIRED", { reason: "ceased" }, later)],
        ["status REVOKED", (s) => setIssuerStatus(s, slug, "REVOKED", { reason: "ceased" }, later)],
        [
          "status REVOKED --invalidates-from",
          (s) => setIssuerStatus(s, slug, "REVOKED", { reason: "key compromise", invalidatesFrom: T0 }, later),
        ],
        [
          "scope",
          (s) =>
            addScope(
              s,
              dns,
              { scope_id: "new-use-1", purpose: "p", vct: openScope.vct, claims: [], privacy_policy_uri: "https://x" },
              env,
            ),
        ],
        ["end-use", (s) => endRpUse(s, dns, openScope.scope_id as string, env)],
        ["rp-status SUSPENDED", (s) => setRpStatus(s, dns, "SUSPENDED", { reason: "review" }, env)],
        ["rp-status ACTIVE", (s) => setRpStatus(s, dns, "ACTIVE", { reason: "review closed" }, later)],
        ["rp-status REVOKED", (s) => setRpStatus(s, dns, "REVOKED", { reason: "ceased" }, later)],
      ];
      let cur = src;
      for (const [name, step] of steps) {
        const nextSrc = step(cur);
        expect(removedRecords(asList(cur), asList(nextSrc)), name).toEqual(NONE);
        expect(removalChangelogLine("tl-tr", removedRecords(asList(cur), asList(nextSrc)), [], at), name).toBeNull();
        cur = nextSrc;
      }
      // baştaki sürümle sondaki arasında da fark yok (ara yayınlar atlansa da)
      expect(removedRecords(asList(src), asList(cur))).toEqual(NONE);
      // komutların kapattığı yetki elle yeniden açılırsa yakalanır
      const reopened = JSON.parse(JSON.stringify(cur)) as Src;
      for (const a of (reopened.issuers as Src[]).find((i) => i.slug === slug)!.schema_authorizations as Src[])
        a.valid_until = null;
      expect(removedRecords(asList(cur), asList(reopened)).schema_authorizations).toBeGreaterThan(0);

      // cüzdan sağlayıcı durum komutu: satır eklenir, kayıt kalır
      const wp = (lotl.wallet_providers as Src[]).find((w) => w.status === "ACTIVE");
      if (wp) {
        const suspended = setWalletProviderStatus(lotl, wp.provider_id as string, "SUSPENDED", {
          reason: "review",
          now: env.now,
        });
        expect(suspended.changed).toBe(true);
        expect(removedRecords(lotl, suspended.next)).toEqual(NONE);
      }
    },
  );
});
