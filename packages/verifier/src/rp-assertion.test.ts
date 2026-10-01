/** ADR-0017 K1 / HV5 — RP beyanı: imza, güven listesi parmak izi, aud, süre, jti tekrarı. */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { certFingerprintSha256Hex, pemToDer, x509HashClientId } from "@tamga-network/core";
import type { RelyingParty } from "@tamga-network/trust";
import { pemRpSigner } from "./request.js";
import { createRpAssertion, makeJtiCache, verifyRpAssertion } from "./rp-assertion.js";

const PKI = resolve(import.meta.dirname, "../../../ops/pki");
const ready = existsSync(resolve(PKI, "rp-verify.pkcs8.pem")) && existsSync(resolve(PKI, "issuer-bilgi.cert.pem"));
const AUD = "https://verify.tamga.network";
// ADR-0034: OpenID4VP istemci kimliği x509_hash (rp-verify erişim sertifikasından)
const CLIENT_OF = (pki: string) => x509HashClientId(pemToDer(readFileSync(resolve(pki, "rp-verify.cert.pem"), "utf8")));
const CLIENT = ready ? CLIENT_OF(PKI) : "";

describe.skipIf(!ready)("RP beyanı (ADR-0017)", () => {
  const certPem = () => readFileSync(resolve(PKI, "rp-verify.cert.pem"), "utf8");
  const signer = () => pemRpSigner(readFileSync(resolve(PKI, "rp-verify.pkcs8.pem"), "utf8"), certPem());
  const rp = (over: Partial<RelyingParty> = {}) =>
    ({
      client_id: CLIENT,
      legal_name: "Test RP",
      status: "ACTIVE",
      access_cert_fingerprint_sha256: certFingerprintSha256Hex(pemToDer(certPem())),
      ...over,
    }) as unknown as RelyingParty;
  const verify = (
    auth: string | undefined,
    o: { rec?: RelyingParty | null; now?: number; jti?: ReturnType<typeof makeJtiCache> } = {},
  ) =>
    verifyRpAssertion(auth, {
      audience: AUD,
      relyingParty: (id) => (id === CLIENT ? (o.rec === undefined ? rp() : o.rec) : null),
      jti: o.jti ?? makeJtiCache(),
      now: o.now,
    });

  it("geçerli beyan RP'nin client_id'sini verir; aynı beyan ikinci kez reddedilir (jti)", async () => {
    const tok = await createRpAssertion(await signer(), AUD);
    const jti = makeJtiCache();
    await expect(verify(`Bearer ${tok}`, { jti })).resolves.toBe(CLIENT);
    await expect(verify(`Bearer ${tok}`, { jti })).rejects.toThrow(/replayed/);
  });

  it("yanlış aud, süresi geçmiş, başlıksız ya da bozuk imza reddedilir", async () => {
    const s = await signer();
    await expect(verify(`Bearer ${await createRpAssertion(s, "https://baska.example")}`)).rejects.toThrow(/audience/);
    const old = await createRpAssertion(s, AUD, { now: 1_000_000 });
    await expect(verify(`Bearer ${old}`)).rejects.toThrow(/expired/);
    await expect(verify(undefined)).rejects.toThrow(/required/);
    const tok = await createRpAssertion(s, AUD);
    const [h, p, sig] = tok.split(".");
    const tampered = `${h}.${p}.${sig.slice(0, -4)}AAAA`;
    await expect(verify(`Bearer ${tampered}`)).rejects.toThrow(/signature/);
  });

  it("kayıtsız ya da pasif RP ve güven listesiyle uyuşmayan sertifika reddedilir (HV5)", async () => {
    const tok = () => signer().then((s) => createRpAssertion(s, AUD));
    await expect(verify(`Bearer ${await tok()}`, { rec: null })).rejects.toThrow(/not registered/);
    await expect(verify(`Bearer ${await tok()}`, { rec: rp({ status: "SUSPENDED" as never }) })).rejects.toThrow(
      /not active/,
    );
    const other = certFingerprintSha256Hex(pemToDer(readFileSync(resolve(PKI, "issuer-bilgi.cert.pem"), "utf8")));
    await expect(
      verify(`Bearer ${await tok()}`, { rec: rp({ access_cert_fingerprint_sha256: other }) }),
    ).rejects.toThrow(/does not match/);
  });
});
