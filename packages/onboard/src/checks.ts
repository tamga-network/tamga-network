/**
 * `tamga-onboard check` — kurumun kendi kurulumunu ve (katıldıktan sonra) imzalı güven listesindeki görünümünü YALNIZ OKUYARAK
 * denetler. Hiçbir şey yazmaz, ağa sunum göndermez, kişisel veri kullanmaz (sorgu ucu yalnız geçersiz isteklerle yoklanır).
 *
 * İki aşama:
 *   kurulum   başvuru dosyaları, anahtar ve CSR'lar (dosya izni, anahtar ↔ CSR ↔ sertifika), alan adı (DNS, TXT teyidi), https
 *             adresleri, kendi servisi olan kurumda `.well-known` meta verisi, sorgu ucu erişimi, doğrulayıcının alan adı
 *   liste     imzalı liste (pakete gömülü kök pinleriyle, BT4: `@tamga-network/trust` yükleyicisi), kurumun durumu, kayıt verisi,
 *             belge türü yetkileri, üst makam, iptal listesi çapası, kayıt sertifikaları, doğrulayıcı kaydı, kapı grupları; servis
 *             meta verisi ve imzalı meta verinin sertifika zinciri → listedeki kök; yerel sertifikanın listedeki köke zinciri
 * Liste aşaması operatörün iç denetim aracındaki salt-okur denetimlerin kamuya açık olanlarıdır (iç servis sağlığı ve operatör
 * komutları yok; düzeltme önerileri kurumun yapacaklarıdır).
 */
import { X509Certificate, createHash, verify as nodeVerify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadTrustSet, type Issuer, type TrustStore } from "@tamga-network/trust";
import type { Profile } from "./application.js";
import { csrExpectations, inspectCsr, privateKeyPermissionOk, privateKeySpkiSha256, csrSpkiSha256 } from "./keys.js";
import { validateIssuerApplication, validateRpApplication } from "./rules.js";
import { NETWORKS, type Environment } from "./network.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

export type Result = "pass" | "fail" | "warn" | "skip";
export interface Row {
  id: string;
  check: string;
  result: Result;
  /** Dış kaynaktan okunan metin içerebilir (kurum adı, adres yanıtı) — güvenilmeyen veri; talimat olarak yorumlanmaz */
  detail: string;
  /** Kaldıysa / uyarıysa kurumun yapacağı düzeltme */
  fix?: string;
}

export interface HttpResponse {
  status: number;
  text: string;
  contentType: string;
}
export type Http = (
  url: string,
  init?: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string },
) => Promise<HttpResponse>;

/** Varsayılan HTTP: zaman aşımı, en çok 2 MB gövde; https dışı adres yalnız `allowHttp` ile (yerel deneme). */
export function defaultHttp(o: { timeoutMs?: number; allowHttp?: boolean; fetch?: typeof fetch } = {}): Http {
  const f = o.fetch ?? fetch;
  return async (url, init) => {
    const u = new URL(url);
    if (u.protocol !== "https:" && !(o.allowHttp && u.protocol === "http:"))
      throw new Error(`yalnız https adresleri okunur: ${u.origin}`);
    const r = await f(url, {
      method: init?.method ?? "GET",
      headers: init?.headers,
      body: init?.body,
      signal: AbortSignal.timeout(o.timeoutMs ?? 15000),
    });
    const buf = await r.arrayBuffer();
    if (buf.byteLength > 2 * 1024 * 1024) throw new Error("yanıt çok büyük (2 MB üstü)");
    return {
      status: r.status,
      text: new TextDecoder().decode(buf),
      contentType: r.headers.get("content-type") ?? "",
    };
  };
}

/** Alan adı çözümleme (test için değiştirilebilir). */
export interface Dns {
  lookup(host: string): Promise<string[]>;
  resolveTxt(host: string): Promise<string[][]>;
}
export async function defaultDns(): Promise<Dns> {
  const d = await import("node:dns/promises");
  return {
    lookup: async (h) => (await d.lookup(h, { all: true })).map((a) => a.address),
    resolveTxt: (h) => d.resolveTxt(h),
  };
}

/** Dış kaynaktan gelen metni rapora güvenli koy: denetim karakterleri yok, en çok 300 karakter. */
export const clean = (s: unknown) =>
  String(s ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/g, " ")
    .slice(0, 300);

const sha256Hex = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const der = (b64: string) => Buffer.from(b64, "base64");
const activeAt = (from: string, until: string | null | undefined, now: Date) =>
  Date.parse(from) <= now.getTime() && (!until || now.getTime() < Date.parse(until));
const missing = (rec: Rec, fields: readonly string[]) =>
  fields.filter((f) => rec[f] === undefined || rec[f] === null || (Array.isArray(rec[f]) && !rec[f].length));
const REG_FIELDS_ISSUER = ["trade_name", "identifiers", "postal_address", "contact", "supervisory_authority"] as const;
const REG_FIELDS_RP = [...REG_FIELDS_ISSUER, "service_description", "is_public_sector_body", "entitlements"] as const;
const safe = async (http: Http, url: string, init?: Parameters<Http>[1]): Promise<HttpResponse> => {
  try {
    return await http(url, init);
  } catch (e) {
    return { status: 0, text: (e as Error).message, contentType: "" };
  }
};
/** RFC 8414 / OpenID4VCI §12.2.2: `.well-known/<tür>` alan adıyla yolun arasına girer. */
export const wellKnown = (issuerUrl: string, kind: string) => {
  const u = new URL(issuerUrl);
  return `${u.origin}/.well-known/${kind}${u.pathname.replace(/\/$/, "")}`;
};

