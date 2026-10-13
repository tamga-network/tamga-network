// İptal listesi (Token Status List) @tamga-network/sd-jwt'e taşındı; genel API aynı kalsın diye buradan da dışa aktarılır
export {
  STATUS_TYP,
  BITS,
  MIN_CAPACITY,
  MAX_FILL,
  StatusValue,
  StatusBitstring,
  IndexAllocator,
  newListId,
  signStatusListToken,
  verifyStatusListToken,
  // 0.6.0 (ADR-0048): tür başına bit sayısı ve mdoc kopyaları için CWT gösterimi
  STATUS_BITS,
  STATUS_LIST_CWT_TYP,
  signStatusListCwt,
  verifyStatusListCwt,
  verifyStatusListAny,
  type StatusBits,
  type StatusListCwtInput,
  type StatusListTokenInput,
  type VerifiedStatusToken,
} from "@tamga-network/sd-jwt";
// ADR-0048 K2: türde askı izni (şemanın `suspension_allowed`'ı) — Kurum Konsolu ve kurumun kendi servisi buna uyar
export { suspensionAllowed } from "@tamga-network/schemas";
export * from "./oid4vci.js";
export * from "./factory.js";
// Cüzdan kanıtı (WIA; -07 istemci kanıtı) doğrulaması @tamga-network/trust'a taşındı; buradan da dışa aktarılır
export {
  WIA_MAX_TTL_SEC,
  WUA_TYP,
  WUA_POP_TYP,
  KEY_STORAGE_RANK,
  isKeyStorage,
  POP_MAX_AGE_SEC,
  verifyWalletAttestation,
  stricterKeyStorage,
  type KeyStorage,
  type ClientStatusPolicy,
  type WuaClaims,
  type WuaResult,
} from "@tamga-network/trust";
export * from "./authcode.js";
export * from "./dpop.js";
export * from "./key-attestation.js";
// ADR-0046: gömülü açıklama politikası — biçim denetimi, özet (belge kaydı; EP4 iptali) ve kapsam
export {
  EMBEDDED_DISCLOSURE_POLICY_MEMBER,
  DISCLOSURE_POLICY_TYPES,
  validateDisclosurePolicy,
  disclosurePolicyDigest,
  acceptsDisclosurePolicy,
  restrictsDisclosure,
  type EmbeddedDisclosurePolicy,
  type DisclosurePolicyType,
} from "@tamga-network/schemas";
