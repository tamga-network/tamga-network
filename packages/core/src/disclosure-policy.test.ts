/** ADR-0046 K1: gömülü açıklama politikası — biçim denetimi, özet, RFC 4514 ad karşılaştırması. */
import { describe, it, expect } from "vitest";
import {
  validateDisclosurePolicy,
  disclosurePolicyDigest,
  restrictsDisclosure,
  parseDn,
  dnEquals,
  serialEquals,
} from "./disclosure-policy.js";

const ARP = {
  id: "https://university.example/policy/diploma-1",
  type: "authorized_relying_parties",
  relying_parties: [{ rp_id: "VATTR-1234567890", service_id: "hiring" }],
  info_uri: "https://university.example/policy/diploma",
};

describe("validateDisclosurePolicy", () => {
  it("üç tür ve ADR-0046 K1 üyeleri kabul edilir", () => {
    expect(validateDisclosurePolicy(ARP)).toEqual({ ok: true, policy: ARP });
    expect(validateDisclosurePolicy({ id: "urn:x:policy:1", type: "none" }).ok).toBe(true);
    const sr = {
      id: "urn:x:policy:2",
      type: "specific_roots_of_trust",
      roots_of_trust: [{ issuer_dn: "CN=Root CA,O=Example,C=TR", serial_number: "0a1b" }],
    };
    expect(validateDisclosurePolicy(sr)).toEqual({ ok: true, policy: sr });
    const mixed = {
      id: "urn:x:policy:3",
      type: "authorized_relying_parties",
      subject_dns: ["ORGID=VATTR-1,O=Example Ltd,C=TR"],
      entitlements: ["https://uri.etsi.org/19475/Entitlement/Service_Provider"],
      authority: "Example authority",
      description: "Only hiring services",
    };
    expect(validateDisclosurePolicy(mixed)).toEqual({ ok: true, policy: mixed });
  });

  it("bilinmeyen üyeler ve türe ait olmayan listeler atılır (ETSI -10/-11)", () => {
    const v = validateDisclosurePolicy({ ...ARP, extensions: { attribute_level: true }, roots_of_trust: [] });
    // boş roots_of_trust bir hatadır (liste boş olamaz)
    expect(v.ok).toBe(false);
    const w = validateDisclosurePolicy({ ...ARP, extensions: { x: 1 } });
    expect(w.ok && w.policy).toEqual(ARP);
  });

  it("bozuk politikalar reddedilir", () => {
    const bad = (x: unknown) => validateDisclosurePolicy(x).ok;
    expect(bad(null)).toBe(false);
    expect(bad({ ...ARP, id: "not a uri" })).toBe(false);
    expect(bad({ ...ARP, type: "block_everyone" })).toBe(false);
    expect(bad({ id: "urn:a:b", type: "authorized_relying_parties" })).toBe(false); // eşleşme listesi yok
    expect(bad({ id: "urn:a:b", type: "specific_roots_of_trust" })).toBe(false);
    expect(bad({ ...ARP, relying_parties: [{ service_id: "x" }] })).toBe(false);
    expect(bad({ ...ARP, subject_dns: ["no equals sign"] })).toBe(false);
    expect(bad({ ...ARP, subject_dns: ["FOO=bar"] })).toBe(false); // bilinmeyen tür adı
    expect(bad({ ...ARP, info_uri: "http://insecure.example/p" })).toBe(false);
    expect(
      bad({
        id: "urn:a:b",
        type: "specific_roots_of_trust",
        roots_of_trust: [{ issuer_dn: "CN=R", serial_number: "xyz" }],
      }),
    ).toBe(false);
  });
});

describe("disclosurePolicyDigest (EP4)", () => {
  it("üye sırası ve uzantılar özeti değiştirmez; içerik değişince değişir; politika yoksa null", () => {
    const d = disclosurePolicyDigest(ARP as never)!;
    expect(d).toMatch(/^sha256:[0-9a-f]{64}$/);
    const reordered = { info_uri: ARP.info_uri, relying_parties: ARP.relying_parties, type: ARP.type, id: ARP.id };
    expect(disclosurePolicyDigest(reordered as never)).toBe(d);
    expect(disclosurePolicyDigest({ ...ARP, ext: 1 } as never)).toBe(d);
    expect(disclosurePolicyDigest({ ...ARP, relying_parties: [{ rp_id: "VATTR-1234567890" }] } as never)).not.toBe(d);
    expect(disclosurePolicyDigest(undefined)).toBeNull();
  });
  it("restrictsDisclosure: none ve politika yok kısıt değildir", () => {
    expect(restrictsDisclosure({ id: "urn:a:b", type: "none" })).toBe(false);
    expect(restrictsDisclosure(undefined)).toBe(false);
    expect(restrictsDisclosure(ARP as never)).toBe(true);
  });
});

describe("RFC 4514 ayırt edici ad", () => {
  it("tür adları OID'e çevrilir, ORGID ve SN (ETSI Not 2), kaçışlar çözülür", () => {
    expect(parseDn("ORGID=VATTR-1,O=Example\\, Ltd,C=TR")).toEqual([
      { oid: "2.5.4.97", value: "vattr-1" },
      { oid: "2.5.4.10", value: "example, ltd" },
      { oid: "2.5.4.6", value: "tr" },
    ]);
    expect(parseDn("SN=TINTR-1+CN=Ayşe")).toEqual([
      { oid: "2.5.4.5", value: "tintr-1" },
      { oid: "2.5.4.3", value: "ayşe" },
    ]);
    expect(parseDn("CN=caf\\C3\\A9")).toEqual([{ oid: "2.5.4.3", value: "café" }]);
    expect(parseDn("2.5.4.97=VATTR-1")).toEqual([{ oid: "2.5.4.97", value: "vattr-1" }]);
  });
  it("eşitlik: sıra, büyük-küçük harf ve boşluk farkı gözetilmez; eksik/fazla öznitelik eşleşmez", () => {
    expect(dnEquals("ORGID=VATTR-1,O=Example Ltd,C=TR", "c=tr, o=example  ltd, organizationIdentifier=vattr-1")).toBe(
      true,
    );
    expect(dnEquals("ORGID=VATTR-1,O=Example Ltd,C=TR", "ORGID=VATTR-1,O=Example Ltd")).toBe(false);
    expect(dnEquals("ORGID=VATTR-1,C=TR", "ORGID=VATTR-2,C=TR")).toBe(false);
    expect(dnEquals("not a dn", "not a dn")).toBe(false);
  });
  it("seri numarası: 0x ve baştaki sıfırlar gözetilmez", () => {
    expect(serialEquals("0x00ab", "AB")).toBe(true);
    expect(serialEquals("ab", "ac")).toBe(false);
  });
});
