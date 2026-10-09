/**
 * ADR-0026 — kayıt sertifikaları (WRPRC, ETSI TS 119 475 v1.2.1). İçerik YALNIZ imzalı ulusal listeye giren kayıttan (WRC1);
 * imza kayıt kurumu anahtarıyla (WRC2, cli.ts). Doğrulayıcı kullanımı başına bir, belge veren başına bir sertifika.
 * Alan adları standardın normatif tablolarındaki gibidir (`claim` tekil dahil — bilinen yazım hatası, birlikte çalışma için aynen).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rec = Record<string, any>;

export const WRPRC_TYP = "rc-wrp+jwt";
const MAX_VALIDITY_SEC = 365 * 86400; // GEN-5.2.4-08: en çok 12 ay (WRC3)

/** ETSI TS 119 475 Ek A yetki türü URI'leri ← Tamga kayıt adları (ADR-0024 K2). */
export const ENTITLEMENT_URI: Record<string, string> = {
  service_provider: "https://uri.etsi.org/19475/Entitlement/Service_Provider",
  qeaa_provider: "https://uri.etsi.org/19475/Entitlement/QEAA_Provider",
  non_q_eaa_provider: "https://uri.etsi.org/19475/Entitlement/Non_Q_EAA_Provider",
  pub_eaa_provider: "https://uri.etsi.org/19475/Entitlement/PUB_EAA_Provider",
  pid_provider: "https://uri.etsi.org/19475/Entitlement/PID_Provider",
};

/** ETSI EN 319 412-1 semantik tanımlayıcı (tüzel kişi, Tablo 2): TR-VKN → VATTR-…, TR-MERSIS → NTRTR-… */
export function semanticIdentifier(identifiers: Rec[] | undefined): string | null {
  const map: Record<string, string> = { "TR-VKN": "VAT", "TR-MERSIS": "NTR", LEI: "LEI" };
  for (const scheme of ["TR-VKN", "TR-MERSIS", "LEI"]) {
    const id = identifiers?.find((i) => i.scheme === scheme);
    if (!id?.value) continue;
    const digits = String(id.value).replace(/^TR/i, "").trim();
    if (!digits) continue;
    return scheme === "LEI" ? `LEIXG-${digits}` : `${map[scheme]}TR-${digits}`;
  }
  return null;
}

const toSec = (iso: string | null | undefined) => (iso ? Math.floor(new Date(iso).getTime() / 1000) : Infinity);
const langs = (m: Record<string, string> | undefined, fallback?: string) => {
  const out = Object.entries(m ?? {}).map(([lang, value]) => ({ lang, value }));
  if (fallback && !out.some((x) => x.lang.startsWith("en"))) out.unshift({ lang: "en", value: fallback });
  return out;
};

function common(r: Rec, sub: string, registryUri: string, now: number): Rec {
  return {
    name: r.trade_name ?? r.legal_name,
    sub_ln: r.legal_name,
    sub,
    country: r.postal_address?.country ?? "TR",
    registry_uri: registryUri,
    ...(r.service_description ? { srv_description: [langs(r.service_description)] } : {}),
    ...(r.info_uri ? { info_uri: r.info_uri } : {}),
    ...(r.contact?.support_uri || r.contact?.email ? { support_uri: r.contact.support_uri ?? r.contact.email } : {}),
    ...(r.supervisory_authority
      ? {
          supervisory_authority: {
            ...(r.supervisory_authority.email ? { email: r.supervisory_authority.email } : {}),
            ...(r.supervisory_authority.phone ? { phone: r.supervisory_authority.phone } : {}),
            ...(r.supervisory_authority.form_uri || r.supervisory_authority.info_uri
              ? { uri: r.supervisory_authority.form_uri ?? r.supervisory_authority.info_uri }
              : {}),
          },
        }
      : {}),
    ...(typeof r.is_public_sector_body === "boolean" ? { public_body: r.is_public_sector_body } : {}),
    iat: now,
  };
}

const expOf = (now: number, ...limits: number[]) => Math.min(now + MAX_VALIDITY_SEC, ...limits);

export interface WrprcItem {
  /** yayın yolu: `wrprc/<kind>/<id>.jwt` */
  path: string;
  kind: "rp" | "issuer";
  client_id?: string;
  scope_id?: string;
  slug?: string;
  payload: Rec;
}

