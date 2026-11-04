/**
 * Eşdeğerlik testi fikstürü (ADR-0009 K7; ADR-0073 K6): birkaç sürümlük imzalı liste ARŞİVİ ve çapa günlüğü. Bütün kayıtlar tek
 * bir zaman çizelgesinden üretilir; her liste sürümü o andaki görüntüdür (yayıncının yaptığı gibi: geçmiş yalnız eklenir).
 * İçerik: askı ve askıdan dönüş, yumuşak iptal (RETIRED), sert iptal (`invalidates_from`), kök emekliliği ve halef (ROLLING_OVER),
 * şema sürüm özetleri, kullanımdan kalkan ve iptal edilen şema, ulusal şema, yetki pencereleri, tanıma, cüzdan sağlayıcı ve
 * anahtarları, tanımanın açılıp kapanması, doğrulayıcı kapsamları (kapanan kapsam), sertifika yenileme, kapı grupları, askı, iptal sonrası yeniden kayıt ve
 * iki ülke arasında DEVİR (ADR-0075). Tarihler `base`'e göredir (geçmişte: zincire yazılabilsin — DateInFuture).
 * Kişisel veri yok; adlar uydurmadır.
 */
import { createHash, webcrypto } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { X509CertificateGenerator, cryptoProvider } from "@peculiar/x509";
import { CompactSign, importPKCS8 } from "jose";
import {
  TL_TYP,
  certFingerprintSha256Hex,
  computeIdFromFingerprintHex,
  computeSchemaId,
  sha256Tag,
  utf8,
} from "@tamga-network/trust";

import type { ArchiveSet } from "../src/replay-plan.js";

cryptoProvider.set(webcrypto as unknown as Crypto);
const DAY = 86400;
const iso = (s: number) => new Date(s * 1000).toISOString();
const fp = (label: string) => createHash("sha256").update(label).digest("hex");
const sri = (label: string) => `sha256-${createHash("sha256").update(label).digest("base64")}`;

export interface Fixture {
  archive: ArchiveSet;
  base: number;
  planTime: number;
  /** liste kaynağının "şimdi"si (son yayından biraz sonra) */
  now: Date;
  dnsNames: string[];
  /** fikstürde bilerek bulunan bilinen farkın kaydı (ADR-0075 devir) */
  devirDns: string;
}

type H = Array<{ status: string; since: number; reason?: string; invalidates_from?: number }>;
const histAt = (h: H, T: number) =>
  h
    .filter((x) => x.since <= T)
    .map((x) => ({
      status: x.status,
      since: iso(x.since),
      ...(x.reason ? { reason: x.reason } : {}),
      ...(x.invalidates_from ? { invalidates_from: iso(x.invalidates_from) } : {}),
    }));
const lastStatus = (h: H, T: number) => histAt(h, T).at(-1)?.status ?? "ACTIVE";