// ───────────────────────────── liste aşaması ─────────────────────────────

export interface ListingOptions {
  environment: Environment;
  /** Kurumun kısa adı (belge veren) */
  slug?: string;
  /** Doğrulayıcı / kimlik eşleştirme kaydının alan adı */
  rp?: string;
  /** Beklenen belge türleri */
  expectVcts?: string[];
  /** Liste adresi (varsayılan ortamınki) */
  trustBase?: string;
  /** Kök pinleri (varsayılan pakete gömülü; bant dışı doğrulanmış değerle değiştirilebilir) */
  pins?: string[];
  /** Kurumun elindeki, operatörün verdiği sertifikalar (listedeki köke zincir denetimi) */
  localCerts?: Array<{ name: string; pem: string }>;
  /** Servis meta verisini de oku (varsayılan evet) */
  services?: boolean;
  anchorMaxAgeHours?: number;
  now?: Date;
}

export async function listingChecks(http: Http, o: ListingOptions): Promise<Row[]> {
  const rows: Row[] = [];
  const now = o.now ?? new Date();
  const net = NETWORKS[o.environment];
  const base = (o.trustBase ?? net.trust).replace(/\/$/, "");
  const pins = (o.pins?.length ? o.pins : net.pins).map((p) => p.toLowerCase());
  const strict = o.environment === "production";
  const read = async (rel: string) => {
    const r = await safe(http, `${base}/${rel}`);
    return r.status === 200 ? r.text.trim() : null;
  };
  const lotlJws = await read("lotl.jws");
  if (!lotlJws) {
    rows.push({
      id: "L1",
      check: "İmzalı liste okundu",
      result: "fail",
      detail: `${base}/lotl.jws okunamadı`,
      fix: "ağ bağlantısı / vekil sunucu; adres doğru mu (--trust)",
    });
    return rows;
  }
  const national: Record<string, string> = {};
  try {
    const payload = JSON.parse(Buffer.from(lotlJws.split(".")[1] ?? "", "base64url").toString("utf8")) as {
      national_lists?: Array<{ state_code: string; status: string }>;
    };
    for (const n of payload.national_lists ?? [])
      if (n.status === "ACTIVE") {
        const t = await read(`tl-${n.state_code.toLowerCase()}.jws`);
        if (t) national[n.state_code.toUpperCase()] = t;
      }
  } catch {
    /* yükleyici imzayı ve biçimi aşağıda reddeder */
  }
  const wrprcText = await read("wrprc/index.json");
  let wrprcIndex: { items: Rec[] } | null = null;
  try {
    wrprcIndex = wrprcText ? JSON.parse(wrprcText) : null;
  } catch {
    wrprcIndex = null;
  }
  let store: TrustStore;
  try {
    ({ store } = await loadTrustSet({
      lotlJws,
      nationalListJws: national,
      anchorsJsonl: (await read("anchors.jsonl")) ?? "",
      rootFingerprints: pins,
      environment: o.environment,
      anchorMaxAgeMs: (o.anchorMaxAgeHours ?? 2) * 3600_000,
      versionMemory: "none",
      now,
    }));
  } catch (e) {
    rows.push({
      id: "L1",
      check: "İmzalı liste doğrulandı (kök pini, imza, ortam)",
      result: "fail",
      detail: clean((e as Error).message),
      fix: "ortam (--env) doğru mu; pin değiştiyse tamga.network/trust-anchor'daki değerle karşılaştırın (--pin) ya da aracı güncelleyin",
    });
    return rows;
  }
  const f = store.getFreshness();
  rows.push({
    id: "L1",
    check: "İmzalı liste doğrulandı (kök pini, imza, ortam)",
    result: f?.healthy ? "pass" : strict ? "fail" : "warn",
    detail: `${base} · lotl v${f?.lotlVersion} · ulusal listeler ${[...store.national.keys()].join(",")} · taze ${f?.healthy ? "evet" : "HAYIR"}`,
    fix: f?.healthy
      ? undefined
      : "liste bayat görünüyor — birkaç dakika sonra tekrar deneyin; sürerse operatöre bildirin",
  });

  let issuer: Issuer | undefined;
  let statusListUris: string[] = [];
  const wrprcPaths: string[] = [];
  let vcts: string[] = [];
  const idx = wrprcIndex?.items ?? [];
  if (o.slug) {
    issuer = [...store.issuers.values()].find((i) => i.slug === o.slug);
    if (!issuer) {
      rows.push({
        id: "L2",
        check: `Kurum listede (${o.slug})`,
        result: "fail",
        detail: "imzalı listede bu kısa ad yok",
        fix: "kayıt operatörde yapılır: başvuru + CSR'ları gönderin; kayıttan ve yayından sonra (en geç 24 saat) tekrar deneyin. Sandbox test kurumunun kısa adı t-… biçimindedir",
      });
    } else {
      const active = issuer.status === "ACTIVE" && activeAt(issuer.valid_from, issuer.valid_until, now);
      rows.push({
        id: "L2",
        check: `Kurum listede ve ACTIVE (${o.slug})`,
        result: active ? "pass" : "fail",
        detail: clean(
          `${issuer.legal_name} · ${issuer.category}/${issuer.class}/${issuer.assurance} · ${issuer.status} · ${issuer.valid_from.slice(0, 10)} → ${issuer.valid_until.slice(0, 10)}${issuer.test_institution ? " · test kurumu" : ""}`,
        ),
        fix: active ? undefined : "kurum askıda, geri çekilmiş ya da geçerlilik dışında — operatörle görüşün",
      });
      const miss = missing(issuer as unknown as Rec, REG_FIELDS_ISSUER);
      rows.push({
        id: "L3",
        check: "Kayıt verisi eksiksiz (ADR-0024)",
        result: miss.length ? (strict ? "fail" : "warn") : "pass",
        detail: miss.length ? `eksik: ${miss.join(", ")}` : "ticari ad, kimlik no, adres, iletişim, denetim makamı var",
        fix: miss.length ? "eksik alanları operatöre gönderin (kayıt verisi güncellemesi)" : undefined,
      });
      vcts = issuer.schema_authorizations
        .filter((a) => a.allowed && activeAt(a.valid_from, a.valid_until, now))
        .map((a) => store.schemas.get(a.schema_id)?.vct)
        .filter((v): v is string => typeof v === "string");
      const lacking = (o.expectVcts ?? []).filter((v) => !vcts.includes(v));
      rows.push({
        id: "L4",
        check: "Belge türü yetkileri",
        result: !vcts.length || lacking.length ? "fail" : "pass",
        detail: `yetkili: ${vcts.join(", ") || "yok"}${lacking.length ? ` · beklenen ama yok: ${lacking.join(", ")}` : ""}`,
        fix: !vcts.length || lacking.length ? "eksik belge türü için operatöre yetki isteği" : undefined,
      });
      const root = store.root_cas.get(issuer.parent_ca_id);
      const rootOk = !!root && root.status === "ACTIVE";
      rows.push({
        id: "L5",
        check: "Üst sertifika makamı listede ve ACTIVE",
        result: rootOk ? "pass" : "fail",
        detail: root ? clean(`${root.legal_name} · ${root.status}`) : "üst makam listede yok",
        fix: rootOk ? undefined : "sertifikanın ağın kökünce verilmesi gerekir — operatöre bildirin",
      });
      const anchors = [...store.status_anchors.values()].filter((a) => a.issuer_id === issuer!.issuer_id);
      statusListUris = anchors.map((a) => a.list_uri);
      rows.push({
        id: "L6",
        check: "İptal listesi yayınlandı ve çapalandı",
        result: anchors.length ? "pass" : "warn",
        detail: anchors.length
          ? `${anchors.length} liste · son yayın ${anchors
              .map((a) => a.published_at)
              .sort()
              .pop()}`
          : "çapa yok — yeni kurumda ilk yayından önce beklenir (doğrulamada geçici 'şu an doğrulanamadı')",
        fix: anchors.length ? undefined : "servis açık mı; bir yayın aralığı bekleyip tekrar deneyin",
      });
      const issuerWrprc = idx.filter((x) => x.kind === "issuer" && x.slug === o.slug);
      rows.push({
        id: "L7",
        check: "Kurumun kayıt sertifikası (ADR-0026)",
        result: wrprcIndex ? (issuerWrprc.length ? "pass" : "fail") : "skip",
        detail: !wrprcIndex
          ? "wrprc/index.json okunamadı"
          : issuerWrprc.length
            ? `${issuerWrprc.length} sertifika`
            : "kurum için kayıt sertifikası yok",
        fix:
          wrprcIndex && !issuerWrprc.length
            ? "kurum sertifikasında organizationIdentifier olmalı (tamga-onboard keys bunu CSR'a yazar) — operatöre bildirin"
            : undefined,
      });
      wrprcPaths.push(...issuerWrprc.map((x) => String(x.path)));
    }
  }

  if (o.rp) {
    const rp = store.relying_parties_by_dns.get(o.rp);
    const rpActive = !!rp && rp.status === "ACTIVE";
    const scopes = (rp?.scopes ?? []).filter((s) => activeAt(s.valid_from, s.valid_until, now));
    rows.push({
      id: "R1",
      check: `Doğrulayıcı / kimlik eşleştirme kaydı (${o.rp})`,
      result: rpActive && scopes.length ? "pass" : "fail",
      detail: rp
        ? clean(
            `${rp.status} · etkin kullanım: ${scopes.map((s) => `${s.scope_id} (${s.vct}: ${s.claims.join("+")})`).join("; ") || "yok"}`,
          )
        : "listede yok",
      fix:
        rpActive && scopes.length ? undefined : "kayıt operatörde yapılır; kayıttan ve yayından sonra tekrar deneyin",
    });
    if (rp) {
      const rmiss = missing(rp as unknown as Rec, REG_FIELDS_RP);
      const noPrivacy = scopes
        .filter((s) => !s.privacy_policy_uri)
        .map((s) => `scopes[${s.scope_id}].privacy_policy_uri`);
      const all = [...rmiss, ...noPrivacy];
      rows.push({
        id: "R2",
        check: "Doğrulayıcı kayıt verisi eksiksiz (ADR-0024)",
        result: all.length ? (strict ? "fail" : "warn") : "pass",
        detail: all.length ? `eksik: ${all.join(", ")}` : "tam",
        fix: all.length
          ? "eksik alanları operatöre gönderin (her kullanım için gizlilik politikası adresi)"
          : undefined,
      });
      const rpItems = idx.filter((x) => x.kind === "rp" && scopes.some((s) => s.scope_id === x.scope_id));
      const noCert = scopes.filter((s) => !rpItems.some((x) => x.scope_id === s.scope_id)).map((s) => s.scope_id);
      rows.push({
        id: "R3",
        check: "Her kullanım için kayıt sertifikası (isteğe eklenir)",
        result: !wrprcIndex ? "skip" : noCert.length ? "fail" : "pass",
        detail: !wrprcIndex
          ? "wrprc/index.json okunamadı"
          : noCert.length
            ? `sertifikasız kullanım: ${noCert.join(", ")}`
            : `${rpItems.length} sertifika — her isteğe kullanımın kayıt sertifikasını ekleyin (yoksa cüzdan reddeder)`,
        fix: noCert.length ? "erişim sertifikasında organizationIdentifier olmalı — operatöre bildirin" : undefined,
      });
      wrprcPaths.push(...rpItems.map((x) => String(x.path)));
    }
  }

  if (o.slug || o.rp) {
    const groups = [...store.relying_parties.values()].flatMap((r) =>
      (r.terminal_groups ?? [])
        .filter((g) => (o.slug && g.institution_id === o.slug) || (o.rp && g.institution_id === o.rp))
        .filter((g) => activeAt(g.valid_from, g.valid_until, now))
        .map((g) => `${g.group_id} @${r.dns_name}`),
    );
    rows.push({
      id: "L8",
      check: "Kapı grupları (ADR-0069)",
      result: groups.length ? "pass" : "skip",
      detail: groups.length
        ? clean(groups.join("; "))
        : "kuruma ait kapı grubu yok (kapı/turnike kullanılmıyorsa gerekmez)",
    });
  }

  // yerel sertifikalar → listedeki kök (operatör sertifikayı verdikten sonra)
  for (const c of o.localCerts ?? []) {
    let x: X509Certificate;
    try {
      x = new X509Certificate(c.pem);
    } catch {
      rows.push({ id: "C2", check: `${c.name}: sertifika okunamadı`, result: "fail", detail: "PEM X.509 bekleniyor" });
      continue;
    }
    const root = [...store.root_cas.values()].find((r) => {
      try {
        return !!r.cert_pem && x.verify(new X509Certificate(r.cert_pem).publicKey);
      } catch {
        return false;
      }
    });
    const fp = sha256Hex(x.raw);
    const listed =
      c.name.startsWith("issuer-") && issuer && !c.name.endsWith("-status")
        ? issuer.cert_fingerprint_sha256 === fp
          ? " · listedeki kurum sertifikasıyla aynı"
          : " · DİKKAT: listedeki kurum sertifikasından farklı"
        : "";
    rows.push({
      id: "C2",
      check: `${c.name}: sertifika listedeki köke bağlı`,
      result: root && root.status === "ACTIVE" && !listed.includes("DİKKAT") ? "pass" : "fail",
      detail: root ? clean(`${root.legal_name} (${root.status})${listed}`) : "listedeki hiçbir kökçe imzalı değil",
      fix: root
        ? undefined
        : "sertifika başka ortamın (sandbox / gerçek ağ) kökünden olabilir — --env ve dosyayı kontrol edin",
    });
  }

  if (o.services === false || !issuer) return rows;
  // servis meta verisi (listedeki issuer_url; kurumun kendi servisi de) — RFC 8414 adres kuralı
  const md = await safe(http, wellKnown(issuer.issuer_url, "openid-credential-issuer"));
  let configs: string[] = [];
  let mdIssuer = "";
  try {
    const j = JSON.parse(md.text) as { credential_issuer?: string; credential_configurations_supported?: Rec };
    configs = Object.keys(j.credential_configurations_supported ?? {});
    mdIssuer = String(j.credential_issuer ?? "");
  } catch {
    /* aşağıda */
  }
  const lacking = vcts.filter((v) => !configs.includes(v));
  rows.push({
    id: "H1",
    check: "Belge veren meta verisi (OpenID4VCI)",
    result: md.status !== 200 ? "fail" : lacking.length || mdIssuer !== issuer.issuer_url ? "warn" : "pass",
    detail:
      md.status === 200
        ? clean(
            `HTTP 200 · ${configs.length} belge türü${lacking.length ? ` · listede yetkili ama meta veride yok: ${lacking.join(", ")}` : ""}${mdIssuer !== issuer.issuer_url ? ` · credential_issuer listedekinden farklı (${mdIssuer})` : ""}`,
          )
        : `HTTP ${md.status} — ${clean(wellKnown(issuer.issuer_url, "openid-credential-issuer"))}`,
    fix:
      md.status !== 200
        ? "kendi servisinizde meta veri adresi; barındırılan serviste operatöre bildirin"
        : lacking.length
          ? "bu türleri verecekseniz servis yapılandırmasına ekleyin; vermeyecekseniz yetkinin kapatılmasını isteyin"
          : undefined,
  });
  const signed = await safe(http, wellKnown(issuer.issuer_url, "openid-credential-issuer"), {
    headers: { accept: "application/jwt" },
  });
  const root = store.root_cas.get(issuer.parent_ca_id);
  const chain =
    signed.status === 200
      ? checkMetadataChain(signed.text.trim(), issuer.cert_fingerprint_sha256, root?.cert_pem)
      : { ok: false, detail: `HTTP ${signed.status}` };
  rows.push({
    id: "H2",
    check: "Sertifika zinciri (imzalı meta veri x5c → listedeki kök)",
    result: chain.ok ? "pass" : "fail",
    detail: clean(chain.detail),
    fix: chain.ok
      ? undefined
      : "servisin imza anahtarı kayıttaki sertifikayla aynı mı; sertifika yenilendiyse liste güncellendi mi",
  });
  const as = await safe(http, wellKnown(issuer.issuer_url, "oauth-authorization-server"));
  rows.push({
    id: "H3",
    check: "Yetkilendirme sunucusu meta verisi",
    result: as.status === 200 ? "pass" : "fail",
    detail: `HTTP ${as.status}`,
    fix: as.status === 200 ? undefined : "servis meta veri adresi (RFC 8414)",
  });
  if (statusListUris.length) {
    const sl = await safe(http, statusListUris[statusListUris.length - 1]);
    rows.push({
      id: "H4",
      check: "İptal listesi erişilebilir",
      result: sl.status === 200 && /statuslist\+(jwt|cwt)/.test(sl.contentType) ? "pass" : "fail",
      detail: clean(`HTTP ${sl.status} · ${sl.contentType || "içerik türü yok"}`),
      fix: sl.status === 200 ? undefined : "iptal listesi adresi (status_list_base) yayında mı",
    });
  }
  if (wrprcPaths.length) {
    const bad: string[] = [];
    for (const p of wrprcPaths) if ((await safe(http, `${base}/${p}`)).status !== 200) bad.push(p);
    rows.push({
      id: "H5",
      check: "Kayıt sertifikası dosyaları yayında",
      result: bad.length ? "fail" : "pass",
      detail: bad.length ? clean(`erişilemeyen: ${bad.join(", ")}`) : `${wrprcPaths.length} dosya HTTP 200`,
      fix: bad.length ? "yayın birkaç dakika gecikebilir; sürerse operatöre bildirin" : undefined,
    });
  }
  return rows;
}

