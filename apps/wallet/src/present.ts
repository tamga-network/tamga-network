/**
 * Sunum akışı (D4) — SPEC-PROTO-0002 / SPEC-WALLET-0001 §5: istek nesnesi → RP kaydı (PV2) → alan alan onay + aşırı talep
 * uyarısı (WL8) → PIN/biyometri (WL11) → yapışkan kopya (WL5) → KB-JWT + JWE → response_uri; sunum günlüğü cihazda (WL4/PV8).
 */
import {
  fetchHttp,
  parseVpUri,
  fetchRequestObject,
  verifyRequestObject,
  parseDcApiRequest,
  fetchRpRecord,
  fetchRegistrarKeys,
  checkRegistrationCerts,
  matchDcql,
  checkRp,
  stableRpKey,
  respond,
  selectCopy,
  markCopyUsed,
  type VpRequest,
  type Match,
  type RpCheck,
  type WalletState,
  parsePassGrant,
  planCopy,
  type CopyPlan,
  pseudonymQueryOf,
  activePseudonyms,
  choosePseudonymIndex,
  presentPseudonym,
  recordPseudonymUse,
  clientAttestationPop,
  PSEUDONYM_FORMAT,
  type PseudonymEntry,
} from "@tamga-network/wallet-core";
import { keys, walletStore, randomBytes, seedVault } from "./platform";
import { ensureWua, type Trace } from "./wallet";
import { TRUST_PINS } from "./trust-anchor";
import { t } from "@/i18n";

const DEFAULT_TRUST_BASE = "https://trust.tamga.network";
export const isVpQr = (data: string) => data.startsWith("openid4vp://") || /[?&]request_uri=/.test(data);

export interface ReviewModel {
  request: VpRequest;
  /** İstenen belge; yalnız takma adla girişte (ADR-0031) yok. */
  match: Match | null;
  rp: RpCheck;
  values: Record<string, unknown>;
  copyRef: string | null;
  /** D7: kopya planı — sticky/fresh ya da tükendi (yenile / yeniden kullan seçeneği). Belge yoksa null. */
  plan: CopyPlan | null;
  /**
   * ADR-0031: site takma ad istiyor. `active`: bu sitedeki etkin takma adlar; `choice`: kullanılacak sıra ya da "new" (çok kipte
   * kullanıcı seçer). Takma ad değeri onay ekranında gösterilmez (yalnız "bu siteye özel takma ad" ve kullanıcının verdiği ad).
   */
  pseudonym?: {
    queryId: string;
    mode: "single" | "multiple";
    active: PseudonymEntry[];
    choice: number | "new";
    hasSeed: boolean;
  };
}
/** Belgesiz (yalnız takma ad) istekte RP denetimi için boş eşleşme — kapsam alanı yok, fazla istek yok. */
const NO_DOC = { queryId: "", credential: { vct: PSEUDONYM_FORMAT }, requested: [], missing: [] } as unknown as Match;

export async function scanToReview(state: WalletState, qr: string, trace: Trace): Promise<ReviewModel> {
  const uri = parseVpUri(qr);
  trace.push({ t: Date.now(), step: "Presentation request QR decoded", detail: uri.requestUri });
  const jwt = await fetchRequestObject(uri.requestUri, fetchHttp);
  const request = verifyRequestObject(jwt, uri.clientId);
  trace.push({
    t: Date.now(),
    step: "Request object verified (signature, x5c, profile PV1/PV3/PV6)",
    detail: `${request.clientId} · nonce ${request.nonce.slice(0, 8)}…`,
  });
  return requestToReview(state, request, trace);
}

/**
 * Tarayıcının Digital Credentials API isteği (P4-4; OpenID4VP 1.0 Ek A): işletim sistemi cüzdanı `{protocol, data}` ve çağıran
 * sayfanın kökeniyle açar. Aynı denetimler (güven listesi, kayıt sertifikası, fazla istek) ve aynı onay ekranı; yanıt POST
 * edilmez, `sendPresentation` onu `dcApiResponse` olarak döndürür ve yerel modül tarayıcıya iletir.
 */