export async function buildFixture(nowSec = Math.floor(Date.now() / 1000)): Promise<Fixture> {
  const B = nowSec - 200 * DAY;
  const d = (n: number) => B + n * DAY;
  // --- imzacı (LOTL, ülke listeleri ve çapa günlüğü için aynı anahtar; parmak izi kök olarak sabitlenir)
  const alg = { name: "ECDSA", namedCurve: "P-256", hash: "SHA-256" } as const;
  const keys = (await webcrypto.subtle.generateKey(alg, true, ["sign", "verify"])) as CryptoKeyPair;
  const cert = await X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=Replay fixture signer",
    notBefore: new Date((B - DAY) * 1000),
    notAfter: new Date((nowSec + 365 * DAY) * 1000),
    signingAlgorithm: alg,
    keys,
  });
  const der = new Uint8Array(cert.rawData);
  const pkcs8 = Buffer.from(await webcrypto.subtle.exportKey("pkcs8", keys.privateKey)).toString("base64");
  const key = await importPKCS8(`-----BEGIN PRIVATE KEY-----\n${pkcs8}\n-----END PRIVATE KEY-----`, "ES256");
  const x5c = [Buffer.from(der).toString("base64")];
  const signerFp = certFingerprintSha256Hex(der);
  const sign = (o: unknown) =>
    new CompactSign(utf8(JSON.stringify(o))).setProtectedHeader({ alg: "ES256", typ: TL_TYP, x5c }).sign(key);

  // --- şemalar
  const NET = {
    diploma: "urn:tamga:edu:DiplomaCredential:1",
    student: "urn:tamga:edu:StudentCredential:1",
    transcript: "urn:tamga:edu:TranscriptCredential:1",
  };
  const NAT_TR = "urn:tamga:tr:edu:LocalCertificate:1";
  const schemaDefs = [
    {
      vct: NET.diploma,
      hashes: [
        [d(0), sri("diploma-1.0")],
        [d(45), sri("diploma-1.1")],
      ],
      h: [{ status: "ACTIVE", since: d(0) }],
    },
    {
      vct: NET.student,
      hashes: [[d(0), sri("student-1.0")]],
      h: [
        { status: "ACTIVE", since: d(0) },
        { status: "DEPRECATED", since: d(50) },
      ],
    },
    {
      vct: NET.transcript,
      hashes: [[d(0), sri("transcript-1.0")]],
      h: [
        { status: "ACTIVE", since: d(0) },
        { status: "REVOKED", since: d(78), reason: "content error" },
      ],
    },
  ] as Array<{ vct: string; hashes: Array<[number, string]>; h: H }>;
  const schemaAt = (s: (typeof schemaDefs)[number], T: number, layer: "NETWORK" | "NATIONAL") => {
    const hs = s.hashes.filter(([t]) => t <= T).map(([, x]) => x);
    return {
      schema_id: computeSchemaId(s.vct),
      vct: s.vct,
      metadata_url: `https://schemas.example/v1/${encodeURIComponent(s.vct)}/metadata.json`,
      content_hash: hs.at(-1)!,
      content_hashes: hs,
      layer,
      status: lastStatus(s.h, T),
      registered_at: iso(s.h[0].since),
      status_history: histAt(s.h, T),
    };
  };
  const natSchema = {
    vct: NAT_TR,
    hashes: [[d(10), sri("local-1.0")]],
    h: [{ status: "ACTIVE", since: d(10) }],
  } as (typeof schemaDefs)[number];

  // --- kök sertifikalar ve kurumlar (TR, KZ)
  const ca = (cc: string, label: string, h: H, successor: string | null = null) => ({
    cc,
    fp: fp(label),
    id: computeIdFromFingerprintHex(cc, fp(label)),
    label,
    h,
    successor,
  });
  const R1 = ca("TR", "tr-root-1", [{ status: "ACTIVE", since: d(-5) }]);
  const R2 = ca("TR", "tr-root-2", [
    { status: "ACTIVE", since: d(-5) },
    { status: "ROLLING_OVER", since: d(93) },
    { status: "RETIRED", since: d(95) },
  ]);
  R2.successor = R1.id;
  const RK = ca("KZ", "kz-root-1", [{ status: "ACTIVE", since: d(-5) }]);
  const roots = [R1, R2, RK];
  const rootAt = (r: (typeof roots)[number], T: number) => ({
    ca_id: r.id,
    legal_name: `Root ${r.label}`,
    cert_fingerprint_sha256: r.fp,
    service_type: "http://uri.etsi.org/TrstSvc/Svctype/CA/PKC",
    operator: { name: "Tamga", status: "provisional", on_behalf_of: `${r.cc} authority` },
    status: lastStatus(r.h, T),
    valid_from: iso(d(-10)),
    valid_until: iso(nowSec + 3650 * DAY),
    successor_ca_id: r.successor && T >= d(93) ? r.successor : null,
    status_history: histAt(r.h, T),
  });

  type Auth = { vct: string; from: number; until?: number };
  const issuer = (cc: string, slug: string, root: typeof R1, h: H, auth: Auth[]) => ({
    cc,
    slug,
    fp: fp(`issuer-${slug}`),
    id: computeIdFromFingerprintHex(cc, fp(`issuer-${slug}`)),
    root,
    h,
    auth,
  });
  const U1 = issuer(
    "TR",
    "uni-one",
    R1,
    [
      { status: "ACTIVE", since: d(1) },
      { status: "SUSPENDED", since: d(60), reason: "audit" },
      { status: "ACTIVE", since: d(70) },
    ],
    [
      { vct: NET.diploma, from: d(2) },
      { vct: NET.student, from: d(2), until: d(55) },
      { vct: NET.student, from: d(58) },
      { vct: NAT_TR, from: d(12) },
    ],
  );
  const U2 = issuer(
    "TR",
    "uni-two",
    R1,
    [
      { status: "ACTIVE", since: d(1) },
      { status: "REVOKED", since: d(80), reason: "key compromise", invalidates_from: d(50) },
    ],
    [{ vct: NET.diploma, from: d(2) }],
  );
  const U3 = issuer(
    "TR",
    "college-three",
    R2,
    [
      { status: "ACTIVE", since: d(3) },
      { status: "RETIRED", since: d(90), reason: "merged" },
    ],
    [{ vct: NET.diploma, from: d(4) }],
  );
  const U4 = issuer(
    "TR",
    "academy-four",
    R1,
    [{ status: "ACTIVE", since: d(20) }],
    [{ vct: NET.transcript, from: d(21) }],
  );
  const K1 = issuer("KZ", "kz-uni", RK, [{ status: "ACTIVE", since: d(5) }], [{ vct: NET.diploma, from: d(6) }]);
  const allIssuers = [U1, U2, U3, U4, K1];
  const issuerAt = (i: (typeof allIssuers)[number], T: number) => ({
    issuer_id: i.id,
    slug: i.slug,
    legal_name: `Example ${i.slug}`,
    category: "EDUCATION",
    assurance: "I2",
    class: "EAA",
    parent_ca_id: i.root.id,
    cert_fingerprint_sha256: i.fp,
    issuer_url: `https://issuer.example/${i.slug}`,
    status_list_base: `https://status.example/${i.slug}/`,
    status: lastStatus(i.h, T),
    valid_from: iso(d(-10)),
    valid_until: iso(nowSec + 200 * DAY),
    successor_id: null,
    status_history: histAt(i.h, T),
    schema_authorizations: i.auth
      .filter((a) => a.from <= T)
      .map((a) => ({
        schema_id: computeSchemaId(a.vct),
        allowed: true,
        valid_from: iso(a.from),
        valid_until: a.until !== undefined && a.until <= T ? iso(a.until) : null,
      })),
    is_public_sector_body: i.slug === "uni-one",
    entitlements: ["non_q_eaa_provider"],
  });

  // --- doğrulayıcılar
  type Scope = { id: string; vct: string; claims: string[]; from: number; until?: number };
  type Group = { id: string; inst: string; from: number; until?: number; policies: string[] };
  const rp = (
    cc: string,
    dns: string,
    since: number,
    h: H,
    scopes: Scope[],
    groups: Group[] = [],
    certs: Array<[number, string]> = [[since, fp(`access-${dns}-${cc}`)]],
  ) => ({ cc, dns, since, h, scopes, groups, certs });
  const RP1 = rp(
    "TR",
    "verify.example.tr",
    d(8),
    [{ status: "ACTIVE", since: d(8) }],
    [
      { id: "age-check", vct: NET.diploma, claims: ["degree", "graduation_date"], from: d(9), until: d(85) },
      { id: "diploma-check", vct: NET.diploma, claims: ["degree", "family_name", "given_name"], from: d(84) },
    ],
    [
      { id: "gate-a", inst: "uni-one", from: d(9), until: d(88), policies: ["campus-entry"] },
      { id: "gate-b", inst: "uni-one", from: d(87), policies: ["campus-entry", "library"] },
    ],
    [
      [d(8), fp("access-verify-1")],
      [d(80), fp("access-verify-2")],
    ],
  );
  const RP2 = rp(
    "TR",
    "shop.example.tr",
    d(15),
    [
      { status: "ACTIVE", since: d(15) },
      { status: "SUSPENDED", since: d(65) },
      { status: "ACTIVE", since: d(74) },
    ],
    [{ id: "student-discount", vct: NET.student, claims: ["student_status"], from: d(16) }],
  );
  const RP3_TR = rp(
    "TR",
    "moved.example",
    d(12),
    [{ status: "ACTIVE", since: d(12) }],
    [{ id: "login", vct: NET.diploma, claims: ["degree"], from: d(12) }],
  );
  // DEVİR (ADR-0075 RO1): aynı alan adı d(55)'te KZ listesinde — TR listesi kaydı kapatmaz (bilinen fark)
  const RP3_KZ = rp(
    "KZ",
    "moved.example",
    d(55),
    [{ status: "ACTIVE", since: d(55) }],
    [{ id: "login", vct: NET.diploma, claims: ["degree", "given_name"], from: d(55) }],
  );
  // İptal sonrası yeniden kayıt (RO2/RO5): aynı kayıtta yeni dönem
  const RP4 = rp(
    "TR",
    "gone.example.tr",
    d(18),
    [
      { status: "ACTIVE", since: d(18) },
      { status: "REVOKED", since: d(40), reason: "registration ended" },
      { status: "ACTIVE", since: d(66), reason: "approval: re-registration record 1" },
    ],
    [{ id: "verify", vct: NET.diploma, claims: ["degree"], from: d(67) }],
  );
  const rpAt = (r: ReturnType<typeof rp>, T: number) => {
    const fpNow = r.certs.filter(([t]) => t <= T).at(-1)![1];
    return {
      rp_id: "0x" + createHash("sha256").update(r.dns).digest("hex"),
      client_id: `x509_hash:${Buffer.from(fpNow, "hex").toString("base64url")}`,
      dns_name: r.dns,
      legal_name: `Example ${r.dns}`,
      access_cert_fingerprint_sha256: fpNow,
      status: lastStatus(r.h, T),
      registered_at: iso(r.since),
      status_history: histAt(r.h, T),
      scopes: r.scopes
        .filter((s) => s.from <= T)
        .map((s) => ({
          scope_id: s.id,
          purpose: `Purpose of ${s.id}`,
          vct: s.vct,
          claims: s.claims,
          valid_from: iso(s.from),
          valid_until: s.until !== undefined && s.until <= T ? iso(s.until) : null,
        })),
      terminal_groups: r.groups
        .filter((g) => g.from <= T)
        .map((g) => ({
          group_id: g.id,
          institution_id: g.inst,
          allowed_policies: g.policies,
          valid_from: iso(g.from),
          valid_until: g.until !== undefined && g.until <= T ? iso(g.until) : null,
        })),
      pseudonyms: "single",
    };
  };
  const rpsOf = (cc: string, T: number) =>
    [RP1, RP2, RP3_TR, RP3_KZ, RP4].filter((r) => r.cc === cc && r.since <= T).map((r) => rpAt(r, T));

  // --- cüzdan sağlayıcı
  const WK1 = fp("wua-key-1");
  const WK2 = fp("wua-key-2");
  const wpAt = (T: number) => [
    {
      provider_id: "WP-EXAMPLE-1",
      legal_name: "Example Wallet Provider",
      status: "ACTIVE",
      wua_signing_keys: [
        { fingerprint_sha256: WK1, status: T >= d(70) ? "REVOKED" : "ACTIVE", valid_from: iso(d(0)) },
        ...(T >= d(60) ? [{ fingerprint_sha256: WK2, status: "ACTIVE", valid_from: iso(d(60)) }] : []),
      ],
    },
  ];

  // --- listeler (sürüm sürüm)
  const lotlTimes = [d(0), d(40), d(75), d(100)];
  const trTimes = [d(0), d(35), d(62), d(72), d(82), d(92), d(100)];
  const kzTimes = [d(0), d(56), d(100)];
  const signingKeys = [{ fingerprint_sha256: signerFp, status: "ACTIVE" }];
  const lotl: string[] = [];
  for (const [k, T] of lotlTimes.entries()) {
    const body = {
      list_format_version: "1.0",
      list_type: "lotl",
      version: k + 1,
      issued_at: iso(T),
      next_update: iso(T + 400 * DAY),
      previous_version_hash: k ? sha256Tag(utf8(lotl[k - 1])) : null,
      operator: { name: "Tamga", status: "provisional", on_behalf_of: "Tamga Trust Framework consortium" },
      anchor_signing_keys: signingKeys,
      national_lists: [
        {
          state_code: "TR",
          status: "ACTIVE",
          list_url: "https://trust.example/tl-tr.jws",
          signing_keys: signingKeys,
          recognition: { mode: "unilateral", recognizes: T >= d(40) && T < d(75) ? ["TR", "KZ"] : ["TR"] },
        },
        {
          state_code: "KZ",
          status: "ACTIVE",
          list_url: "https://trust.example/tl-kz.jws",
          signing_keys: signingKeys,
          recognition: { mode: "unilateral", recognizes: ["KZ", "TR"] },
        },
        { state_code: "AZ", status: "RESERVED" },
      ],
      schemas: schemaDefs.filter((s) => s.h[0].since <= T).map((s) => schemaAt(s, T, "NETWORK")),
      wallet_providers: wpAt(T),
      pid_providers: [],
    };
    lotl.push(await sign(body));
  }
  const tl = async (cc: string, times: number[]) => {
    const out: string[] = [];
    for (const [k, T] of times.entries()) {
      const body = {
        list_format_version: "1.0",
        list_type: "trusted_list",
        state_code: cc,
        version: k + 1,
        issued_at: iso(T),
        next_update: iso(T + 400 * DAY),
        previous_version_hash: k ? sha256Tag(utf8(out[k - 1])) : null,
        operator: { name: "Tamga", status: "provisional", on_behalf_of: `${cc} national authority` },
        root_cas: roots.filter((r) => r.cc === cc && r.h[0].since <= T).map((r) => rootAt(r, T)),
        issuers: allIssuers.filter((i) => i.cc === cc && i.h[0].since <= T).map((i) => issuerAt(i, T)),
        relying_parties: rpsOf(cc, T),
        national_schemas: cc === "TR" && natSchema.h[0].since <= T ? [schemaAt(natSchema, T, "NATIONAL")] : [],
      };
      out.push(await sign(body));
    }
    return out;
  };
  const national = { "tl-tr": await tl("TR", trTimes), "tl-kz": await tl("KZ", kzTimes) };

  // --- çapa günlüğü: iptal listesi yayınları (kurum ACTIVE iken) + saatlik satırlar
  const status = (i: typeof U1, n: string, v: number, t: number) => ({
    kind: "status_list",
    list_id: "0x" + n.padStart(64, "0"),
    issuer_id: i.id,
    list_uri: `https://status.example/${i.slug}/${n}`,
    content_hash: sha256Tag(utf8(`${i.slug}-${n}-v${v}`)),
    list_version: v,
    published_at: iso(t),
  });
  const bodies = [
    { at: d(3), b: status(U1, "a1f0", 1, d(3)) },
    { at: d(4), b: status(U2, "b2e0", 1, d(4)) },
    { at: d(30), b: status(U1, "a1f0", 2, d(30)) },
    { at: d(31), b: status(K1, "c3d0", 1, d(31)) },
    { at: d(45), b: status(U2, "b2e0", 2, d(45)) },
    { at: d(76), b: status(U1, "a1f0", 3, d(76)) },
    { at: d(99), b: { kind: "heartbeat" } },
    { at: d(100) - 60, b: { kind: "heartbeat" } },
  ];
  const lines: string[] = [];
  for (const [seq, x] of bodies.entries())
    lines.push(await sign({ seq, previous_hash: seq ? sha256Tag(utf8(lines[seq - 1])) : null, ts: iso(x.at), ...x.b }));

  const planTime = d(100);
  return {
    archive: {
      environment: "production",
      rootFingerprints: [signerFp],
      lotl,
      national,
      anchorsJsonl: lines.join("\n") + "\n",
    },
    base: B,
    planTime,
    now: new Date((planTime + 60) * 1000),
    dnsNames: [RP1, RP2, RP3_TR, RP4].map((r) => r.dns),
    devirDns: "moved.example",
  };
}