/**
 * İmzalı meta veri JWT'sinin x5c zinciri: yaprak listedeki parmak iziyle aynı, her halka bir üsttekince imzalı, son halka listedeki
 * kökçe imzalı ve JWT imzası yaprağın anahtarıyla geçerli.
 */
export function checkMetadataChain(
  jwt: string,
  listFingerprint: string,
  rootPem: string | undefined,
): { ok: boolean; detail: string } {
  const [h, p, s] = jwt.split(".");
  if (!h || !p || !s) return { ok: false, detail: "imzalı meta veri JWT değil" };
  let header: { x5c?: string[] };
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
  } catch {
    return { ok: false, detail: "JWT başlığı okunamadı" };
  }
  if (!header.x5c?.length) return { ok: false, detail: "x5c yok" };
  let chain: X509Certificate[];
  try {
    chain = header.x5c.map((c) => new X509Certificate(der(c)));
  } catch {
    return { ok: false, detail: "x5c sertifikaları okunamadı" };
  }
  const leafFp = sha256Hex(der(header.x5c[0]));
  if (leafFp !== listFingerprint)
    return {
      ok: false,
      detail: `yaprak parmak izi listedekiyle aynı değil (${leafFp.slice(0, 12)}… ≠ ${listFingerprint.slice(0, 12)}…)`,
    };
  for (let i = 0; i + 1 < chain.length; i++)
    if (!chain[i].verify(chain[i + 1].publicKey))
      return { ok: false, detail: `x5c[${i}] x5c[${i + 1}]'ce imzalı değil` };
  if (!rootPem) return { ok: false, detail: "listede kök sertifikası yok — zincir sona kadar denetlenemedi" };
  const root = new X509Certificate(rootPem);
  if (!chain[chain.length - 1].verify(root.publicKey))
    return { ok: false, detail: "zincirin son halkası listedeki kökçe imzalı değil" };
  const sigOk = nodeVerify(
    "sha256",
    Buffer.from(`${h}.${p}`),
    { key: chain[0].publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(s, "base64url"),
  );
  if (!sigOk) return { ok: false, detail: "meta veri imzası yaprak anahtarıyla doğrulanmadı" };
  return { ok: true, detail: `${chain.length} halka → ${root.subject.split("\n").find((l) => l.startsWith("CN="))}` };
}