export async function dcApiToReview(
  state: WalletState,
  req: { protocol?: unknown; data?: unknown },
  origin: string,
  trace: Trace,
): Promise<ReviewModel> {
  const request = parseDcApiRequest(req, origin);
  trace.push({
    t: Date.now(),
    step: "Browser request verified (Digital Credentials API; signature, x5c, expected_origins)",
    detail: `${request.clientId} · origin ${origin}`,
  });
  return requestToReview(state, request, trace);
}

async function requestToReview(state: WalletState, request: VpRequest, trace: Trace): Promise<ReviewModel> {
  const { matches, unmatched } = matchDcql(request.dcql, state.credentials);
  const pq = pseudonymQueryOf(request.dcql);
  // Belge sorgusu karşılanamadıysa dur; yalnız takma ad isteyen (belgesiz) istek geçerli
  if (unmatched.length || (!matches.length && !pq)) throw new Error(t("pres.noMatch", { ids: unmatched.join(", ") }));
  const match = matches[0] ?? null;
  // S-13: RP kaydı imzası doğrulanmış listeden; sabitlenmiş LOTL imzacısı
  const rpRecord = await fetchRpRecord(
    state.settings.trustBase ?? DEFAULT_TRUST_BASE,
    request.clientId,
    fetchHttp,
    TRUST_PINS,
  );
  // ADR-0017 K7: aracı doğrulayıcı üzerinden gelen istekte asıl RP'nin kaydı da çözülür; kayıtsızsa istek reddedilir (HV6)
  const onBehalf = request.onBehalfOf
    ? await fetchRpRecord(state.settings.trustBase ?? DEFAULT_TRUST_BASE, request.onBehalfOf, fetchHttp, TRUST_PINS)
    : undefined;
  if (request.onBehalfOf && !onBehalf) throw new Error(t("pres.unknownOnBehalf"));
  const rp = checkRp(rpRecord, request, match ?? NO_DOC, Date.now(), onBehalf);
  // ADR-0034: kopya ayrımı ve takma ad kaydın kalıcı alan adına göre (x509_hash sertifika yenilenince değişir)
  request = { ...request, rpKey: stableRpKey(request, rpRecord, onBehalf) };
  // ADR-0031: takma ad yalnız güven listesinde kayıtlı siteye (kişiyi tanıyan kalıcı bir değer)
  if (pq && !rp.registered) throw new Error(t("pres.pseudonymUnregistered"));
  if (rp.impersonation) throw new Error(t("pres.impersonation"));
  // ADR-0026 K5: kayıt sertifikası (verifier_info) varsa kayıt kurumu imzası, süre ve erişim sertifikasıyla bağ denetlenir (WRC4)
  if (match && (request.payload as { verifier_info?: unknown }).verifier_info) {
    const registrarKeys = await fetchRegistrarKeys(
      state.settings.trustBase ?? DEFAULT_TRUST_BASE,
      fetchHttp,
      TRUST_PINS,
    );
    const reg = checkRegistrationCerts(request, registrarKeys, match);
    if (!reg.valid) throw new Error(t("pres.badRegistrationCert"));
    if (reg.present) {
      rp.registrationCert = true;
      if (reg.allowedClaims) {
        rp.certClaims = reg.allowedClaims;
        // iki kaynak çelişirse daha kısıtlayıcı olan: sertifikada olmayan alan da fazla istek
        rp.overAsk = [...new Set([...rp.overAsk, ...match.requested.filter((c) => !reg.allowedClaims!.includes(c))])];
      }
      trace.push({
        t: Date.now(),
        step: "Registration certificate verified (registrar signature, validity, access certificate binding)",
        detail: reg.allowedClaims
          ? `registered fields: ${reg.allowedClaims.join(", ")}`
          : "no entry for this credential",
      });
    }
  }
  trace.push({
    t: Date.now(),
    step: rp.registered
      ? `Verifier in the trusted list: ${rp.legalName}${rp.via ? ` (via: ${rp.via})` : ""} (${rp.active ? "ACTIVE" : "inactive"}; certificate ${rp.certMatches ? "matched" : "MISMATCH"})`
      : "Verifier NOT FOUND in the trusted list (PV2 warning)",
    detail: rp.overAsk.length ? `outside scope: ${rp.overAsk.join(", ")}` : "requested fields within scope",
  });
  const values: Record<string, unknown> = {};
  if (match) for (const n of match.requested) values[n] = match.credential.claims[n];
  const plan = match ? planCopy(match.credential, request.rpKey) : null; // WL5: kopya asıl RP'ye göre
  let pseudonym: ReviewModel["pseudonym"];
  if (pq) {
    const active = activePseudonyms(state, request.rpKey);
    const picked = choosePseudonymIndex(state, request.rpKey, pq.mode);
    pseudonym = {
      queryId: pq.id,
      mode: pq.mode,
      active,
      choice: picked.isNew ? "new" : picked.index,
      hasSeed: !!(await seedVault.get()),
    };
    trace.push({
      t: Date.now(),
      step: "Site asks for its own pseudonym (ADR-0031)",
      detail: picked.isNew ? "new pseudonym for this site" : "existing pseudonym for this site",
    });
  }
  return {
    request,
    match,
    rp,
    values,
    copyRef: plan && plan.kind !== "exhausted" ? plan.keyRef : null,
    plan,
    ...(pseudonym ? { pseudonym } : {}),
  };
}