/** Arşivi yayıncının çıktı klasörü biçiminde yazar (`archive/`, `anchors.jsonl`, `keys/root-fingerprints.json`). */
export function writeFixtureDist(f: Fixture, dist: string) {
  mkdirSync(resolve(dist, "archive"), { recursive: true });
  mkdirSync(resolve(dist, "keys"), { recursive: true });
  const pad = (n: number) => String(n).padStart(4, "0");
  f.archive.lotl.forEach((j, k) => writeFileSync(resolve(dist, "archive", `lotl.v${pad(k + 1)}.jws`), j));
  for (const [file, list] of Object.entries(f.archive.national))
    list.forEach((j, k) => writeFileSync(resolve(dist, "archive", `${file}.v${pad(k + 1)}.jws`), j));
  writeFileSync(resolve(dist, "lotl.jws"), f.archive.lotl.at(-1)!);
  for (const [file, list] of Object.entries(f.archive.national))
    writeFileSync(resolve(dist, `${file}.jws`), list.at(-1)!);
  writeFileSync(resolve(dist, "anchors.jsonl"), f.archive.anchorsJsonl);
  writeFileSync(
    resolve(dist, "keys", "root-fingerprints.json"),
    JSON.stringify({ lotl_signing_keys: f.archive.rootFingerprints.map((x) => ({ fingerprint_sha256: x })) }, null, 2),
  );
}
