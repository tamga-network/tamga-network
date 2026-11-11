/**
 * Eşdeğerlik testi (ADR-0009 K7; ADR-0073 K6 / CE6; ADR-0015 K3–K5): aynı soru kümesi iki kaynağa — `TrustSource(list)`
 * (imzalı liste) ve `TrustSource(chain)` (indeksleyici) — ve isteğe bağlı olarak doğrudan kontrat okumasına (sabitlenmiş blok)
 * sorulur. Kabul: C1/C2/C3/D5 cevaplarında ACCEPTED/REJECTED farkı YOK. Öteki sorular (şema sürüm özetleri, doğrulayıcı kaydı,
 * geçmiş bir andaki durumu ve kapsamları, kapı grupları, cüzdan sağlayıcı anahtarları, kurum halefi, ağ düzeyi kayıtlar — ZK devresi,
 * dış liste, belge kategorisi, liste imzacısı, liste işletmecisi, devlet ve rol slotu, katalog) ayrıca raporlanır; belgelenmiş
 * bilinen farklar (`known`) adıyla ayrılır.
 *
 * Doğrulayıcının geçmiş bir andaki durumu (`rp_status_at`): liste tarafında aynı alan adının bütün ülke listesi kayıtları (devirde eski
 * listede `REVOKED`), zincirde durum geçmişi. Devir ve iptal sonrası yeniden kaydın zincir tarihi yürütme anıdır (ADR-0075 açık soru
 * 3: geri tarihlenmez); listedeki dönem başlangıcı ile zincirdeki yürütme anı arasındaki aralık bu yüzden sorulmaz.
 *
 * Soru kümesi listeden türetilir: her kurum için kayıtlı her an (geçerlilik sınırları, durum değişiklikleri, sert iptal, kökün ve
 * şemanın durum anları, yetki pencereleri) ve sınır anları (t − 1, t, t + 1) — yarı açık aralıkların bir saniyelik farkını yakalar.
 * `(issuer_id, schema_id, iat, list_id, version)` sorusu böylece bileşenlerine ayrılır: C1 (kurum, iat), C2 (kurum, şema, iat),
 * C3 (devlet, kurum), D5 (liste kimliği → sürüm + özet).
 *
 * TERS GEÇİŞ (kontrol 2026-11-10): sorular yalnız listeden türetilirse zincirde FAZLADAN duran kayıt (listede olmayan kurum, yetki,
 * doğrulayıcı, iptal listesi, cüzdan sağlayıcı anahtarı) hiç sorulmaz. Bu yüzden dizindeki her kayıt da listeye sorulur
 * (`chain_only`): listede yoksa zincirde hiç etkin olmamış olmalıdır. Plan verildiyse (`opts.plan`) dizindeki kimlik kümesi
 * planın işlemlerinin kimlik kümesiyle birebir karşılaştırılır (`plan_set`): planda olmayan zincir kaydı ya da zincirde olmayan
 * plan kaydı farktır. Ucuz kayıt alanları da karşılaştırılır (`record_fields`): kurum sertifikası parmak izi, doğrulayıcının erişim
 * sertifikası ve dönem sayısı, kapı grubunun sertifika parmak izleri ve çevrimdışı izni.
 */
import { statusAt, type ListTrustSource, type RelyingParty, type TrustStore } from "@tamga-network/trust";

import type { ChainTrustSource } from "./chain-trust-source.js";
import { bytes2, bytes32ToFp, canonicalJson, groupIdOf, listIdOf, rpIdOf, sec } from "./ids.js";
import { NET_KIND_NAMES, NetKind, lotlNetworkRecords, nationalNetworkRecords } from "./network-records.js";
import type { TrustContracts } from "./contracts.js";
import { scopeArgs, type ReplayPlan } from "./replay-plan.js";