/** ADR-0031 çok kip: kullanıcı mevcut bir takma adı ya da yenisini seçer. */
export const choosePseudonym = (m: ReviewModel, choice: number | "new"): ReviewModel =>
  m.pseudonym ? { ...m, pseudonym: { ...m.pseudonym, choice } } : m;

/**
 * ARF OIA_11: aynı türden birden çok belge sorguyu karşılıyorsa kullanıcı seçer. Seçilen belgeyle eşleşme, gösterilecek
 * değerler, kapsam dışı alanlar ve kopya planı yeniden hesaplanır (RP kaydı değişmez).
 */
export function chooseAlternative(m: ReviewModel, credentialId: string): ReviewModel {
  if (!m.match) return m;
  const alts = m.match.alternatives ?? [m.match];
  const picked = alts.find((a) => a.credential.id === credentialId);
  if (!picked) return m;
  const match = { ...picked, alternatives: m.match.alternatives };
  const values: Record<string, unknown> = {};
  for (const n of match.requested) values[n] = match.credential.claims[n];
  const overAsk = m.rp.registered
    ? match.requested.filter((c) => !m.rp.scopeClaims.includes(c) || (m.rp.certClaims && !m.rp.certClaims.includes(c)))
    : match.requested;
  const plan = planCopy(match.credential, m.request.rpKey);
  return {
    ...m,
    match,
    values,
    rp: { ...m.rp, overAsk },
    copyRef: plan.kind === "exhausted" ? null : plan.keyRef,
    plan,
  };
}

/** ARF DASH_02: tamamlanamayan sunum da günlüğe girer (değer yok). */
export async function logFailedPresentation(state: WalletState, m: ReviewModel): Promise<WalletState> {
  const next: WalletState = {
    ...state,
    presentationLog: [
      ...state.presentationLog,
      {
        ts: Date.now(),
        clientId: m.request.rpKey,
        vct: m.match?.credential.vct ?? PSEUDONYM_FORMAT,
        requested: m.match ? [...m.match.requested, ...m.match.missing] : [],
        disclosed: [],
        outcome: "error",
      },
    ],
  };
  await walletStore.save(next);
  return next;
}