// ───────────────────────────── kurulum aşaması ─────────────────────────────

export interface InstallationInput {
  /** Katılım klasörü (init çıktısı) — verilirse profil, başvurular ve anahtarlar buradan okunur */
  dir?: string;
  profile?: Profile;
  issuer?: Rec;
  rp?: Rec;
  /** Şifreli özel anahtarlar için parola (anahtar ↔ CSR eşleşmesi) */
  passphrase?: string;
  /** Operatörün verdiği tek kullanımlık alan adı teyit değeri (profildeki dns_txt'e üstün) */
  dnsTxt?: string;
  /** Ağ denetimlerini atla (yalnız dosyalar) */
  offline?: boolean;
}

/** Katılım klasörünü okur (onboarding.json + başvurular). */
export function readOnboardingDir(dir: string): { profile: Profile; issuer?: Rec; rp?: Rec } {
  const pf = join(dir, "onboarding.json");
  if (!existsSync(pf)) throw new Error(`${pf} yok — önce: tamga-onboard init`);
  const profile = JSON.parse(readFileSync(pf, "utf8")) as Profile;
  const rd = (f?: string) =>
    f && existsSync(join(dir, f)) ? JSON.parse(readFileSync(join(dir, f), "utf8")) : undefined;
  return { profile, issuer: rd(profile.applications?.issuer), rp: rd(profile.applications?.rp) };
}

