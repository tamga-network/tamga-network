/**
 * Eşdeğerlik testi (ADR-0009 K7; ADR-0073 K6 / CE6; ADR-0015 K3–K5): aynı soru kümesi iki kaynağa — `TrustSource(list)`
 * (imzalı liste) ve `TrustSource(chain)` (indeksleyici) — ve isteğe bağlı olarak doğrudan kontrat okumasına (sabitlenmiş blok)
 * sorulur. Kabul: C1/C2/C3/D5 cevaplarında ACCEPTED/REJECTED farkı YOK. Öteki sorular (şema sürüm özetleri, doğrulayıcı kaydı ve
 * kapsamları, kapı grupları, cüzdan sağlayıcı anahtarları) ayrıca raporlanır; belgelenmiş bilinen farklar (`known`) adıyla ayrılır.
 *
 * Soru kümesi listeden türetilir: her kurum için kayıtlı her an (geçerlilik sınırları, durum değişiklikleri, sert iptal, kökün ve
 * şemanın durum anları, yetki pencereleri) ve sınır anları (t − 1, t, t + 1) — yarı açık aralıkların bir saniyelik farkını yakalar.
 * `(issuer_id, schema_id, iat, list_id, version)` sorusu böylece bileşenlerine ayrılır: C1 (kurum, iat), C2 (kurum, şema, iat),
 * C3 (devlet, kurum), D5 (liste kimliği → sürüm + özet).
 */
import type { ListTrustSource, TrustStore } from "@tamga-network/trust";

import type { ChainTrustSource } from "./chain-trust-source.js";
import { bytes2, canonicalJson, listIdOf, sec } from "./ids.js";
import type { TrustContracts } from "./contracts.js";
import { scopeArgs } from "./replay-plan.js";

export type Category =
  "C1" | "C2" | "C3" | "D5" | "schema_versions" | "relying_party" | "rp_scopes" | "terminal_group" | "wallet_key";
export interface Difference {
  category: Category;
  question: string;
  list: unknown;
  chain: unknown;
  /** kontrat okuması (yalnız C1/C2/C3/D5 ve `contracts` verildiyse) */
  contract?: unknown;
  /** belgelenmiş bilinen fark (ör. ADR-0075 devir: aynı dns_name iki ülke listesinde) */
  known?: string;
}
export interface EquivalenceReport {
  questions: Record<Category, number>;
  /** liste kaynağının C1/C2/C3 cevap dağılımı (soruların iki yönlü olduğunu gösterir) */
  answers: Record<"C1" | "C2" | "C3", { YES: number; NO: number; UNKNOWN: number }>;
  total: number;
  differences: Difference[];
  /** C1/C2/C3/D5'te ACCEPTED/REJECTED farkı (bilinen fark dahil) — 0 değilse göç kapanmaz (CE6) */
  decisionDifferences: number;
  /** bilinen fark sayılmadan öteki farklar */
  unexpected: number;
}

/** Bir kaydın sınır anları. */
const around = (t: number) => [t - 1, t, t + 1];

