/** ADR-0045 — AB PID mdoc kodlaması (CIR 2026/1731 §4.1, Tablo 6): ad tablosu, full-date etiketi, düz değer. */
import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import { pidMdocName, pidSdJwtName, PID_MDOC_TO_SDJWT } from "@tamga-network/core/pid";
import { CborTag, decode, encode } from "./cbor.js";
import { issueMdoc, verifyIssuerSigned } from "./mdoc.js";
import { plainElementValue, toPidMdocElements } from "./pid.js";

describe("AB PID ad tablosu (core/pid)", () => {
  it("SD-JWT ↔ mdoc: birthdate ↔ birth_date, nationalities ↔ nationality; tabloda olmayan ad aynı", () => {
    expect(pidMdocName("birthdate")).toBe("birth_date");
    expect(pidSdJwtName("birth_date")).toBe("birthdate");
    expect(pidMdocName("nationalities")).toBe("nationality");
    expect(pidSdJwtName("nationality")).toBe("nationalities");
    expect(pidMdocName("given_name")).toBe("given_name");
    expect(pidSdJwtName("age_over_18")).toBe("age_over_18");
    for (const [m, s] of Object.entries(PID_MDOC_TO_SDJWT)) expect(pidMdocName(s)).toBe(m);
  });
});

describe("toPidMdocElements / plainElementValue", () => {
  it("birthdate → birth_date #6.1004(tstr); nationalities → nationality dizisi; öteki claim'ler aynen", () => {
    const el = toPidMdocElements({
      given_name: "Ayşe",
      birthdate: "2002-05-14",
      nationalities: ["TR"],
      age_over_18: true,
    });
    expect(Object.keys(el).sort()).toEqual(["age_over_18", "birth_date", "given_name", "nationality"]);
    expect(el.birth_date).toBeInstanceOf(CborTag);
    expect((el.birth_date as CborTag).tag).toBe(1004);
    expect(el.nationality).toEqual(["TR"]);
    // CBOR: d9 03ec = tag 1004
    expect(Buffer.from(encode(el.birth_date)).toString("hex").startsWith("d903ec")).toBe(true);
    expect(plainElementValue(decode(encode(el.birth_date)))).toBe("2002-05-14");
    expect(plainElementValue(true)).toBe(true);
  });
  it("tarih biçimi YYYY-MM-DD değilse hata", () => {
    expect(() => toPidMdocElements({ birthdate: "14.05.2002" })).toThrow(/YYYY-MM-DD/);
  });
  it("imzalı mdoc'ta öğe değeri etiketli kalır, doğrulama geçer", () => {
    const issuerSk = p256.utils.randomSecretKey();
    const now = Math.floor(Date.now() / 1000);
    const issued = issueMdoc({
      docType: "urn:tamga:id:IdentityAttestation:1",
      namespaces: { "tamga.id.1": toPidMdocElements({ birthdate: "2002-05-14", nationalities: ["TR", "AZ"] }) },
      deviceKeyRaw: p256.getPublicKey(p256.utils.randomSecretKey(), false),
      issuerSk,
      x5chain: [new Uint8Array([0x30, 1, 2, 3])],
      signed: now,
      validFrom: now,
      validUntil: now + 60,
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    });
    const v = verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: p256.getPublicKey(issuerSk, false), now });
    expect(v.valid).toBe(true);
    const els = v.claims!["tamga.id.1"];
    expect(plainElementValue(els.birth_date)).toBe("2002-05-14");
    expect(els.nationality).toEqual(["TR", "AZ"]);
  });
});

describe("verifyIssuerSigned — saat farkı toleransı", () => {
  it("az önce verilmiş belge, saati birkaç saniye geride olan cüzdanda clockSkewSec ile geçerli; tolerans yoksa değil", () => {
    const issuerSk = p256.utils.randomSecretKey();
    const now = Math.floor(Date.now() / 1000);
    const issued = issueMdoc({
      docType: "urn:tamga:id:IdentityAttestation:1",
      namespaces: { "tamga.id.1": { age_over_18: true } },
      deviceKeyRaw: p256.getPublicKey(p256.utils.randomSecretKey(), false),
      issuerSk,
      x5chain: [new Uint8Array([0x30, 1, 2, 3])],
      signed: now,
      validFrom: now,
      validUntil: now + 60,
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    });
    const pub = p256.getPublicKey(issuerSk, false);
    expect(verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: pub, now: now - 2 }).reason).toBe(
      "document not yet valid",
    );
    expect(verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: pub, now: now - 2, clockSkewSec: 300 }).valid).toBe(
      true,
    );
    expect(verifyIssuerSigned(issued.issuerSigned, { issuerPubRaw: pub, now: now + 61 }).reason).toBe(
      "document expired",
    );
  });
});
