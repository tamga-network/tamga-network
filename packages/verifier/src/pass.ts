/**
 * Geçiş kartı — RP tarafı (ADR-0012 B; AP13): kabul edilen sunumdan holder anahtarı (cnf) alınır, RP `pass_grant` imzalar;
 * terminal jetonu çevrim dışı doğrular (grant'taki anahtar, aud, exp ≤ 60 s, jti tekrar listesi). Kişisel veri yok.
 */
import { SignJWT, compactVerify, decodeProtectedHeader, importJWK, type JWK } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RpSigner } from "./request.js";

export const PASS_TOKEN_TYP = "tamga-pass+jwt";
export const PASS_GRANT_TYP = "tamga-pass-grant+jwt";
export const PASS_TOKEN_MAX_TTL_SEC = 60;
/** Terminal ile telefon saati arasında izin verilen fark (sn) — gelecekten jeton bu kadarını aşamaz (AP13/WL12). */
export const PASS_TOKEN_CLOCK_SKEW_SEC = 30;

export interface PassPolicy {
  terminal_group: string;
  valid_days: number;
  /** ADR-0012 K4 (D10 bilet): ilk GEÇ kartı tüketir; sonraki her jeton DUR ("bilet kullanıldı"). */
  single_use?: boolean;
}
export interface PassRecord {
  passId: string;
  cnf: JWK;
  cnfKid: string;
  terminalGroup: string;
  validUntil: number;
  issuedAt: number;
  presentationId: string;
  singleUse?: boolean;
  consumedAt?: number;
}
export interface PassCheck {
  ok: boolean;
  reason?: string;
  passId?: string;
  terminalGroup?: string;
  expiresIn?: number;
  /** Tek kullanımlık kart bu okumada tüketildi (bilet: "giriş yapıldı"). */
  consumed?: boolean;
}

/** Sunumdaki SD-JWT'nin cnf.jwk'sı (holder anahtarı) ve JWK thumbprint (RFC 7638) — kişisel veri okunmaz. */
export function holderCnfOf(presentation: string): { jwk: JWK; kid: string } {
  const jwt = presentation.split("~")[0];
  const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")) as { cnf?: { jwk?: JWK } };
  const jwk = payload.cnf?.jwk;
  if (!jwk || jwk.kty !== "EC" || !jwk.x || !jwk.y) throw new Error("presentation has no cnf.jwk");
  const canon = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  return {
    jwk: { kty: "EC", crv: jwk.crv, x: jwk.x, y: jwk.y },
    kid: createHash("sha256").update(canon).digest("base64url"),
  };
}

export const PASS_KEY_TYP = "tamga-pass-key+jwt";
/** Kanıtın yaşı (cüzdan yanıtı anında üretir; istek ömrü 5 dk) */
const PASS_KEY_MAX_AGE_SEC = 600;
/**
 * a3/WL13: cüzdanın ayrı geçiş kartı anahtarı — başlıkta açık anahtar (P-256), gövdede aud = RP client_id ve isteğin nonce'u;
 * imza o anahtarla. Doğrulanırsa grant bu anahtara bağlanır (kart yenilemeleri belge anahtarını, dolayısıyla biyometri
 * istemini gerektirmez). Geçersiz kanıt kabul edilmez (hata; çağıran karta düşmeden sunumu yine kabul edebilir).
 */
export async function verifyPassKeyProof(
  jws: string,
  p: { clientId: string; nonce: string; now?: number },
): Promise<{ jwk: JWK; kid: string }> {
  const now = p.now ?? Math.floor(Date.now() / 1000);
  const h = decodeProtectedHeader(jws) as { typ?: string; alg?: string; jwk?: JWK };
  if (h.typ !== PASS_KEY_TYP || h.alg !== "ES256") throw new Error("pass_key: unexpected type");
  const j = h.jwk;
  if (!j || j.kty !== "EC" || j.crv !== "P-256" || typeof j.x !== "string" || typeof j.y !== "string" || "d" in j)
    throw new Error("pass_key: header key");
  const jwk: JWK = { kty: "EC", crv: "P-256", x: j.x, y: j.y };
  const { payload } = await compactVerify(jws, await importJWK(jwk, "ES256"));
  const body = JSON.parse(Buffer.from(payload).toString("utf8")) as { aud?: string; nonce?: string; iat?: number };
  if (body.aud !== p.clientId) throw new Error("pass_key: aud mismatch");
  if (body.nonce !== p.nonce) throw new Error("pass_key: nonce mismatch");
  if (typeof body.iat !== "number" || Math.abs(now - body.iat) > PASS_KEY_MAX_AGE_SEC) throw new Error("pass_key: iat");
  const canon = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  return { jwk, kid: createHash("sha256").update(canon).digest("base64url") };
}