export async function compareSources(
  store: TrustStore,
  list: ListTrustSource,
  chain: ChainTrustSource,
  opts: { contracts?: TrustContracts; blockTag?: number; extraIats?: number[] } = {},
): Promise<EquivalenceReport> {
  const q: Record<Category, number> = {
    C1: 0,
    C2: 0,
    C3: 0,
    D5: 0,
    schema_versions: 0,
    relying_party: 0,
    rp_scopes: 0,
    terminal_group: 0,
    wallet_key: 0,
  };
  const diffs: Difference[] = [];
  const answers = {
    C1: { YES: 0, NO: 0, UNKNOWN: 0 },
    C2: { YES: 0, NO: 0, UNKNOWN: 0 },
    C3: { YES: 0, NO: 0, UNKNOWN: 0 },
  };
  const o = opts.blockTag !== undefined ? { blockTag: opts.blockTag } : {};
  const ct = opts.contracts;
  const add = (d: Difference) => diffs.push(d);

  // ---- soru anları
  const schemaTimes = new Map<string, number[]>();
  for (const s of store.schemas.values())
    schemaTimes.set(
      s.schema_id,
      s.status_history.map((h) => sec(h.since)),
    );
  const states = [...store.national.keys()];
  for (const i of store.issuers.values()) {
    const ts = new Set<number>(opts.extraIats ?? []);
    const push = (t: number) => around(t).forEach((x) => ts.add(x));
    push(sec(i.valid_from));
    push(sec(i.valid_until));
    for (const h of i.status_history) {
      push(sec(h.since));
      if (h.invalidates_from) push(sec(h.invalidates_from));
    }
    const ca = store.root_cas.get(i.parent_ca_id);
    for (const h of ca?.status_history ?? []) push(sec(h.since));
    const schemaIds = new Set(i.schema_authorizations.map((a) => a.schema_id));
    for (const a of i.schema_authorizations) {
      push(sec(a.valid_from));
      if (a.valid_until) push(sec(a.valid_until));
    }
    for (const sid of schemaIds) for (const t of schemaTimes.get(sid) ?? []) push(t);
    // yetkisiz bir şema da sorulur (I1: varsayılan NO)
    const other = [...store.schemas.keys()].find((x) => !schemaIds.has(x));
    if (other) schemaIds.add(other);
    const iats = [...ts].filter((t) => t > 0).sort((a, b) => a - b);

    for (const iat of iats) {
      q.C1++;
      const l = list.isCredentialAcceptable(i.issuer_id, iat);
      answers.C1[l]++;
      const c = chain.isCredentialAcceptable(i.issuer_id, iat);
      const k = ct ? ((await ct.IssuerRegistry.isCredentialAcceptable(i.issuer_id, iat, o)) ? "YES" : "NO") : undefined;
      if (l !== c || (k !== undefined && k !== l))
        add({ category: "C1", question: `${i.slug} iat=${iat}`, list: l, chain: c, contract: k });
      for (const sid of schemaIds) {
        q.C2++;
        const l2 = list.isCredentialSchemaAcceptable(i.issuer_id, sid, iat);
        answers.C2[l2]++;
        const c2 = chain.isCredentialSchemaAcceptable(i.issuer_id, sid, iat);
        const k2 = ct
          ? (await ct.IssuerRegistry.isCredentialSchemaAcceptable(i.issuer_id, sid, iat, o))
            ? "YES"
            : "NO"
          : undefined;
        if (l2 !== c2 || (k2 !== undefined && k2 !== l2))
          add({
            category: "C2",
            question: `${i.slug} ${sid.slice(0, 10)} iat=${iat}`,
            list: l2,
            chain: c2,
            contract: k2,
          });
      }
    }
    for (const st of states) {
      q.C3++;
      const l = list.isRecognizedBy(st, i.issuer_id);
      answers.C3[l]++;
      const c = chain.isRecognizedBy(st, i.issuer_id);
      const k = ct
        ? (await ct.CrossRecognition.isRecognizedBy(bytes2(st), i.issuer_id, o))
          ? "YES"
          : "NO"
        : undefined;
      if (l !== c || (k !== undefined && k !== l))
        add({ category: "C3", question: `${st} tanır mı ${i.slug}`, list: l, chain: c, contract: k });
    }
  }

  // ---- D5: liste başına çapa (sürüm + özet + adres; yayın anı saniyeye yuvarlanır — zincir saniye tutar)
  const d5 = (a: { list_uri: string; content_hash: string; version: number; published_at: string } | null) =>
    a && { list_uri: a.list_uri, content_hash: a.content_hash, version: a.version, published_at: sec(a.published_at) };
  for (const a of store.status_anchors.values()) {
    q.D5++;
    const l = d5(list.statusAnchor(a.list_id));
    const c = d5(chain.statusAnchor(a.list_id));
    let k: unknown;
    if (ct) {
      const x = await ct.StatusListRegistry.getListAnchor(listIdOf(a.issuer_id, a.list_uri), o).catch(() => null);
      k = x && {
        list_uri: String(x.listURI),
        content_hash: `sha256:${String(x.contentHash).slice(2)}`,
        version: Number(x.version),
        published_at: Number(x.publishedAt),
      };
    }
    if (canonicalJson(l) !== canonicalJson(c) || (ct && canonicalJson(k) !== canonicalJson(l)))
      add({ category: "D5", question: a.list_id, list: l, chain: c, contract: k });
  }

  // ---- şema sürüm özetleri (B adımı; ADR-0073 K3)
  for (const s of store.schemas.values()) {
    q.schema_versions++;
    const l = [...list.schemaContentHashes(s.schema_id)].sort();
    const c = [...chain.schemaContentHashes(s.schema_id)].sort();
    if (canonicalJson(l) !== canonicalJson(c)) add({ category: "schema_versions", question: s.vct, list: l, chain: c });
  }

  // ---- doğrulayıcılar: kayıt (var mı, durum), kapsamlar (zincir biçiminde), kapı grupları
  const statesOfDns = store.relying_party_states;
  for (const rp of store.relying_parties_by_dns.values()) {
    q.relying_party++;
    const l = list.relyingPartyByDnsName(rp.dns_name);
    const c = chain.relyingPartyByDnsName(rp.dns_name);
    const lv = l && { status: l.status === "RETIRED" ? "REVOKED" : l.status };
    const cv = c && { status: c.status };
    const multi = (statesOfDns.get(rp.dns_name)?.size ?? 0) > 1;
    if (canonicalJson(lv) !== canonicalJson(cv))
      add({
        category: "relying_party",
        question: rp.dns_name,
        list: lv,
        chain: cv,
        ...(multi
          ? {
              known:
                "ADR-0075: aynı dns_name iki ülke listesinde — liste kaynağı belirsiz sayar (null); zincirde devirle tek kayıt, yeni sahibi",
            }
          : {}),
      });
    if (!multi && l && rp.status !== "REVOKED" && rp.status !== "RETIRED") {
      q.rp_scopes++;
      const want = rp.scopes
        .map((s) => scopeArgs(s))
        .filter((x) => typeof x !== "string")
        .map((x) => canonicalJson(x))
        .sort();
      const got = chain
        .requestScopes(rp.dns_name)
        .map((x) => canonicalJson(x))
        .sort();
      if (canonicalJson(want) !== canonicalJson(got))
        add({ category: "rp_scopes", question: rp.dns_name, list: want.length, chain: got.length });
    }
    for (const g of rp.terminal_groups ?? []) {
      q.terminal_group++;
      const lt = list.terminalGroup(g.group_id);
      const ctg = chain.terminalGroup(g.group_id);
      const lv2 = lt && { active: lt.active };
      const cv2 = ctg && { active: ctg.active };
      if (canonicalJson(lv2) !== canonicalJson(cv2))
        add({
          category: "terminal_group",
          question: g.group_id,
          list: lv2,
          chain: cv2,
          ...(multi ? { known: "ADR-0075: grubun doğrulayıcısı iki ülke listesinde (liste kapıyı kapalı tutar)" } : {}),
        });
    }
  }

  // ---- cüzdan sağlayıcı anahtarları (ağ düzeyi kayıt; ADR-0074 K3)
  for (const wp of store.lotl.wallet_providers)
    for (const k of wp.wua_signing_keys) {
      q.wallet_key++;
      const l = list.isWalletProviderKey(k.fingerprint_sha256);
      const c = chain.isWalletProviderKey(k.fingerprint_sha256);
      if (l !== c) add({ category: "wallet_key", question: k.fingerprint_sha256.slice(0, 16), list: l, chain: c });
    }

  const decision = diffs.filter((d) => ["C1", "C2", "C3", "D5"].includes(d.category));
  return {
    questions: q,
    answers,
    total: Object.values(q).reduce((a, b) => a + b, 0),
    differences: diffs,
    decisionDifferences: decision.length,
    unexpected: diffs.filter((d) => !d.known).length,
  };
}
