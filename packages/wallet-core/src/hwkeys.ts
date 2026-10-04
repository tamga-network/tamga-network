/**
 * Donanım anahtarı sağlayıcısı (P4 / ARF WUA_16a, SPEC-WALLET-0001 WL1/WL3/WL11/WL13). Yerel arka uç (iOS Secure Enclave, Android
 * StrongBox/TEE — uygulamanın `TamgaKeys` modülü) varsa YENİ anahtarlar orada üretilir; yoksa yazılım anahtarı (sapma S-9).
 * Arka uçta bulunmayan eski anahtarlar yazılım deposundan kullanılmaya devam eder (geçiş kodu yok; ADR-0029).
 * Anahtar politikası (proje yönetimi 2026-10-04, a3): `user_auth` belge anahtarları yalnız kilit açıkken ve biyometri / cihaz
 * parolasından sonra kısa bir pencere içinde kullanılır; `device_unlocked` protokol anahtarları (birim, WIA, DPoP, geçiş kartı)
 * yalnız kilit açıkken, istemsiz. `authenticate()` pencereyi tek istemle açar (sunum onayı = anahtar kullanım istemi). Pencere
 * kapanmışsa etkileşimli `sign()` bir kez yeniden sorar (zayıf biyometri anahtarı açmadıysa bir kez de cihaz parolasıyla);
 * `interactive: false` ile istem çıkmaz, `auth_required` döner (kişinin başlatmadığı akışlar sessizce atlar).
 * Köprüdeki ikili veri standart base64; imza ham r||s.
 */
import { b64, b64Decode, b64u } from "./b64.js";
import {
  AUTH_REQUIRED,
  KEY_INVALIDATED,
  type GenerateOptions,
  type KeyAttestation,
  type KeyPolicy,
  type KeyProvider,
  type KeyStorage,
  type PublicJwk,
  type SignOptions,
} from "./keys.js";

export type HardwareStorage = "secure_enclave" | "strongbox" | "tee" | "software" | "none";
/** Anahtar kullanımını koruyan cihaz doğrulaması: güçlü biyometri; yoksa cihaz parolası; kilit kurulmamışsa yok (a3). */
export type DeviceUserAuth = "biometric" | "passcode" | "none";
/** Yerel arka ucun "kullanım penceresi kapalı" hata kodu (Android `UserNotAuthenticatedException`; iOS istemsiz kipte). */
export const ERR_USER_NOT_AUTHENTICATED = "ERR_USER_NOT_AUTHENTICATED";
/** Yerel arka ucun "telefonda ekran kilidi yok" hata kodu — anahtar üretilemez (ARF WIAM_15a; uygulama kilit kurmayı ister). */
export const ERR_DEVICE_LOCK_REQUIRED = "ERR_DEVICE_LOCK_REQUIRED";
/** Yerel arka ucun "anahtar kalıcı geçersiz" hata kodu (kilit kaldırıldı / değişti; biyometri yeniden kaydı) → `key_invalidated`. */
export const ERR_KEY_INVALIDATED = "ERR_KEY_INVALIDATED";
/** Yerel arka ucun "kişi imza anındaki sistem istemini iptal etti" hata kodu (iOS) — yeniden istem gösterilmez. */
export const ERR_USER_CANCELED = "ERR_USER_CANCELED";
/** a3: kullanım penceresi (yerel modüllerle aynı, 60 sn) — bu süre içinde başarılı doğrulama "yeni" sayılır */
const AUTH_WINDOW_MS = 60_000;

