/** ADR-0046: gömülü açıklama politikasının JSON Şeması ve kapsamı (yalnız kurum belgeleri). */
import { describe, it, expect } from "vitest";
import _Ajv2020 from "ajv/dist/2020.js";
import _addFormats from "ajv-formats";
import {
  EMBEDDED_DISCLOSURE_POLICY_SCHEMA,
  acceptsDisclosurePolicy,
  validateDisclosurePolicy,
  IDENTITY,
  ZK_COPY_VCT,
  DRIVING_LICENCE,
  EMAIL,
  PHONE,
  DIPLOMA,
  STUDENT,
  TICKET,
} from "./index.js";

type Ctor = new (o: object) => { compile(s: object): ((d: unknown) => boolean) & { errors?: unknown } };
const Ajv2020 = (_Ajv2020 as unknown as { default?: Ctor }).default ?? (_Ajv2020 as unknown as Ctor);
const addFormats = ((_addFormats as unknown as { default?: unknown }).default ?? _addFormats) as (a: unknown) => void;
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const check = ajv.compile(EMBEDDED_DISCLOSURE_POLICY_SCHEMA);

const samples: Array<[unknown, boolean]> = [
  [{ id: "urn:x:p:1", type: "none" }, true],
  [{ id: "https://u.example/p", type: "authorized_relying_parties", relying_parties: [{ rp_id: "VATTR-1" }] }, true],
  [{ id: "https://u.example/p", type: "authorized_relying_parties", entitlements: ["https://uri.etsi.org/x"] }, true],
  [
    {
      id: "urn:x:p:2",
      type: "specific_roots_of_trust",
      roots_of_trust: [{ issuer_dn: "CN=Root,C=TR", serial_number: "0a" }],
    },
    true,
  ],
  [{ id: "urn:x:p:3", type: "authorized_relying_parties" }, false],
  [{ id: "urn:x:p:4", type: "specific_roots_of_trust" }, false],
  [{ id: "urn:x:p:5", type: "other" }, false],
  [{ type: "none" }, false],
  [{ id: "urn:x:p:6", type: "none", info_uri: "http://u.example/p" }, false],
];

describe("EMBEDDED_DISCLOSURE_POLICY_SCHEMA", () => {
  it.each(samples.map(([s, ok], i) => [i, s, ok] as const))(
    "örnek %i şema ve doğrulayıcıda aynı sonuç",
    (_i, s, ok) => {
      expect(check(s)).toBe(ok);
      expect(validateDisclosurePolicy(s).ok).toBe(ok);
    },
  );
});

describe("acceptsDisclosurePolicy (ADR-0046 K1)", () => {
  it("kurum belgeleri evet; kimlik, ZK kopyası, sürücü belgesi bilgisi, iletişim hayır", () => {
    for (const d of [DIPLOMA, STUDENT, TICKET]) expect(acceptsDisclosurePolicy(d.vct)).toBe(true);
    for (const v of [IDENTITY.vct, ZK_COPY_VCT, DRIVING_LICENCE.vct, EMAIL.vct, PHONE.vct])
      expect(acceptsDisclosurePolicy(v)).toBe(false);
  });
});