export type Category =
  | "C1"
  | "C2"
  | "C3"
  | "D5"
  | "schema_versions"
  | "relying_party"
  | "rp_status_at"
  | "rp_scopes"
  | "terminal_group"
  | "wallet_key"
  | "issuer_successor"
  | "zk_circuit"
  | "external_list"
  | "eaa_category"
  | "list_signer"
  | "list_operator"
  | "state_slot"
  | "role_slot"
  | "catalogue"
  | "record_fields"
  | "chain_only"
  | "plan_set";
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
  /** C1/C2/C3/D5'te ACCEPTED/REJECTED farkı ve zincirde fazladan duran etkin kayıt (`chain_only`) — 0 değilse göç kapanmaz (CE6) */
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
  opts: { contracts?: TrustContracts; blockTag?: number; extraIats?: number[]; plan?: ReplayPlan } = {},
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
    rp_status_at: 0,
    issuer_successor: 0,
    zk_circuit: 0,
    external_list: 0,
    eaa_category: 0,
    list_signer: 0,
    list_operator: 0,
    state_slot: 0,
    role_slot: 0,
    catalogue: 0,
    record_fields: 0,
    chain_only: 0,
    plan_set: 0,
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
  // ADR-0075: aynı ad birden çok ülke listesinde olabilir (devirde eski listede REVOKED) — yükleyici iptal edilmemiş tek kaydı alır
  for (const rp of store.relying_parties_by_dns.values()) {
    q.relying_party++;
    const l = list.relyingPartyByDnsName(rp.dns_name);
    const c = chain.relyingPartyByDnsName(rp.dns_name);
    const lv = l && { status: l.status === "RETIRED" ? "REVOKED" : l.status };
    const cv = c && { status: c.status };
    const ambiguous = store.relyingPartyAmbiguous(rp.dns_name);
    if (canonicalJson(lv) !== canonicalJson(cv))
      add({
        category: "relying_party",
        question: rp.dns_name,
        list: lv,
        chain: cv,
        ...(ambiguous
          ? { known: "aynı dns_name iptal edilmemiş iki ülke listesi kaydında — liste kaynağı belirsiz sayar (null)" }
          : {}),
      });
    if (!ambiguous && l && c && rp.status !== "REVOKED" && rp.status !== "RETIRED") {
      // erişim sertifikası (yenileme zincire `updateAccessCertificate` ile yansır)
      q.record_fields++;
      const lf = l.access_cert_fingerprint_sha256.toLowerCase();
      const cf = c.access_cert_fingerprint_sha256;
      if (lf !== cf) add({ category: "record_fields", question: `${rp.dns_name} access_cert`, list: lf, chain: cf });
    }
    if (!ambiguous && l && rp.status !== "REVOKED" && rp.status !== "RETIRED") {
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
      // etkinlik + ucuz alanlar: kapı sertifikaları (sıralı) ve çevrimdışı izni
      const gv = (x: typeof lt) =>
        x && {
          active: x.active,
          offline_allowed: Boolean(x.group.offline_allowed),
          cert_fingerprints: [...(x.group.cert_fingerprints ?? [])].map((f) => f.toLowerCase()).sort(),
        };
      const lv2 = gv(lt);
      const cv2 = gv(ctg);
      if (canonicalJson(lv2) !== canonicalJson(cv2))
        add({
          category: "terminal_group",
          question: g.group_id,
          list: lv2,
          chain: cv2,
          ...(ambiguous
            ? { known: "grubun doğrulayıcısı iptal edilmemiş iki ülke listesi kaydında (liste kapıyı kapalı tutar)" }
            : {}),
        });
    }
  }

  // ---- doğrulayıcının geçmiş bir andaki durumu (tarihli durum yazımları; ADR-0073 K1/K5)
  for (const [dns, byState] of store.relying_party_records) {
    const records = [...byState.values()].sort((a, b) => sec(a.registered_at) - sec(b.registered_at));
    const ts = new Set<number>(opts.extraIats ?? []);
    for (const r of records) {
      around(sec(r.registered_at)).forEach((x) => ts.add(x));
      for (const h of r.status_history) around(sec(h.since)).forEach((x) => ts.add(x));
    }
    // dönem değişikliği: listedeki an ile zincirdeki yürütme anı arasındaki aralık sorulmaz (ADR-0075 açık soru 3)
    const periods = chain.registrationPeriods(dns);
    const listStarts = periodStartsInList(records);
    // dönem sayısı: listedeki her dönem başlangıcı (devir, iptal sonrası yeniden kayıt) zincirde bir kayıt dönemidir (ADR-0075)
    q.record_fields++;
    if (periods.length !== listStarts.length + 1)
      add({
        category: "record_fields",
        question: `${dns} periods`,
        list: listStarts.length + 1,
        chain: periods.length,
      });
    const skip =
      periods.length > 1 && listStarts.length
        ? ([Math.min(...listStarts), Math.max(...periods.slice(1).map((p) => p.since))] as const)
        : null;
    for (const t of [...ts].filter((x) => x > 0).sort((a, b) => a - b)) {
      if (skip && t >= skip[0] && t < skip[1]) continue;
      q.rp_status_at++;
      const l = records.some((r) => statusAt(r.status_history, t)?.status === "ACTIVE") ? "YES" : "NO";
      const c = chain.isRelyingPartyAcceptableAt(dns, t);
      const k = ct
        ? (await ct.RelyingPartyRegistry.isRelyingPartyAcceptableAt(rpIdOf(dns), t, o))
          ? "YES"
          : "NO"
        : undefined;
      if (l !== c || (k !== undefined && k !== l))
        add({ category: "rp_status_at", question: `${dns} t=${t}`, list: l, chain: c, contract: k });
    }
  }

  // ---- kurum halefi (iptal edilmiş kurum; ADR-0002 #4)
  for (const i of store.issuers.values()) {
    q.issuer_successor++;
    const l = i.status === "REVOKED" || i.status === "RETIRED" ? (i.successor_id ?? null) : null;
    const c = chain.issuer(i.issuer_id)?.successor_id ?? null;
    if (l !== c) add({ category: "issuer_successor", question: i.slug, list: l, chain: c });
    // kurumun sertifika parmak izi (kimlik bundan türer; zincirdeki kayıt aynı sertifikayı taşımalı)
    q.record_fields++;
    const lf = i.cert_fingerprint_sha256.toLowerCase();
    const cf = chain.issuer(i.issuer_id)?.cert_fingerprint_sha256 ?? null;
    if (lf !== cf) add({ category: "record_fields", question: `${i.slug} cert_fingerprint`, list: lf, chain: cf });
  }

  // ---- ağ düzeyi kayıtlar (ADR-0074 K3): listedeki her kaydın zincirdeki karşılığı aynı mı; listeden kalkan zincirde etkin değil
  const env = (store.lotl as { environment?: string }).environment ?? "production";
  const expected = [
    ...lotlNetworkRecords(store.lotl, env),
    ...[...store.national.values()].flatMap((n) => nationalNetworkRecords(n.list, env)),
  ];
  const fields = (r: {
    parentId: string;
    region: string;
    subtype: number;
    status: number;
    validFrom: number;
    validUntil: number;
    fingerprint: string;
    detailsHash: string;
    flags: string;
    digests: string[];
  }) => ({
    parentId: r.parentId.toLowerCase(),
    region: r.region.toLowerCase(),
    subtype: r.subtype,
    status: r.status,
    validFrom: r.validFrom,
    validUntil: r.validUntil,
    fingerprint: r.fingerprint.toLowerCase(),
    detailsHash: r.detailsHash.toLowerCase(),
    flags: BigInt(r.flags).toString(),
    digests: r.digests.map((d) => d.toLowerCase()),
  });
  const seenKeys = new Set<string>();
  for (const { what, record } of expected) {
    const cat = NET_KIND_NAMES[record.kind] as Category;
    q[cat]++;
    seenKeys.add(`${record.kind}|${record.recordId.toLowerCase()}`);
    const c = chain.networkRecord(record.kind, record.recordId);
    const lv = fields(record);
    const cv = c && fields(c);
    if (canonicalJson(lv) !== canonicalJson(cv)) add({ category: cat, question: what, list: lv, chain: cv });
  }
  for (const c of chain.networkRecords()) {
    if (c.kind === NetKind.WALLET_PROVIDER || c.kind === NetKind.WALLET_PROVIDER_KEY) continue;
    if (seenKeys.has(`${c.kind}|${c.recordId}`)) continue;
    const cat = NET_KIND_NAMES[c.kind] as Category;
    q[cat]++;
    if (c.status !== 4)
      add({ category: cat, question: `listede yok ${c.recordId.slice(0, 10)}`, list: null, chain: c.status });
  }
  // ZK devresi: doğrulayıcının sorusu (ADR-0032 ZK2: yalnız ACTIVE devre)
  for (const z of store.lotl.zk_circuits ?? []) {
    q.zk_circuit++;
    const pick = (x: { circuit_id: string; sha256: string; version: number; attributes: number } | null) =>
      x && { circuit_id: x.circuit_id, sha256: x.sha256, version: x.version, attributes: x.attributes };
    const l = pick(list.zkCircuit(z.circuit_id));
    const c = pick(chain.zkCircuit(z.circuit_id));
    if (canonicalJson(l) !== canonicalJson(c))
      add({ category: "zk_circuit", question: `zkCircuit ${z.circuit_id.slice(0, 12)}`, list: l, chain: c });
  }

  // ---- cüzdan sağlayıcı anahtarları (ağ düzeyi kayıt; ADR-0074 K3)
  for (const wp of store.lotl.wallet_providers)
    for (const k of wp.wua_signing_keys) {
      q.wallet_key++;
      const l = list.isWalletProviderKey(k.fingerprint_sha256);
      const c = chain.isWalletProviderKey(k.fingerprint_sha256);
      if (l !== c) add({ category: "wallet_key", question: k.fingerprint_sha256.slice(0, 16), list: l, chain: c });
    }

  // ---- TERS GEÇİŞ: dizindeki her kayıt listede var mı (yoksa zincirde hiç etkin olmamış olmalı)
  const ix = chain.indexSnapshot();
  if (!ix) add({ category: "chain_only", question: "dizin okunamıyor (kaynak sağlıksız)", list: null, chain: null });
  else {
    const everActive = (h: Array<[number, number]>) => h.some(([, st]) => st === 1);
    for (const i of Object.values(ix.issuers)) {
      q.chain_only++;
      const inList = store.issuers.get(i.issuerId);
      if (!inList && everActive(i.history))
        add({ category: "chain_only", question: `kurum ${i.issuerId.slice(0, 12)}`, list: null, chain: i.status });
      const listed = new Set((inList?.schema_authorizations ?? []).filter((a) => a.allowed).map((a) => a.schema_id));
      for (const [schemaId, windows] of Object.entries(i.auth)) {
        q.chain_only++;
        if (windows.length && !listed.has(schemaId))
          add({
            category: "chain_only",
            question: `yetki ${i.issuerId.slice(0, 12)} ${schemaId.slice(0, 12)}`,
            list: null,
            chain: windows.length,
          });
      }
    }
    const rpIds = new Set([...store.relying_party_records.keys()].map((dns) => rpIdOf(dns)));
    for (const rp of Object.values(ix.rps)) {
      q.chain_only++;
      if (!rpIds.has(rp.rpId) && everActive(rp.history))
        add({ category: "chain_only", question: `doğrulayıcı ${rp.rpId.slice(0, 12)}`, list: null, chain: rp.status });
    }
    const groupIds = new Set(
      [...store.relying_party_records.values()].flatMap((m) =>
        [...m.values()].flatMap((r) => (r.terminal_groups ?? []).map((g) => groupIdOf(g.group_id))),
      ),
    );
    for (const rp of Object.values(ix.rps))
      for (const g of rp.groups) {
        q.chain_only++;
        if (!groupIds.has(g.groupId))
          add({ category: "chain_only", question: `kapı grubu ${g.groupId.slice(0, 12)}`, list: null, chain: true });
      }
    const listIds = new Set([...store.status_anchors.values()].map((a) => listIdOf(a.issuer_id, a.list_uri)));
    for (const l of Object.values(ix.lists)) {
      q.chain_only++;
      if (l.version > 0 && !listIds.has(l.listId))
        add({
          category: "chain_only",
          question: `iptal listesi ${l.listId.slice(0, 12)}`,
          list: null,
          chain: l.version,
        });
    }
    for (const r of Object.values(ix.records)) {
      if (r.kind !== NetKind.WALLET_PROVIDER_KEY) continue;
      q.chain_only++;
      const fp = bytes32ToFp(r.recordId);
      const c = chain.isWalletProviderKey(fp);
      if (c === "YES" && list.isWalletProviderKey(fp) !== "YES")
        add({ category: "chain_only", question: `cüzdan sağlayıcı anahtarı ${fp.slice(0, 16)}`, list: "NO", chain: c });
    }
    // ---- plan ↔ dizin kimlik kümeleri (plan verildiyse): zincirde plandan fazla ya da eksik kayıt yok
    if (opts.plan) {
      const planned = planIdSets(opts.plan);
      const indexed: Record<string, Set<string>> = {
        rootCAs: new Set(Object.keys(ix.rootCAs)),
        schemas: new Set(Object.keys(ix.schemas)),
        issuers: new Set(Object.keys(ix.issuers)),
        auth: new Set(
          Object.values(ix.issuers).flatMap((i) =>
            Object.entries(i.auth)
              .filter(([, w]) => w.length)
              .map(([sid]) => `${i.issuerId}|${sid}`),
          ),
        ),
        rps: new Set(Object.keys(ix.rps)),
        groups: new Set(Object.values(ix.rps).flatMap((rp) => rp.groups.map((g) => g.groupId))),
        lists: new Set(Object.keys(ix.lists)),
        records: new Set(Object.keys(ix.records)),
      };
      for (const [set, want] of Object.entries(planned)) {
        const got = indexed[set];
        q.plan_set++;
        const extra = [...got].filter((x) => !want.has(x));
        const missing = [...want].filter((x) => !got.has(x));
        if (extra.length || missing.length)
          add({
            category: "plan_set",
            question: set,
            list: { missing_on_chain: missing.map((x) => x.slice(0, 24)) },
            chain: { not_in_plan: extra.map((x) => x.slice(0, 24)) },
          });
      }
    }
  }

  const decision = diffs.filter((d) => ["C1", "C2", "C3", "D5", "chain_only"].includes(d.category));
  return {
    questions: q,
    answers,
    total: Object.values(q).reduce((a, b) => a + b, 0),
    differences: diffs,
    decisionDifferences: decision.length,
    unexpected: diffs.filter((d) => !d.known).length,
  };
}