export async function installationChecks(input: InstallationInput, deps: { http: Http; dns?: Dns }): Promise<Row[]> {
  const rows: Row[] = [];
  let { profile, issuer, rp } = input;
  if (input.dir) {
    try {
      ({ profile, issuer, rp } = readOnboardingDir(input.dir));
    } catch (e) {
      rows.push({ id: "A0", check: "Katılım klasörü", result: "fail", detail: (e as Error).message });
      return rows;
    }
  }
  // A — başvuru dosyaları
  for (const [id, label, app, fn] of [
    ["A1", "Belge veren başvurusu", issuer, validateIssuerApplication],
    ["A2", "Doğrulayıcı / kimlik eşleştirme başvurusu", rp, validateRpApplication],
  ] as const) {
    if (!app) continue;
    const f = fn(app);
    rows.push({
      id,
      check: `${label} (kayıt kuralları)`,
      result: f.problems.length ? "fail" : f.warnings.length ? "warn" : "pass",
      detail: f.problems.length
        ? f.problems.join("; ")
        : f.warnings.length
          ? f.warnings.join("; ")
          : "kayıt aracının kurallarına uyuyor",
      fix: f.problems.length ? "başvuruyu düzeltin (tamga-onboard validate)" : undefined,
    });
  }
  if (!issuer && !rp)
    rows.push({ id: "A1", check: "Başvuru dosyası", result: "fail", detail: "başvuru yok", fix: "tamga-onboard init" });

  // K — anahtarlar, CSR'lar, operatörün verdiği sertifikalar
  if (profile && input.dir) {
    const kdir = join(input.dir, "keys");
    let exps: ReturnType<typeof csrExpectations> = [];
    try {
      exps = csrExpectations(profile.keys ?? [], { issuer, rp });
    } catch (e) {
      rows.push({ id: "K0", check: "Anahtar beklentileri", result: "fail", detail: (e as Error).message });
    }
    for (const e of exps) {
      const keyPath = join(kdir, `${e.name}.key.pem`);
      const csrPath = join(kdir, `${e.name}.csr.pem`);
      const certPath = join(kdir, `${e.name}.cert.pem`);
      const problems: string[] = [];
      const notes: string[] = [];
      let keySpki: string | undefined;
      if (!existsSync(keyPath)) notes.push("özel anahtar bu klasörde yok (HSM / uzaktan imza hizmetinde olabilir)");
      else {
        const perm = privateKeyPermissionOk(keyPath);
        if (perm === false) problems.push("özel anahtar dosyası başkalarınca okunabilir (chmod 600)");
        if (perm === null) notes.push("Windows: dosya iznini denetleyin (yalnız siz)");
        try {
          keySpki = privateKeySpkiSha256(readFileSync(keyPath, "utf8"), input.passphrase);
        } catch {
          notes.push("özel anahtar açılamadı (şifreliyse --passphrase-env)");
        }
      }
      if (!existsSync(csrPath)) problems.push("CSR yok (tamga-onboard keys)");
      else {
        const csrPem = readFileSync(csrPath, "utf8");
        const r = await inspectCsr(csrPem, e);
        problems.push(...r.problems.filter((x) => !x.includes("uyarı")));
        notes.push(...r.problems.filter((x) => x.includes("uyarı")));
        if (keySpki && keySpki !== (await csrSpkiSha256(csrPem).catch(() => "")))
          problems.push("CSR bu özel anahtarın değil");
      }
      rows.push({
        id: "K1",
        check: `${e.name}: anahtar ve CSR`,
        result: problems.length ? "fail" : notes.length ? "warn" : "pass",
        detail: [...problems, ...notes].join("; ") || `P-256 · ${e.orgId}${e.dns ? ` · SAN ${e.dns}` : ""}`,
        fix: problems.length
          ? "tamga-onboard keys (eski dosyaları taşıyıp yeniden) ya da keys --inspect ile dış CSR"
          : undefined,
      });
      if (existsSync(certPath)) rows.push(certRow(e, readFileSync(certPath, "utf8"), keySpki));
    }
  }

  if (input.offline) return rows;
  const dns = deps.dns ?? (await defaultDns());
  // N — alan adı
  const domain = profile?.domain;
  if (domain) {
    const addrs = await dns.lookup(domain).catch(() => [] as string[]);
    rows.push({
      id: "N1",
      check: `Alan adı çözülüyor (${domain})`,
      result: addrs.length ? "pass" : "fail",
      detail: addrs.length ? `${addrs.length} adres` : "çözülemedi",
      fix: addrs.length ? undefined : "DNS kaydı",
    });
    const want = input.dnsTxt ?? profile?.dns_txt;
    if (want) {
      const txt = (await dns.resolveTxt(domain).catch(() => [] as string[][])).map((r) => r.join(""));
      rows.push({
        id: "N2",
        check: "Alan adı teyidi (DNS TXT)",
        result: txt.includes(want) ? "pass" : "fail",
        detail: txt.includes(want)
          ? "operatörün verdiği değer yayında"
          : `değer bulunamadı (${txt.length} TXT kaydı var)`,
        fix: txt.includes(want)
          ? undefined
          : `${domain} için TXT kaydı olarak operatörün verdiği değeri ekleyin; yayılması saatler sürebilir`,
      });
    } else
      rows.push({
        id: "N2",
        check: "Alan adı teyidi (DNS TXT)",
        result: "skip",
        detail: "operatörün tek kullanımlık değeri henüz yok (--dns-txt <değer> ya da onboarding.json dns_txt)",
      });
  }
  // U — kayıttaki https adresleri
  const urls = new Set<string>();
  for (const app of [issuer, rp]) {
    if (!app) continue;
    for (const u of [app.contact?.support_uri, app.info_uri, app.revocation_policy_uri]) if (u) urls.add(u);
    for (const s of (app.scopes ?? []) as Rec[]) if (s.privacy_policy_uri) urls.add(s.privacy_policy_uri);
  }
  if (urls.size) {
    const bad: string[] = [];
    for (const u of urls) {
      const r = await safe(deps.http, u);
      if (!(r.status >= 200 && r.status < 400)) bad.push(`${u} (${r.status || "erişilemedi"})`);
    }
    rows.push({
      id: "U1",
      check: "Kayıttaki adresler açılıyor (destek, bilgi, gizlilik politikası)",
      result: bad.length ? "fail" : "pass",
      detail: bad.length ? clean(bad.join("; ")) : `${urls.size} adres`,
      fix: bad.length ? "cüzdan bu adresleri kişiye gösterir — yayında olmalı" : undefined,
    });
  }
  // M — kendi servisi olan kurum: meta veri
  if (issuer?.issuer_url) {
    const md = await safe(deps.http, wellKnown(issuer.issuer_url, "openid-credential-issuer"));
    let j: Rec = {};
    try {
      j = JSON.parse(md.text);
    } catch {
      /* aşağıda */
    }
    const configs = Object.keys(j.credential_configurations_supported ?? {});
    const lacking = ((issuer.vcts ?? []) as string[]).filter((v) => !configs.includes(v));
    rows.push({
      id: "M1",
      check: "Belge veren meta verisi (.well-known/openid-credential-issuer)",
      result:
        md.status !== 200 ? "fail" : j.credential_issuer !== issuer.issuer_url || lacking.length ? "fail" : "pass",
      detail:
        md.status !== 200
          ? `HTTP ${md.status}`
          : clean(
              `credential_issuer ${j.credential_issuer === issuer.issuer_url ? "doğru" : `farklı (${j.credential_issuer})`} · ${configs.length} belge türü${lacking.length ? ` · eksik: ${lacking.join(", ")}` : ""}`,
            ),
      fix: md.status !== 200 ? "RFC 8414 adres kuralı: /.well-known/openid-credential-issuer/<yol>" : undefined,
    });
    const as = await safe(deps.http, wellKnown(issuer.issuer_url, "oauth-authorization-server"));
    rows.push({
      id: "M2",
      check: "Yetkilendirme sunucusu meta verisi",
      result: as.status === 200 ? "pass" : "fail",
      detail: `HTTP ${as.status}`,
    });
    const signed = await safe(deps.http, wellKnown(issuer.issuer_url, "openid-credential-issuer"), {
      headers: { accept: "application/jwt" },
    });
    const certPath = input.dir ? join(input.dir, "keys", `${issuer.cert}.cert.pem`) : "";
    let leafOk: boolean | null = null;
    try {
      const x5c = JSON.parse(Buffer.from(signed.text.split(".")[0], "base64url").toString("utf8")).x5c as string[];
      if (certPath && existsSync(certPath))
        leafOk = sha256Hex(der(x5c[0])) === sha256Hex(new X509Certificate(readFileSync(certPath)).raw);
      else leafOk = x5c?.length > 0 ? null : false;
    } catch {
      leafOk = false;
    }
    rows.push({
      id: "M3",
      check: "İmzalı meta veri (x5c)",
      result: signed.status !== 200 || leafOk === false ? "fail" : leafOk ? "pass" : "warn",
      detail:
        signed.status !== 200
          ? `HTTP ${signed.status} (Accept: application/jwt)`
          : leafOk
            ? "yaprak operatörün verdiği sertifikayla aynı"
            : leafOk === null
              ? "x5c var; sertifika dosyası klasörde yok — katıldıktan sonra --listing zinciri listedeki köke denetler"
              : "x5c yok ya da yaprak sertifikanızdan farklı",
      fix:
        signed.status !== 200 || leafOk === false
          ? "imzalı meta veri kurum anahtarıyla, x5c'de operatörün verdiği sertifika"
          : undefined,
    });
  }
  // Q — sorgu ucu (kişisel veri yok: yalnız geçersiz isteklerle yoklanır)
  if (profile?.lookup_url) {
    const u = profile.lookup_url;
    const get = await safe(deps.http, u);
    const empty = await safe(deps.http, u, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const forged = await safe(deps.http, u, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "e30.e30.AA" }),
    });
    const all = [get, empty, forged];
    const reachable = all.every((r) => r.status > 0);
    const leaks = all.some((r) => r.status >= 200 && r.status < 300);
    const errors = all.some((r) => r.status >= 500);
    // örnek 05: boş gövde 400, imzasız istek 400/401 — 404/405 ise bu adreste uç yok gibi
    const rejects = [empty, forged].every((r) => [400, 401, 403, 415, 422].includes(r.status));
    rows.push({
      id: "Q1",
      check: "Sorgu ucu erişilebilir ve imzasız isteği reddediyor",
      result: !reachable || leaks ? "fail" : errors || !rejects ? "warn" : "pass",
      detail: `GET ${get.status || "erişilemedi"} · boş POST ${empty.status || "-"} · imzasız POST ${forged.status || "-"} (beklenen: 405 · 400 · 401)`,
      fix: leaks
        ? "imzasız isteğe 2xx dönülmemeli — örnek 05'teki denetimler (imza, çağıran, aud, süre, jti)"
        : !reachable
          ? "adres dışarıdan https ile açık mı (Tamga'nın barındırılan servisi bu adrese bağlanır)"
          : errors
            ? "5xx yanıtı: geçersiz istek 400/401 ile reddedilmeli"
            : !rejects
              ? "POST isteği 400/401 ile reddedilmedi — adres sorgu ucunun kendisi mi (examples/05-institution-source)"
              : undefined,
    });
  }
  // V — doğrulayıcının alan adı
  if (profile?.role === "verifier" && rp?.dns_name) {
    const r = await safe(deps.http, `https://${rp.dns_name}/`);
    rows.push({
      id: "V1",
      check: `Doğrulayıcı alan adı https ile açık (${rp.dns_name})`,
      result: r.status > 0 && r.status < 500 ? "pass" : "fail",
      detail: r.status ? `HTTP ${r.status}` : clean(r.text),
      fix:
        r.status > 0 && r.status < 500
          ? undefined
          : "erişim sertifikasındaki alan adı istek gönderen sitenin alan adıdır",
    });
  }
  return rows;
}

