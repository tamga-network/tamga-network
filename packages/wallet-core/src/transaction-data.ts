/**
 * OpenID4VP 1.0 §5.1 / §8.4 / Ek B.3.3 — işlem verisi (`transaction_data`; ADR-0091, ARF R36).
 *
 * Doğrulayıcı isteğe "neyi onaylıyorsun" bilgisini koyar (ör. ödeme onayı, nitelikli imza); cüzdan bunu kişiye gösterir ve KB-JWT'ye
 * özetlerini (`transaction_data_hashes`) yazarak imzalar. Kurallar:
 *  - Her öğe base64url kodlu JSON nesnesi; `type` (dizgi) ve `credential_ids` (boş olmayan dizi, DCQL `credentials[].id`) zorunlu.
 *  - Cüzdan TANIMADIĞI tek bir tür bile varsa isteği reddeder (§5.1). Ağ bir tür tanımlamaz: tanınan türler çağıranın verdiği
 *    listedir (`supportedTypes`; varsayılan BOŞ → işlem verisi taşıyan her istek reddedilir — alanı yok saymak yasaktır, §5).
 *  - Bağlama yalnız SD-JWT VC için tanımlı ve kriptografik sahip bağı gerekir (Ek B.3.3): başvurulan sorgu `dc+sd-jwt` olmalı,
 *    `require_cryptographic_holder_binding: false` olamaz.
 *  - `transaction_data_hashes_alg` verilmişse `sha-256` içermeli (desteklenen tek algoritma).
 *  - Hata kodu `invalid_transaction_data` (§8.5).
 *  - Sunumdan önce kişiye gösterilip onaylanmış olmalı: `respond` yalnız `confirmTransactionData(onay, öğeler)` ile aynı öğeler
 *    onaylandıysa imzalar (gösterilmemiş bir şeyi imzalamak işlem verisinin bütün anlamını boşa çıkarır). Bir tür eklenirken türün
 *    kural belgesi "ekranda gösterilmeyen alan varsa reddet" kuralını taşımalıdır (imzalanan, öğenin tamamıdır).
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { b64u, b64uDecode, utf8, utf8Decode } from "./b64.js";
import { WalletError } from "./http.js";

export interface TransactionDataItem {
  /** İstekte geldiği gibi (özet bunun üzerinden alınır; base64url çözülmeden — Ek B.3.3.1) */
  raw: string;
  type: string;
  credentialIds: string[];
  /** İstek `transaction_data_hashes_alg` verdiyse true: KB-JWT de `transaction_data_hashes_alg` taşır */
  hashesAlgRequested: boolean;
  /** Çözülmüş nesnenin tamamı (gösterim için; tür kuralına göre yorumlanır) */
  data: Record<string, unknown>;
}

interface DcqlRef {
  id: string;
  format: string;
  require_cryptographic_holder_binding?: boolean;
}

const bad = (m: string) => new WalletError("invalid_transaction_data", m);
/** Boyut sınırları (kötü niyetli ya da hatalı istekte ayrıştırma ve ekran maliyeti) */
const MAX_ITEMS = 10;
const MAX_ITEM_LEN = 8192;
const MAX_TYPE_LEN = 256;

/** İstekteki `transaction_data`'yı denetler; yoksa `undefined`. Kurala uymayan, tanınmayan ya da bağlanamayan öğe → hata. */
export function parseTransactionData(
  raw: unknown,
  credentials: readonly DcqlRef[],
  supportedTypes: readonly string[] = [],
): TransactionDataItem[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length === 0) throw bad("transaction_data must be a non-empty array");
  if (raw.length > MAX_ITEMS) throw bad("too many transaction_data items");
  if (new Set(raw).size !== raw.length) throw bad("duplicate transaction_data item");
  const byId = new Map(credentials.map((c) => [c.id, c]));
  return raw.map((s): TransactionDataItem => {
    if (typeof s !== "string" || !/^[A-Za-z0-9_-]+$/.test(s)) throw bad("transaction_data item is not base64url");
    if (s.length > MAX_ITEM_LEN) throw bad("transaction_data item too large");
    let data: unknown;
    try {
      data = JSON.parse(utf8Decode(b64uDecode(s)));
    } catch {
      throw bad("transaction_data item is not a JSON object");
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw bad("transaction_data item is not a JSON object");
    const o = data as Record<string, unknown>;
    if (typeof o.type !== "string" || !o.type || o.type.length > MAX_TYPE_LEN)
      throw bad("transaction_data type missing");
    if (!supportedTypes.includes(o.type)) throw bad("unsupported transaction_data type");
    const ids = o.credential_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 3 || ids.some((x) => typeof x !== "string"))
      throw bad("transaction_data credential_ids must be a non-empty array of strings");
    for (const id of ids as string[]) {
      const q = byId.get(id);
      if (!q) throw bad("transaction_data credential_ids does not match the request");
      if (q.format !== "dc+sd-jwt") throw bad("transaction_data is bound only to SD-JWT VC credentials");
      if (q.require_cryptographic_holder_binding === false)
        throw bad("transaction_data requires cryptographic holder binding");
    }
    const alg = o.transaction_data_hashes_alg;
    if (alg !== undefined && (!Array.isArray(alg) || !alg.includes("sha-256")))
      throw bad("transaction_data_hashes_alg does not offer sha-256");
    return { raw: s, type: o.type, credentialIds: ids as string[], hashesAlgRequested: alg !== undefined, data: o };
  });
}

/** Ek B.3.3.1: KB-JWT `transaction_data_hashes` öğesi — gelen dizginin SHA-256'sı, base64url. */
export const transactionDataHash = (raw: string): string => b64u(sha256(utf8(raw)));

/** Bir DCQL sorgusuna (`queryId`) bağlanan öğeler. */
export const transactionDataFor = (items: readonly TransactionDataItem[] | undefined, queryId: string) =>
  (items ?? []).filter((t) => t.credentialIds.includes(queryId));
