/**
 * İsteğin kayıt sertifikası seçimi (ETSI TS 119 472-2 RO-13…16, ARF RPRC_19): istek başına TEK sertifika — en çok sorguyu kapsayan
 * kullanımınki; sertifikası olmayan kullanım atlanır. Dosyalar geçici klasörde (kişisel veri yok).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registrationCertFor } from "../src/wrprc.js";

let dir: string;
const CID = "x509_hash:abc";

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "wrprc-"));
  mkdirSync(join(dir, "wrprc"));
  writeFileSync(join(dir, "wrprc", "a.jwt"), "jwt.a.sig\n");
  writeFileSync(join(dir, "wrprc", "b.jwt"), "jwt.b.sig\n");
  writeFileSync(
    join(dir, "wrprc", "index.json"),
    JSON.stringify({
      items: [
        { kind: "rp", path: "wrprc/a.jwt", client_id: CID, scope_id: "s-a" },
        { kind: "rp", path: "wrprc/b.jwt", client_id: CID, scope_id: "s-b" },
        { kind: "rp", path: "wrprc/a.jwt", client_id: "x509_hash:other", scope_id: "s-c" },
      ],
    }),
  );
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("registrationCertFor", () => {
  it("tek sertifika: en çok sorguyu kapsayan kullanım; eşitlikte ilk sorgununki", () => {
    expect(
      registrationCertFor(dir, CID, [
        { queryId: "q1", scopeId: "s-a" },
        { queryId: "q2", scopeId: "s-b" },
        { queryId: "q3", scopeId: "s-b" },
      ]),
    ).toBe("jwt.b.sig");
    expect(
      registrationCertFor(dir, CID, [
        { queryId: "q1", scopeId: "s-a" },
        { queryId: "q2", scopeId: "s-b" },
      ]),
    ).toBe("jwt.a.sig");
  });

  it("sertifikası olmayan kullanım atlanır; hiçbiri yoksa sertifikasız (undefined)", () => {
    expect(
      registrationCertFor(dir, CID, [
        { queryId: "q1", scopeId: "s-none" },
        { queryId: "q2", scopeId: "s-none" },
        { queryId: "q3", scopeId: "s-b" },
      ]),
    ).toBe("jwt.b.sig");
    expect(registrationCertFor(dir, CID, [{ queryId: "q1", scopeId: "s-c" }])).toBeUndefined(); // başka RP'nin
    expect(registrationCertFor(dir, CID, [])).toBeUndefined();
  });
});