export interface PassStoreData {
  records: PassRecord[];
  replay: Array<{ jti: string; exp: number }>;
}
export interface PassStore {
  load(): PassStoreData;
  save(data: PassStoreData): void;
}

/** Basit JSON dosya deposu (demo/pilot; üretimde veritabanı). Kişisel veri içermez: pass_id, cnf (holder anahtarı), grup, süreler. */
export function filePassStore(path: string): PassStore {
  return {
    load: () => {
      try {
        const j = JSON.parse(readFileSync(path, "utf8")) as Partial<PassStoreData> | PassRecord[];
        return Array.isArray(j) ? { records: j, replay: [] } : { records: j.records ?? [], replay: j.replay ?? [] };
      } catch {
        return { records: [], replay: [] };
      }
    },
    save: (data) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, JSON.stringify(data, null, 2));
    },
  };
}

export class PassRegistry {
  private grants = new Map<string, PassRecord>();
  private seenJti = new Map<string, number>(); // jti → exp
  /**
   * `audience`: geçiş kartı jetonunun `aud`'u — RP'nin kalıcı kimliği (listedeki `dns_name`; ADR-0034). Kart günlerce geçerli ve
   * QR ≤ 400 bayt; x509_hash hem uzun hem sertifika yenilenince değişir. Verilmezse imzacının client_id'si.
   */
  private audience: string;
  constructor(
    private signer: RpSigner,
    private store?: PassStore,
    audience?: string,
  ) {
    this.audience = audience ?? signer.clientId;
    const data = store?.load();
    for (const r of data?.records ?? []) this.grants.set(r.passId, r); // yeniden başlatmada kayıtlar kaybolmasın (cüzdandaki grant geçerli kalır)
    const now = Math.floor(Date.now() / 1000);
    for (const j of data?.replay ?? []) if (j.exp >= now) this.seenJti.set(j.jti, j.exp); // K3: tekrar listesi de korunur
  }
  private persist() {
    this.store?.save({
      records: [...this.grants.values()],
      replay: [...this.seenJti].map(([jti, exp]) => ({ jti, exp })),
    });
  }

  async issue(input: {
    presentation: string;
    presentationId: string;
    policy: PassPolicy;
    now?: number;
    /** a3/WL13: cüzdanın ayrı kart anahtarı kanıtı (yanıt yükü `pass_key`) — varsa kart bu anahtara bağlanır */
    passKey?: { jws: string; nonce: string };
  }): Promise<{ record: PassRecord; jws: string }> {
    const now = input.now ?? Math.floor(Date.now() / 1000);
    const { jwk, kid } = input.passKey
      ? await verifyPassKeyProof(input.passKey.jws, { clientId: this.signer.clientId, nonce: input.passKey.nonce, now })
      : holderCnfOf(input.presentation);
    const passId = "pass_" + randomBytes(9).toString("base64url");
    const validUntil = now + input.policy.valid_days * 86400;
    const jws = await new SignJWT({
      pass_id: passId,
      cnf_kid: kid,
      terminal_group: input.policy.terminal_group,
      aud: this.audience,
      ...(input.policy.single_use ? { single_use: true } : {}),
    })
      .setProtectedHeader({
        alg: "ES256",
        typ: PASS_GRANT_TYP,
        x5c: [Buffer.from(this.signer.leafDer).toString("base64")],
      })
      .setIssuedAt(now)
      .setExpirationTime(validUntil)
      .setIssuer(this.signer.clientId)
      .sign(this.signer.key);
    const record: PassRecord = {
      passId,
      cnf: jwk,
      cnfKid: kid,
      terminalGroup: input.policy.terminal_group,
      validUntil,
      issuedAt: now,
      presentationId: input.presentationId,
      ...(input.policy.single_use ? { singleUse: true } : {}),
    };
    this.grants.set(passId, record);
    this.persist();
    return { record, jws };
  }

