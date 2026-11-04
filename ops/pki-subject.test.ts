/**
 * pki-issue konu alanı (2026-11-04 güvenlik turu O1) ve gerçek ağ onay kapısı (O5): CSR konusu ASN.1 ad yapısından okunur, metinle
 * öznitelik eklenemez; --prod'da --org-id zorunlu ve CSR'dakiyle birebir; iki organizationIdentifier RED.
 */
import { describe, it, expect } from "vitest";
import { Name } from "@peculiar/x509";
import { buildSubject, prodConfirmProblem, resolveSubject, subjectFields, SubjectError } from "./pki-subject.js";

const ORG = "VATTR-1234567890";
const csr = (n: string | ConstructorParameters<typeof Name>[0]) => new Name(n as string);

describe("pki-issue konu alanı (O1)", () => {
  it("izin verilen alanlar birer kez; konu bu alanlardan yeniden kurulur", () => {
    const r = resolveSubject({
      name: "issuer-yeni",
      prod: true,
      csrName: csr(`CN=Yeni, O=Yeni Üniversitesi, 2.5.4.97=${ORG}, C=TR`),
      orgId: ORG,
    });
    expect(r.fields).toEqual({ CN: "Yeni", O: "Yeni Üniversitesi", orgId: ORG, C: "TR", OU: undefined });
    expect(new Name(r.subject).getField("2.5.4.97")).toEqual([ORG]);
  });

  it("iki organizationIdentifier, bilinmeyen öznitelik ve çok değerli RDN RED", () => {
    expect(() => subjectFields(csr(`CN=A, 2.5.4.97=VATTR-9, O=B, 2.5.4.97=${ORG}, C=TR`))).toThrow(/birden fazla/);
    expect(() => subjectFields(csr("CN=A, E=a@b.c, O=B, C=TR"))).toThrow(SubjectError);
    expect(() => subjectFields(csr([{ CN: ["a"], O: ["b"] }, { C: ["TR"] }]))).toThrow(/çok değerli RDN/);
  });

  it("değerdeki kaçışlı virgül öznitelik eklemez (metin birleştirme yok)", () => {
    // CN değeri ", 2.5.4.97=VATTR-…" içerir: eski metin/regex okuması bunu kurum kimlik numarası sanıyordu
    const n = csr([{ CN: [`x, 2.5.4.97=${ORG}`] }, { O: ["Saldırgan"] }, { C: ["TR"] }]);
    expect(n.getField("2.5.4.97")).toEqual([]);
    const r = resolveSubject({ name: "issuer-yeni", prod: false, csrName: n });
    expect(r.fields.orgId).toBeUndefined();
    expect(new Name(r.subject).getField("2.5.4.97")).toEqual([]);
    expect(new Name(r.subject).getField("CN")).toEqual([`x, 2.5.4.97=${ORG}`]);
    // gerçek ağda --org-id zorunlu: CSR'daki sahte metin yerine operatörün değeri
    expect(() => resolveSubject({ name: "issuer-yeni", prod: true, csrName: n })).toThrow(/--org-id .*zorunlu/);
  });

  it("--prod: --org-id zorunlu (issuer-* ve rp-*), CSR'daki ve --subject'teki değerle birebir", () => {
    const n = csr(`CN=shop.example, O=Shop, 2.5.4.97=${ORG}, C=TR`);
    expect(() => resolveSubject({ name: "rp-shop", prod: true, csrName: n })).toThrow(/rp-\*.*--org-id/);
    expect(() => resolveSubject({ name: "rp-shop", prod: true, csrName: n, orgId: "VATTR-1111111111" })).toThrow(
      /CSR konu alanındaki organizationIdentifier/,
    );
    expect(() =>
      resolveSubject({
        name: "rp-shop",
        prod: true,
        csrName: n,
        subjectArg: "CN=shop.example, O=Shop, 2.5.4.97=VATTR-2, C=TR",
        orgId: ORG,
      }),
    ).toThrow(/--subject konu alanındaki/);
    const ok = resolveSubject({
      name: "rp-shop",
      prod: true,
      csrName: csr("CN=shop.example, O=Shop, C=TR"),
      orgId: ORG,
    });
    expect(ok.fields.orgId).toBe(ORG);
    expect(() => resolveSubject({ name: "rp-shop", prod: false, csrName: n, orgId: "VAT-1" })).toThrow(
      /--org-id: VATTR/,
    );
  });

  it("kurum sertifikasında O ve C; --service-id OU'ya, konu alanında OU varsa RED", () => {
    expect(() => resolveSubject({ name: "issuer-yeni", prod: false, subjectArg: "CN=Yeni, C=TR" })).toThrow(
      /O \(resmî ad\) ve C/,
    );
    expect(() => resolveSubject({ name: "issuer-yeni", prod: false, subjectArg: "CN=Yeni, O=Y, C=tr" })).toThrow(
      /C: iki/,
    );
    const r = resolveSubject({
      name: "rp-shop",
      prod: false,
      subjectArg: "CN=shop.example, O=Shop, C=TR",
      serviceId: "s-1",
    });
    expect(new Name(r.subject).getField("OU")).toEqual(["s-1"]);
    expect(() =>
      resolveSubject({ name: "rp-shop", prod: false, subjectArg: "CN=a, OU=x, O=Shop, C=TR", serviceId: "s-1" }),
    ).toThrow(/zaten OU/);
  });

  it("buildSubject sırası: CN, OU, O, organizationIdentifier, C", () => {
    expect(buildSubject({ C: "TR", orgId: ORG, O: "B", CN: "A" })).toEqual([
      { CN: ["A"] },
      { O: ["B"] },
      { "2.5.4.97": [ORG] },
      { C: ["TR"] },
    ]);
  });
});

describe("gerçek ağ onay kapısı (O5)", () => {
  it("TAMGA_CONFIRM_PROD kurum kısa adıyla eşleşmeli", () => {
    expect(prodConfirmProblem("issuer-yeni", undefined)).toMatch(/TAMGA_CONFIRM_PROD yok/);
    expect(prodConfirmProblem("issuer-yeni", "baska")).toMatch(/uymuyor/);
    for (const n of ["issuer-yeni", "issuer-yeni-status", "rp-issuer-yeni", "rp-yeni"])
      expect(prodConfirmProblem(n, "yeni")).toBeNull();
    expect(prodConfirmProblem("issuer-yeniden", "yeni")).not.toBeNull();
  });
});