export interface NativeKeyBackend {
  info(): Promise<{ storage: HardwareStorage; platform: string; userAuth?: DeviceUserAuth }>;
  /** `policy` yoksa `user_auth` (eski arka uçlar üçüncü parametreyi yok sayar) */
  generate(
    ref: string,
    challenge: string | null,
    policy?: KeyPolicy,
  ): Promise<{ x: string; y: string; storage: HardwareStorage; attestation?: string[] }>;
  publicKey(ref: string): Promise<{ x: string; y: string } | null>;
  /** `interactive === false`: sistem istemi gösterilmez; doğrulama gerekiyorsa ERR_USER_NOT_AUTHENTICATED (iOS interactionNotAllowed) */
  sign(ref: string, dataB64: string, interactive?: boolean): Promise<string>;
  delete(ref: string): Promise<void>;
  /** iOS App Attest (P4-2): yeni App Attest anahtarı + kanıt; clientDataHash base64 (SHA-256) */
  appAttest?(clientDataHashB64: string): Promise<{ key_id: string; attestation: string }>;
  /**
   * a3: cihaz doğrulaması — güçlü biyometri ya da cihaz parolası, TEK istem; pencereyi açar. `false` = kişi vazgeçti.
   * `credentialOnly`: yalnız cihaz parolası (zayıf biyometri anahtarı açmadıysa, Android < 30). Kilit yoksa ERR_DEVICE_LOCK_REQUIRED.
   */
  authenticate?(reason: string, cancelLabel?: string, credentialOnly?: boolean): Promise<boolean>;
  /** a2 Android Play Integrity (standart API) jetonu; `requestHash` = sağlayıcının meydan okuması. Zorunlu değil. */
  playIntegrityToken?(requestHash: string, cloudProjectNumber: string): Promise<string>;
}

const jwkOf = (p: { x: string; y: string }): PublicJwk => ({
  kty: "EC",
  crv: "P-256",
  x: b64u(b64Decode(p.x)),
  y: b64u(b64Decode(p.y)),
});
const storageOf = (s: HardwareStorage): KeyStorage =>
  s === "secure_enclave" || s === "strongbox" || s === "tee" ? s : "software";
const hasCode = (e: unknown, c: string) =>
  (e as { code?: unknown } | null)?.code === c || String((e as Error | null)?.message ?? "").includes(c);
const isNotAuthenticated = (e: unknown) => hasCode(e, ERR_USER_NOT_AUTHENTICATED);
/** Kişi sistemin anahtar kullanım istemini iptal etti (iOS: imza anında sistem sorar) — yeniden SORULMAZ. */
const isUserCanceled = (e: unknown) => hasCode(e, ERR_USER_CANCELED);
/** Yerel hata → wallet-core kodu: kalıcı geçersiz anahtar `key_invalidated` (uygulama sade ileti + yeniden alma yönlendirmesi). */
const mapNative = (e: unknown) =>
  hasCode(e, ERR_KEY_INVALIDATED)
    ? Object.assign(new Error("hardware key permanently invalidated"), { code: KEY_INVALIDATED, cause: e })
    : e;
const authRequired = (cause: unknown) =>
  Object.assign(new Error("key use requires device authentication"), { code: AUTH_REQUIRED, cause });

export class HardwareKeyProvider implements KeyProvider {
  private info: Promise<{ storage: HardwareStorage; platform: string; userAuth?: DeviceUserAuth } | null>;
  /** Android anahtar kanıtı zincirleri (ref → DER base64[]); cüzdan sağlayıcıya kanıt olarak gider */
  private evidence = new Map<string, string[]>();
  /** son başarılı cihaz doğrulaması (ms); pencere içindeyken imza yine açılmıyorsa doğrulama anahtarı açmamıştır */
  private lastAuthOk = 0;

  constructor(
    private native: NativeKeyBackend | null,
    private software: KeyProvider,
    private opts: {
      platform: string;
      /** a3: pencere kapalıyken `sign()` yeniden sorarsa istemde görünecek metin (kullanıcının dilinde; uygulama verir) */
      authReason?: () => string;
      /** istemin vazgeç düğmesi (Android < 30 biyometri istemi zorunlu kılar) */
      cancelLabel?: () => string;
    },
  ) {
    this.info = native ? native.info().catch(() => null) : Promise.resolve(null);
  }

  private async backend(): Promise<NativeKeyBackend | null> {
    const i = await this.info;
    return i && i.storage !== "none" ? this.native : null;
  }

  async generate(ref: string, challenge?: Uint8Array, o?: GenerateOptions): Promise<PublicJwk> {
    const n = await this.backend();
    if (!n) return this.software.generate(ref);
    const r = await n.generate(ref, challenge ? b64(challenge) : null, o?.policy ?? "user_auth");
    if (r.attestation?.length) this.evidence.set(ref, r.attestation);
    return jwkOf(r);
  }

  async publicKey(ref: string): Promise<PublicJwk | null> {
    const n = await this.backend();
    const p = n ? await n.publicKey(ref) : null;
    return p ? jwkOf(p) : this.software.publicKey(ref);
  }