  revoke(passId: string) {
    const ok = this.grants.delete(passId);
    if (ok) this.persist();
    return ok;
  }
  list() {
    return [...this.grants.values()];
  }

  /** AP13: terminal doğrulaması. Hata nedenleri kişisel veri içermez. */
  async verifyToken(
    token: string,
    opts: { terminalGroup: string; now?: number; maxClockSkewSec?: number },
  ): Promise<PassCheck> {
    const now = opts.now ?? Math.floor(Date.now() / 1000);
    const skew = opts.maxClockSkewSec ?? PASS_TOKEN_CLOCK_SKEW_SEC;
    let header: { typ?: string; alg?: string; kid?: string };
    try {
      header = decodeProtectedHeader(token) as typeof header;
    } catch {
      return { ok: false, reason: "token unreadable" };
    }
    if (header.typ !== PASS_TOKEN_TYP || header.alg !== "ES256") return { ok: false, reason: "unexpected token type" };
    let payload: { iss?: string; aud?: string; iat?: number; exp?: number; jti?: string };
    try {
      payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    } catch {
      return { ok: false, reason: "token body malformed" };
    }
    const rec = payload.iss ? this.grants.get(payload.iss) : undefined;
    if (!rec) return { ok: false, reason: "no pass registration (registration required)" };
    if (rec.terminalGroup !== opts.terminalGroup) return { ok: false, reason: "not for this terminal group" };
    if (payload.aud !== this.audience) return { ok: false, reason: "aud mismatch" };
    if (header.kid !== rec.cnfKid) return { ok: false, reason: "key id mismatch" };
    if (
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      payload.exp - payload.iat > PASS_TOKEN_MAX_TTL_SEC
    )
      return { ok: false, reason: "invalid time fields" };
    // AP13/WL12: ileri tarihli jeton (saat kayması dışında) önceden üretilip saklanabilirdi → reddedilir
    if (payload.iat > now + skew || payload.exp > now + PASS_TOKEN_MAX_TTL_SEC + skew)
      return { ok: false, reason: "token issued in the future (check the phone clock)" };
    if (now > payload.exp) return { ok: false, reason: "token expired (show again)" };
    if (now > rec.validUntil) return { ok: false, reason: "pass registration expired" };
    if (!payload.jti) return { ok: false, reason: "jti missing" };
    try {
      const key = await importJWK(rec.cnf, "ES256");
      await compactVerify(token, key);
    } catch {
      return { ok: false, reason: "signature could not be verified" };
    }
    // Tüketim ve tekrar denetimi imzadan SONRA ve arada `await` olmadan: aynı jeton/bilet iki kapıda eşzamanlı okunursa
    // yalnızca biri geçer (denetim ile işaretleme arasında başka istek araya giremez)
    if (rec.consumedAt) return { ok: false, reason: "ticket already used (single entry)", passId: rec.passId };
    for (const [j, e] of this.seenJti) if (e < now) this.seenJti.delete(j);
    if (this.seenJti.has(payload.jti)) return { ok: false, reason: "replay (jti already used)" };
    this.seenJti.set(payload.jti, payload.exp);
    if (rec.singleUse) rec.consumedAt = now; // K4: ilk GEÇ kartı tüketir; kapılar arası ortak (aynı kayıt)
    this.persist();
    return {
      ok: true,
      passId: rec.passId,
      terminalGroup: rec.terminalGroup,
      expiresIn: payload.exp - now,
      ...(rec.singleUse ? { consumed: true } : {}),
    };
  }
}