export async function sendPresentation(
  state: WalletState,
  m: ReviewModel,
  trace: Trace,
  opts: { reuseKeyRef?: string } = {},
): Promise<{
  state: WalletState;
  redirectUri?: string;
  passGranted?: boolean;
  showUrl?: string;
  dcApiResponse?: { response: string };
}> {
  // D7 (b): kullanıcı tükenme ekranında "eski bir kopyayı kullan" dediyse o kopya (korelasyon uyarısı gösterildi)
  const match = m.match;
  const copy = !match
    ? null
    : opts.reuseKeyRef
      ? (match.credential.copies.find((k) => k.keyRef === opts.reuseKeyRef) ?? null)
      : selectCopy(match.credential, m.request.rpKey);
  if (match && !copy) throw new Error(t("pres.copiesUsed"));
  // ADR-0031: takma ad — tohum güvenli depodan (kullanıcı onayından sonra), bu işlem için yeni WIA (iptal edilmemiş cüzdan);
  // anahtar yalnız bellekte türetilir ve imzadan sonra silinir. Takma ad değeri günlüğe yazılmaz.
  let ps: { queryId: string; jwt: string; index: number; pseudonym: string } | undefined;
  if (m.pseudonym) {
    const seed = await seedVault.get();
    if (!seed) throw new Error(t("pres.noSeed"));
    const { index } = choosePseudonymIndex(state, m.request.rpKey, m.pseudonym.mode, m.pseudonym.choice);
    const w = await ensureWua(state);
    if (!w.state.wua) throw new Error(t("iss.wuaFailed", { error: w.error ?? "" }));
    state = w.state;
    const wiaPop = await clientAttestationPop({ keys, wua: w.state.wua, aud: m.request.clientId, randomBytes });
    const made = presentPseudonym({
      seed,
      rpKey: m.request.rpKey,
      index,
      aud: m.request.clientId,
      nonce: m.request.nonce,
      wia: w.state.wua.jwt,
      wiaPop,
    });
    ps = { queryId: m.pseudonym.queryId, jwt: made.jwt, index, pseudonym: made.pseudonym };
  }
  const out = await respond({
    request: m.request,
    matches: match && copy ? [{ match, keyRef: copy.keyRef, combined: copy.combined, disclose: match.requested }] : [],
    ...(ps ? { pseudonym: { queryId: ps.queryId, jwt: ps.jwt } } : {}),
    keys,
    http: fetchHttp,
    randomBytes,
  });
  trace.push({
    t: Date.now(),
    step: `Presentation sent: ${match?.requested.length ?? 0} fields disclosed${ps ? " + site pseudonym" : ""}, JWE ECDH-ES/${m.request.enc}`,
    detail: copy ? `copy ${copy.keyRef}` : undefined,
  });
  let next = match && copy ? markCopyUsed(state, match.credential.id, copy.keyRef, m.request.rpKey) : state;
  if (ps)
    next = recordPseudonymUse(next, {
      rpKey: m.request.rpKey,
      index: ps.index,
      pseudonym: ps.pseudonym,
      siteName: m.rp.tradeName ?? m.rp.legalName ?? m.request.rpKey,
    });
  next = {
    ...next,
    presentationLog: [
      ...next.presentationLog,
      {
        ts: Date.now(),
        clientId: m.request.rpKey,
        vct: match?.credential.vct ?? PSEUDONYM_FORMAT,
        requested: match ? [...match.requested, ...match.missing] : [],
        disclosed: match?.requested ?? [],
        outcome: "sent",
      },
    ],
  };
  await walletStore.save(next);
  // ADR-0012 B: kayıtlı RP geçiş kartı verdiyse sakla (WL13: süreli, kapsamlı rıza — bu sunumun onayı)
  let passGranted = false;
  if (out.passGrant && match && copy) {
    try {
      const grant = parsePassGrant(out.passGrant, {
        rpClientId: m.request.rpKey,
        rpName: m.rp.legalName ?? m.request.rpKey,
        credentialId: match.credential.id,
        keyRef: copy.keyRef,
      });
      // Kart anahtarı = terminal grubu (aynı doğrulayıcı kampüs + etkinlik gibi birden çok grup işletebilir)
      next = {
        ...next,
        passes: [...(next.passes ?? []).filter((g) => g.terminalGroup !== grant.terminalGroup), grant],
      };
      passGranted = true;
      trace.push({
        t: Date.now(),
        step: "Access pass received (pass_grant)",
        detail: `${grant.terminalGroup} · until ${new Date(grant.validUntil * 1000).toISOString().slice(0, 10)}`,
      });
    } catch (e) {
      trace.push({ t: Date.now(), step: "Access pass unreadable", detail: (e as Error).message });
    }
  }
  return {
    state: next,
    redirectUri: out.redirectUri,
    passGranted,
    showUrl: out.showUrl,
    dcApiResponse: out.dcApiResponse,
  };
}
export async function declinePresentation(state: WalletState, m: ReviewModel): Promise<WalletState> {
  const next = {
    ...state,
    presentationLog: [
      ...state.presentationLog,
      {
        ts: Date.now(),
        clientId: m.request.rpKey,
        vct: m.match?.credential.vct ?? PSEUDONYM_FORMAT,
        disclosed: [],
        outcome: "declined" as const,
      },
    ],
  };
  await walletStore.save(next);
  return next;
}
