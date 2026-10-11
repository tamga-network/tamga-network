/**
 * ADR-0046 — gömülü açıklama politikasının JSON Şeması (ETSI TS 119 472-3 §4.2.5.2 veri modeli; üye adları ADR-0046 K1) ve
 * politikanın konabileceği türler. Biçim denetimi ve özet `@tamga-network/core/disclosure-policy`'de (bağımlılıksız; cüzdan da
 * kullanır); burada yeniden dışa aktarılır.
 */
import { DISCLOSURE_POLICY_TYPES } from "@tamga-network/core/disclosure-policy";
import { CATALOGUE_BASE } from "./definitions.js";

export {
  DISCLOSURE_POLICY_TYPES,
  EMBEDDED_DISCLOSURE_POLICY_MEMBER,
  validateDisclosurePolicy,
  disclosurePolicyDigest,
  restrictsDisclosure,
  type DisclosurePolicyType,
  type EmbeddedDisclosurePolicy,
  type AuthorizedRelyingParty,
  type RootOfTrust,
  type DisclosurePolicyValidation,
} from "@tamga-network/core/disclosure-policy";

const nonEmpty = (items: Record<string, unknown>) => ({ type: "array", minItems: 1, maxItems: 100, items });

/**
 * JSON Şeması (2020-12). Bilinmeyen üyelere izin verilir (ETSI -10/-11: uzantılar yok sayılır). Koşullar: tür
 * `authorized_relying_parties` ise `relying_parties` / `subject_dns` / `entitlements`'tan en az biri; `specific_roots_of_trust` ise
 * `roots_of_trust`. Şemanın yakalayamadığı ayrıntı (RFC 4514 ad ayrıştırması) `validateDisclosurePolicy`'dedir.
 */
export const EMBEDDED_DISCLOSURE_POLICY_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: `${CATALOGUE_BASE}/metadata/embedded-disclosure-policy/1.0.0/schema.json`,
  title: "EmbeddedDisclosurePolicy",
  description:
    "Embedded disclosure policy carried by value in the signed Credential Issuer metadata (credential_metadata.embedded_disclosure_policy; ADR-0046, ETSI TS 119 472-3 §4.2.5.2).",
  type: "object",
  required: ["id", "type"],
  properties: {
    id: { type: "string", format: "uri", maxLength: 2048 },
    type: { enum: [...DISCLOSURE_POLICY_TYPES] },
    relying_parties: nonEmpty({
      type: "object",
      required: ["rp_id"],
      properties: {
        rp_id: { type: "string", minLength: 1, maxLength: 256 },
        service_id: { type: "string", minLength: 1, maxLength: 256 },
      },
    }),
    subject_dns: nonEmpty({ type: "string", minLength: 3, maxLength: 1024 }),
    entitlements: nonEmpty({ type: "string", format: "uri", maxLength: 2048 }),
    roots_of_trust: nonEmpty({
      type: "object",
      required: ["issuer_dn", "serial_number"],
      properties: {
        issuer_dn: { type: "string", minLength: 3, maxLength: 1024 },
        serial_number: { type: "string", pattern: "^(0x)?[0-9a-fA-F]{1,64}$" },
      },
    }),
    info_uri: { type: "string", format: "uri", pattern: "^https://", maxLength: 2048 },
    authority: { type: "string", minLength: 1, maxLength: 1024 },
    description: { type: "string", minLength: 1, maxLength: 4096 },
  },
  allOf: [
    {
      if: { properties: { type: { const: "authorized_relying_parties" } } },
      then: {
        anyOf: [{ required: ["relying_parties"] }, { required: ["subject_dns"] }, { required: ["entitlements"] }],
      },
    },
    {
      if: { properties: { type: { const: "specific_roots_of_trust" } } },
      then: { required: ["roots_of_trust"] },
    },
  ],
} as const;

/**
 * ADR-0046 K1 kapsamı: politika yalnız kurum belgelerinde (EAA). Tamga kimlik belgesi, ZK kopyası, sürücü belgesi bilgisi ve takma
 * ad tohumu (`urn:tamga:id:*`), iletişim belgeleri (`urn:tamga:contact:*`) ve kök tip politika taşımaz.
 */
export function acceptsDisclosurePolicy(vct: string): boolean {
  return !/^urn:tamga:(id|contact|core):/.test(vct);
}
