/**
 * Kanonik doğrulama hattı — SPEC-API-0001 §1 (T0 + A–E), üç değerli sonuç (§2), AP1–AP12.
 *  T0  güven kaynağı tazeliği (liste/indeksleyici; CMP4/BT5 → INDETERMINATE)
 *  A   format (SPEC-CRED-0002 A1–A8: @tamga-network/sd-jwt verifySdJwtVc; A3b issuerId parmak izinden, A3d cnf, A6 KB-JWT)
 *      — mso_mdoc (D-CRED-5): mdoc-format.ts aynı A kodlarıyla (A6 = cihaz imzası); B–E iki format için ORTAK
 *  B   şema (B1 vct, B2 kayıt, B3 metadata önbellek, B4 content_hash = vct#integrity, B6 JSON Schema; B5 atlanır)
 *  C   güven (C1/C2 iat-zamanlı, C3 tanıma, C4 kategori ↔ kayıt sınıfı — ADR-0010)
 *  D   iptal (D1 status claim, D2 ön çekim önbelleği, D3 imza+sub+iss, D4 tazelik, D5 çapa, D6 bit)
 *  E   politika (E1 assurance/kategori, E2 gerekli claim'ler + kısıtlar, E3 RP scope, E4 denetim kaydı — red için de)
 *  Z1  sıfır bilgi ispatı (mso_mdoc_zk — ADR-0032; mdoc-zk-format.ts): devre imzalı listede, yalnız istenen öğeler, ispat geçerli
 *  P1  site başına takma ad (ADR-0031 PS5; ayrı vp_token girdisi — pseudonym.ts `verifyPseudonym`)
 * Sonuç nesnesi claim DEĞERİ taşımaz (AP3), idx taşımaz (AP4); değerler ayrı alanda çağırana verilir.
 */
import type { TrustSource, RelyingParty } from "@tamga-network/trust";
import type { Policy } from "./policy.js";
import type { StatusCache } from "./status-cache.js";
import { stepA, stepB, stepC, stepD, stepE, stepT0, type StepFail, type VerifyCtx } from "./steps.js";

export type Step =
  | "T0"
  | "A1"
  | "A2"
  | "A3"
  | "A3b"
  | "A3c"
  | "A3d"
  | "A4"
  | "A5"
  | "A6"
  | "A7"
  | "A8"
  | "B1"
  | "B2"
  | "B3"
  | "B4"
  | "B5"
  | "B6"
  | "C1"
  | "C2"
  | "C3"
  | "C4"
  | "D1"
  | "D2"
  | "D3"
  | "D4"
  | "D5"
  | "D6"
  | "E1"
  | "E2"
  | "E3"
  | "E4"
  | "P1"
  | "Z1";
export type Outcome = "ACCEPTED" | "REJECTED" | "INDETERMINATE";
export type IndeterminateReason =
  | "SCHEMA_UNREACHABLE"
  | "STATUS_UNREACHABLE"
  | "STATUS_STALE"
  | "CHAIN_UNREACHABLE"
  | "INDEXER_STALE"
  | "SDK_VERSION_MISMATCH";

export interface VerificationResult {
  verification_id: string;
  outcome: Outcome;
  failed_step: Step | null;
  failed_reason: string | null;
  indeterminate_reason: IndeterminateReason | null;
  spec_version: string;
  sdk_version: string;
  checks_performed: Step[];
  checks_skipped: Step[];
  issuer: {
    issuer_id: string;
    state_code: string;
    category?: string;
    assurance?: string;
    class?: string;
    legal_name?: string;
  } | null;
  schema: { schema_id: string; vct: string; status?: string } | null;
  disclosed_claims: string[];
  status: {
    value: "VALID" | "INVALID" | "SUSPENDED" | "NOT_APPLICABLE" | "UNKNOWN";
    list_version: number | null;
    token_age_sec: number | null;
    /** Neden (ör. NOT_APPLICABLE: ZK sunumunda iptal indeksi yok — ADR-0032 ZK4). Kişisel veri yok. */
    reason?: string;
  };
  freshness: { trust_source: "list" | "chain"; trust_version: number; trust_age_sec: number };
  evaluated_at: string;
}
export interface VerifyInput {
  presentation: string; // SD-JWT: "<jwt>~d…~<kb>" · mso_mdoc: base64url(DeviceResponse)
  /** D-CRED-5: sunum formatı (varsayılan dc+sd-jwt). mso_mdoc için `responseUri` zorunlu (SessionTranscript). */
  format?: "dc+sd-jwt" | "mso_mdoc" | "mso_mdoc_zk";
  /** mso_mdoc_zk: ZK doğrulama arka ucu (varsayılan: paketle gelen WASM — @tamga-network/verifier/zk). */
  zk?: import("./zk/backend.js").ZkBackend;
  responseUri?: string;
  /** Digital Credentials API ile gelen sunum: sayfanın kökeni (mdoc SessionTranscript'i DC API biçiminde; responseUri gerekmez). */
  origin?: string;
  /** mso_mdoc: yanıt şifreliyse şifreleme anahtarının RFC 7638 parmak izi (SessionTranscript'e girer). */
  encJwkThumbprint?: Uint8Array;
  aud: string;
  nonce: string; // KB-JWT bağlaması (client_id tam dize — PV7)
  policy: Policy;
  policyCredentialId: string;
  trust: TrustSource;
  statusCache: StatusCache;
  rootCertsDer: Uint8Array[];
  rp?: RelyingParty | null; // E3 (kendi kaydımız)
  /**
   * Yalnız yerel geliştirme: `iss` yerel/IP adresiyse kayıtlı `issuer_url` ile tutarlılık denetimi atlanır (LAN'da adresler farklı).
   * Varsayılan kapalı; canlı (https) doğrulayıcı açmaz.
   */
  allowLocalIssuerUrls?: boolean;
  now?: number;
  verificationId?: string;
  audit?: (entry: {
    verification_id: string;
    outcome: Outcome;
    failed_step: Step | null;
    issuer_id?: string;
    vct?: string;
    disclosed: string[];
    ts: number;
  }) => void;
}
export interface VerifyOutput {
  result: VerificationResult;
  claims: Record<string, unknown> | null;
} // claims: AP3 — ayrı kanal