/**
 * İmzalı listeye giren kayıtlardan sertifika içerikleri. Kimlik numarası yok ya da kayıt/kullanım etkin değilse üretilmez;
 * nedenleri `skipped`'ta (yayıncı uyarı basar).
 *
 * `orgIdOf` (alan adı → erişim sertifikasındaki organizationIdentifier) verilirse ADR-0026 K3 bağı yayında denetlenir: isteği
 * imzalayan sertifikanın (aracılıda aracının) kimlik numarası sertifikanın `sub`'ıyla (aracılıda `intermediary.sub`) aynı değilse
 * sertifika üretilmez. Üretilseydi cüzdan bağı kuramaz ve isteği bütünüyle reddederdi (2026-10-09 sandbox: erişim sertifikasında
 * organizationIdentifier yoktu, bütün doğrulama senaryoları düştü).
 */
export function buildWrprcPayloads(
  tl: { relying_parties: Rec[]; issuers: Rec[] },
  opts: { now: Date; registryUri: string; orgIdOf?: (dnsName: string) => string | null | undefined },
): { items: WrprcItem[]; skipped: string[] } {
  const now = Math.floor(opts.now.getTime() / 1000);
  const items: WrprcItem[] = [];
  const skipped: string[] = [];
  const byDns = new Map(tl.relying_parties.map((r) => [r.dns_name, r])); // ADR-0034: aracı ilişkisi alan adıyla

  for (const rp of tl.relying_parties) {
    if (rp.status !== "ACTIVE") continue;
    const sub = semanticIdentifier(rp.identifiers);
    if (!sub) {
      skipped.push(`relying_party ${rp.dns_name}: kimlik numarası yok (identifiers)`);
      continue;
    }
    for (const s of rp.scopes as Rec[]) {
      const until = toSec(s.valid_until);
      if (toSec(s.valid_from) > now || until <= now) continue;
      const payload: Rec = {
        ...common(rp, sub, opts.registryUri, now),
        entitlements: ((rp.entitlements as string[] | undefined) ?? ["service_provider"]).map(
          (e) => ENTITLEMENT_URI[e] ?? e,
        ),
        ...(s.privacy_policy_uri ? { privacy_policy: s.privacy_policy_uri } : {}),
        purpose: langs(s.purpose_localized, s.purpose),
        credentials: [
          {
            format: "dc+sd-jwt",
            meta: { vct_values: [s.vct] },
            claim: (s.claims as string[]).map((c) => ({ path: [c] })),
          },
        ],
        intended_use_id: s.scope_id,
        exp: expOf(now, until),
      };
      // ADR-0017: aracı doğrulayıcı (bu RP'nin kullandığı ilk aracı)
      const via = (rp.uses_intermediaries as string[] | undefined)?.map((d) => byDns.get(d)).find(Boolean);
      const viaSub = via ? semanticIdentifier(via.identifiers) : null;
      if (via && viaSub) payload.intermediary = { sub: viaSub, sname: via.trade_name ?? via.legal_name };
      if (opts.orgIdOf) {
        const signer = via && viaSub ? via : rp;
        const want = via && viaSub ? viaSub : sub;
        const got = opts.orgIdOf(signer.dns_name) ?? null;
        if (got !== want) {
          skipped.push(
            `relying_party ${rp.dns_name} / ${s.scope_id}: erişim sertifikasında (${signer.dns_name}) organizationIdentifier ${got ?? "yok"}, beklenen ${want} (ADR-0026 K3)`,
          );
          continue;
        }
      }
      items.push({
        path: `wrprc/rp/${rp.rp_id}/${s.scope_id}.jwt`,
        kind: "rp",
        client_id: rp.client_id,
        scope_id: s.scope_id,
        payload,
      });
    }
  }

  for (const i of tl.issuers) {
    if (i.status !== "ACTIVE") continue;
    const sub = semanticIdentifier(i.identifiers);
    if (!sub) {
      skipped.push(`issuer ${i.slug}: kimlik numarası yok (identifiers)`);
      continue;
    }
    const vcts = (i.schema_authorizations as Rec[])
      .filter((a) => a.allowed && toSec(a.valid_from) <= now && toSec(a.valid_until) > now)
      .map((a) => a.vct as string);
    if (!vcts.length) continue;
    items.push({
      path: `wrprc/issuer/${i.slug}.jwt`,
      kind: "issuer",
      slug: i.slug,
      payload: {
        ...common(i, sub, opts.registryUri, now),
        entitlements: ((i.entitlements as string[] | undefined) ?? []).map((e) => ENTITLEMENT_URI[e] ?? e),
        provides_attestations: vcts.map((v) => ({ format: "dc+sd-jwt", meta: { vct_values: [v] } })),
        exp: expOf(now, toSec(i.valid_until)),
      },
    });
  }
  return { items, skipped };
}

/** JAdES B-B başlığı (TS 119 475 Tablo 5 + GEN-5.2.1-04): typ, x5c (imzacıdan) ve iddia edilen imza zamanı `iat`. */
export const wrprcHeader = (signingTime: Date) => ({ typ: WRPRC_TYP, iat: Math.floor(signingTime.getTime() / 1000) });