  async sign(ref: string, data: Uint8Array, o?: SignOptions): Promise<Uint8Array> {
    const n = await this.backend();
    if (!n || !(await n.publicKey(ref))) return this.software.sign(ref, data);
    const payload = b64(data);
    const interactive = o?.interactive !== false;
    const once = async () => {
      try {
        return b64Decode(await n.sign(ref, payload, interactive));
      } catch (e) {
        throw mapNative(e);
      }
    };
    try {
      return await once();
    } catch (e) {
      // kişi sistemin istemini iptal etti (iOS): ikinci istem yok
      if (isUserCanceled(e) || !isNotAuthenticated(e)) throw e;
      // kişinin başlatmadığı akış: istem yok → çağıran sessizce atlar, kullanıcı eyleminde yeniden dener
      if (!interactive || !n.authenticate) throw authRequired(e);
      const reason = this.opts.authReason?.() ?? "";
      const cancel = this.opts.cancelLabel?.();
      // Az önce doğrulama geçtiği hâlde anahtar açılmadıysa (Android < 30 zayıf biyometri) doğrudan cihaz parolası sorulur —
      // aynı istemi tekrarlamak işe yaramaz. Pencere yalnız kapandıysa olağan tek istem. Her durumda en çok bir yeni istem
      // (+ zayıf biyometri yolunda bir parola istemi); kişi vazgeçerse (false) yeniden sorulmaz.
      const recentlyOk = Date.now() - this.lastAuthOk < AUTH_WINDOW_MS;
      const ask = async (credentialOnly: boolean) => {
        const ok = await n.authenticate!(reason, cancel, credentialOnly);
        if (ok) this.lastAuthOk = Date.now();
        return ok;
      };
      if (!(await ask(recentlyOk))) throw e;
      try {
        return await once();
      } catch (e2) {
        if (recentlyOk || isUserCanceled(e2) || !isNotAuthenticated(e2) || !(await ask(true))) throw e2;
        return once();
      }
    }
  }

  async delete(ref: string): Promise<void> {
    const n = await this.backend();
    if (n) await n.delete(ref).catch(() => undefined);
    this.evidence.delete(ref);
    await this.software.delete(ref);
  }

  async attestation(): Promise<KeyAttestation> {
    const i = await this.info;
    if (!i || i.storage === "none") return this.software.attestation();
    const storage = storageOf(i.storage);
    return { storage, level: storage === "tee" ? "W2" : "W3", platform: this.opts.platform };
  }

  /** Android anahtar kanıtı (varsa): cüzdan sağlayıcı doğrular ve anahtar kanıtında (KA) seviyeyi belirler. */
  keyEvidence(ref: string): string[] | undefined {
    return this.evidence.get(ref);
  }

  /**
   * a3 / WL11: donanım anahtarları için cihaz doğrulaması — biyometri ya da cihaz parolası, TEK istem; sonrasında anahtarlar
   * pencere boyunca sormadan kullanılır. `null` = donanım arka ucu ya da doğrulama işlevi yok (Expo Go, S-9): uygulama kendi
   * PIN/biyometri onayına döner. `false` = kişi vazgeçti.
   */
  async authenticate(reason: string): Promise<boolean | null> {
    const n = await this.backend();
    if (!n?.authenticate) return null;
    const ok = await n.authenticate(reason, this.opts.cancelLabel?.(), false);
    if (ok) this.lastAuthOk = Date.now();
    return ok;
  }

  /** a3: arka ucun bildirdiği cihaz doğrulama türü (bilgi; "Cüzdan bilgisi" ekranı). Donanım yoksa `undefined`. */
  async userAuth(): Promise<DeviceUserAuth | undefined> {
    const i = await this.info;
    return i && i.storage !== "none" ? (i.userAuth ?? "none") : undefined;
  }

  /**
   * Kişinin başlatmadığı akışlar için görünüm (sessiz yenileme, kart yenilemesi): imza istem çıkarmaz; doğrulama gerekiyorsa
   * `auth_required` (`isAuthRequired`) — akış atlar. Üretim, silme ve okuma aynıdır.
   */
  quiet(): KeyProvider {
    return {
      generate: (ref, challenge, o) => this.generate(ref, challenge, o),
      publicKey: (ref) => this.publicKey(ref),
      sign: (ref, data) => this.sign(ref, data, { interactive: false }),
      delete: (ref) => this.delete(ref),
      attestation: () => this.attestation(),
    };
  }
}