/** Operatörün verdiği sertifika: aynı anahtar, kurum kimlik no, geçerlilik, erişim sertifikasında SAN. */
function certRow(e: ReturnType<typeof csrExpectations>[number], pem: string, keySpki: string | undefined): Row {
  const p: string[] = [];
  let x: X509Certificate;
  try {
    x = new X509Certificate(pem);
  } catch {
    return { id: "K2", check: `${e.name}: sertifika`, result: "fail", detail: "okunamadı (PEM X.509 bekleniyor)" };
  }
  const spki = sha256Hex(x.publicKey.export({ type: "spki", format: "der" }));
  if (keySpki && spki !== keySpki) p.push("sertifika bu özel anahtarın değil");
  if (!x.subject.includes(e.orgId)) p.push(`organizationIdentifier ${e.orgId} yok`);
  const now = Date.now();
  if (Date.parse(x.validFrom) > now || Date.parse(x.validTo) < now)
    p.push(`geçerlilik dışında (${x.validFrom} → ${x.validTo})`);
  if (e.dns && !(x.subjectAltName ?? "").includes(`DNS:${e.dns}`)) p.push(`SAN'da ${e.dns} yok`);
  return {
    id: "K2",
    check: `${e.name}: operatörün verdiği sertifika`,
    result: p.length ? "fail" : "pass",
    detail: p.length
      ? p.join("; ")
      : `bitiş ${new Date(x.validTo).toISOString().slice(0, 10)} · sha256 ${sha256Hex(x.raw).slice(0, 16)}…`,
    fix: p.length ? "operatörle görüşün (yanlış CSR'dan verilmiş olabilir)" : undefined,
  };
}