/**
 * Planın yazdığı kayıtların kimlik kümeleri (dizinin kümeleriyle aynı anahtar biçiminde, küçük harf). Eski dönemlerin kapı grupları
 * dizinde yoktur (dizin yalnız güncel dönemin gruplarını okur); bu yüzden gruplar için yalnız doğrulayıcının SON dönemindeki
 * işlemler sayılır.
 */
export function planIdSets(plan: ReplayPlan): Record<string, Set<string>> {
  const out: Record<string, Set<string>> = {
    rootCAs: new Set(),
    schemas: new Set(),
    issuers: new Set(),
    auth: new Set(),
    rps: new Set(),
    groups: new Set(),
    lists: new Set(),
    records: new Set(),
  };
  const L = (x: string) => x.toLowerCase();
  const lastPeriod = new Map<string, number>();
  for (const o of plan.ops)
    if (o.op === "rpGroup" || o.op === "rpScope" || o.op === "rpProfile" || o.op === "rpPeriod")
      lastPeriod.set(L(o.rpId), Math.max(lastPeriod.get(L(o.rpId)) ?? 0, o.period));
  for (const o of plan.ops) {
    if (o.op === "registerRootCA") out.rootCAs.add(L(o.caId));
    else if (o.op === "registerSchema") out.schemas.add(L(o.schemaId));
    else if (o.op === "registerIssuer") out.issuers.add(L(o.issuerId));
    else if (o.op === "schemaAuth" && o.allowed) out.auth.add(`${L(o.issuerId)}|${L(o.schemaId)}`);
    else if (o.op === "registerRP") out.rps.add(L(o.rpId));
    else if (o.op === "rpGroup" && o.period === (lastPeriod.get(L(o.rpId)) ?? 0)) out.groups.add(L(o.group.groupId));
    else if (o.op === "registerList") out.lists.add(L(o.listId));
    else if (o.op === "networkRecord") out.records.add(`${o.record.kind}|${L(o.record.recordId)}`);
  }
  return out;
}

/**
 * Listede yeni bir kayıt döneminin başladığı anlar (ADR-0075): başka ülke listesindeki sonraki kayıt (devir) ve aynı kayıtta iptalden
 * sonra ACTIVE (yeniden kayıt).
 */
function periodStartsInList(records: RelyingParty[]): number[] {
  const out: number[] = [];
  records.forEach((r, k) => {
    const h = [...r.status_history].sort((a, b) => sec(a.since) - sec(b.since));
    if (k > 0) out.push(h.length ? sec(h[0].since) : sec(r.registered_at));
    for (let i = 1; i < h.length; i++)
      if (h[i].status === "ACTIVE" && (h[i - 1].status === "REVOKED" || h[i - 1].status === "RETIRED"))
        out.push(sec(h[i].since));
  });
  return out;
}