export const SPEC_VERSION = "SPEC-API-0001@1.0.0"; // spec sürüm notuyla birlikte güncellenir
export const SDK_VERSION = "@tamga-network/verifier@0.4.0"; // packages/verifier/package.json sürümüyle aynı (verifier.test.ts denetler)
const ALL_STEPS: Step[] = [
  "T0",
  "A1",
  "A2",
  "A3",
  "A3b",
  "A3c",
  "A3d",
  "A4",
  "A5",
  "A6",
  "A7",
  "A8",
  "Z1",
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
  "B6",
  "C1",
  "C2",
  "C3",
  "C4",
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "E1",
  "E2",
  "E3",
  "E4",
];

/** Güven kaynağı tazeliği; sorgu istisna atarsa "sağlıksız" (T0 → DOĞRULANAMADI, AP2). */
function freshnessOf(trust: TrustSource): ReturnType<TrustSource["freshness"]> {
  try {
    return trust.freshness();
  } catch {
    return { source: "list", version: 0, ageSec: 0, healthy: false };
  }
}

/**
 * Yönetici: adımları spec sırasıyla çalıştırır (steps.ts), ilk başarısızlıkta durur. Her sonuç — kabul, red, doğrulanamadı —
 * E4 denetim kaydına düşer (AP9; değer/idx yok — AP3/AP4). Onaylanan claim değerleri yalnızca ACCEPTED'da, ayrı alanda (AP3).
 */
export async function verifyPresentation(input: VerifyInput): Promise<VerifyOutput> {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const ctx: VerifyCtx = {
    input,
    now,
    fr: freshnessOf(input.trust),
    done: [],
    skipped: [],
    issuerInfo: null,
    schemaInfo: null,
    disclosed: [],
    claims: null,
    status: { value: "UNKNOWN", list_version: null, token_age_sec: null },
  };
  const vid = input.verificationId ?? `vrf_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  // Beklenmeyen istisna (kütüphane hatası, bozuk güven kaydı …) RED değildir ve denetim kaydını atlamaz: DOĞRULANAMADI + E4.
  // Neden metnine istisna iletisi konmaz (kişisel veri içerebilir — AP3); yalnız adım ve hata türü.
  const steps: Array<
    [Step, IndeterminateReason, (c: VerifyCtx) => StepFail | undefined | Promise<StepFail | undefined>]
  > = [
    ["T0", "INDEXER_STALE", stepT0],
    ["A1", "CHAIN_UNREACHABLE", stepA],
    ["B1", "SCHEMA_UNREACHABLE", stepB],
    ["C1", "INDEXER_STALE", stepC],
    ["D1", "STATUS_UNREACHABLE", stepD],
    ["E1", "INDEXER_STALE", stepE],
  ];
  for (const [code, why, step] of steps) {
    let fail: StepFail | undefined;
    try {
      fail = await step(ctx);
    } catch (e) {
      const kind = e instanceof Error ? e.name : typeof e;
      return finish(ctx, vid, "INDETERMINATE", code, `internal error during step ${code[0]} (${kind})`, why);
    }
    if (fail)
      return fail.kind === "reject"
        ? finish(ctx, vid, "REJECTED", fail.step, fail.reason, null)
        : finish(ctx, vid, "INDETERMINATE", fail.step, fail.reason, fail.why);
  }
  return finish(ctx, vid, "ACCEPTED", null, null, null);
}

function finish(
  ctx: VerifyCtx,
  vid: string,
  outcome: Outcome,
  failed: Step | null,
  reason: string | null,
  ind: IndeterminateReason | null,
): VerifyOutput {
  const { input, now, done, skipped, fr } = ctx;
  done.push("E4");
  input.audit?.({
    verification_id: vid,
    outcome,
    failed_step: failed,
    issuer_id: ctx.issuerInfo?.issuer_id,
    vct: ctx.schemaInfo?.vct,
    disclosed: ctx.disclosed,
    ts: now,
  }); // AP9: red için de; AP3/AP4: değer/idx yok
  return {
    result: {
      verification_id: vid,
      spec_version: SPEC_VERSION,
      sdk_version: SDK_VERSION,
      checks_performed: [...done],
      checks_skipped: [...skipped, ...ALL_STEPS.filter((s) => !done.includes(s) && !skipped.includes(s) && s !== "E4")],
      issuer: ctx.issuerInfo,
      schema: ctx.schemaInfo,
      disclosed_claims: ctx.disclosed,
      status: ctx.status,
      freshness: { trust_source: fr.source, trust_version: fr.version, trust_age_sec: fr.ageSec },
      evaluated_at: new Date(now * 1000).toISOString(),
      outcome,
      failed_step: failed,
      failed_reason: reason,
      indeterminate_reason: ind,
    },
    claims: outcome === "ACCEPTED" ? ctx.claims : null,
  };
}