/** Katılım klasöründeki sertifikalar (liste aşamasında köke zincir denetimi için). */
export function localCertificates(dir: string, profile: Profile): Array<{ name: string; pem: string }> {
  return (profile.keys ?? [])
    .map((k) => ({ name: k.name, path: join(dir, "keys", `${k.name}.cert.pem`) }))
    .filter((k) => existsSync(k.path))
    .map((k) => ({ name: k.name, pem: readFileSync(k.path, "utf8") }));
}

/** Kişiye gösterim: Markdown tablo + özet (kişisel veri yok). */
export function formatRows(rows: Row[]): string {
  const L: Record<Result, string> = { pass: "GEÇTİ", fail: "KALDI", warn: "UYARI", skip: "ATLANDI" };
  const esc = (s: string) => s.replace(/\|/g, "\\|");
  const n = (r: Result) => rows.filter((x) => x.result === r).length;
  return [
    "| # | Denetim | Sonuç | Ayrıntı | Düzeltme |",
    "|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.id} | ${esc(r.check)} | ${L[r.result]} | ${esc(r.detail)} | ${esc(r.fix ?? "")} |`),
    "",
    `özet: ${n("pass")} geçti · ${n("fail")} kaldı · ${n("warn")} uyarı · ${n("skip")} atlandı`,
  ].join("\n");
}
