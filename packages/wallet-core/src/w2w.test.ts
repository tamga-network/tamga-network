/**
 * Cüzdandan cüzdana protokol çekirdeği: gösteren (`presentToPerson`) ↔ doğrulayan (`runW2wVerifier` + `verifyW2wResponse`)
 * sahte BLE çifti üzerinden, gerçek ISO 18013-5 oturumu ve gerçek mdoc imzalarıyla. Status List ve Attestation Revocation List
 * (VCR_10), paylaşım kuralı kısıtlı belgenin dışlanması (ADR-0046) ve izin listesi.
 */
import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import {
  BleReassembler,
  bleChunks,
  deviceResponseStatus,
  issueMdoc,
  p256,
  parseEngagement,
  rawStatusListSigner,
  readerReceive,
  readerStart,
  signIdentifierListToken,
  signStatusListCwt,
  type ItemsRequest,
} from "@tamga-network/mdoc";
import { MemoryKeyStore, SoftwareKeyProvider, jwkToRaw } from "./keys.js";
import { b64u } from "./b64.js";
import { certFingerprintHex, computeIssuerId } from "./sdjwt.js";
import { signJwt } from "./jws.js";
import { newState, type StoredCredential, type WalletState } from "./store.js";
import {
  W2W_PERSON_KEY,
  W2W_REJECT_DELAY_MS,
  fakeBleLink,
  readW2wOffer,
  presentToPerson,
  runW2wVerifier,
  verifyW2wResponse,
  type W2wHolderView,
  type W2wProfile,
  type W2wTrust,
} from "./w2w.js";

const PROFILE: W2wProfile = {
  docType: "urn:tamga:id:IdentityAttestation:1",
  namespace: "tamga.id.1",
  allowed: ["given_name", "family_name", "birth_date", "age_over_18"],
  claimNameOf: (e) => (e === "birth_date" ? "birthdate" : e),
};

// en küçük X.509 (DER): doğrulayıcının okuduğu alanlar (SPKI P-256); imza alanı yer tutucu
const len = (n: number) => (n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : [0x82, n >> 8, n & 0xff]);
const tlv = (tag: number, ...parts: Uint8Array[]) => {
  const body = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) body.set(p, (o += p.length) - p.length);
  return new Uint8Array([tag, ...len(body.length), ...body]);
};
const raw = (...b: number[]) => new Uint8Array(b);
const name = (cn: string) =>
  tlv(0x30, tlv(0x31, tlv(0x30, raw(0x06, 0x03, 0x55, 0x04, 0x03), tlv(0x0c, new TextEncoder().encode(cn)))));
function certFor(point: Uint8Array, cn: string): Uint8Array {
  const sigAlg = raw(0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02);
  const time = (s: string) => tlv(0x17, new TextEncoder().encode(s));
  const tbs = tlv(
    0x30,
    tlv(0xa0, raw(0x02, 0x01, 0x02)),
    raw(0x02, 0x01, 0x01),
    tlv(0x30, sigAlg),
    name(cn),
    tlv(0x30, time("260101000000Z"), time("361231000000Z")),
    name(cn),
    tlv(
      0x30,
      tlv(
        0x30,
        raw(0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01),
        raw(0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07),
      ),
      tlv(0x03, raw(0x00), point),
    ),
  );
  return tlv(0x30, tbs, tlv(0x30, sigAlg), tlv(0x03, raw(0x00), new Uint8Array(64)));
}

const NOW = Math.floor(Date.now() / 1000);
const STATUS_URI = "https://status.example/lists/1";
const IL_URI = "https://status.example/il/1";
const issuerSk = p256.utils.randomSecretKey();
const issuerCert = certFor(p256.getPublicKey(issuerSk, false), "Kimlik Servisi (test)");
const issuerId = computeIssuerId("TR", issuerCert);
const statusSk = p256.utils.randomSecretKey();
const statusCert = certFor(p256.getPublicKey(statusSk, false), "Iptal (test)");
const statusKeys = new SoftwareKeyProvider(new MemoryKeyStore());
const statusJwtCert = certFor(jwkToRaw(await statusKeys.generate("status")), "Iptal JWT (test)");

const trust: W2wTrust = {
  isCredentialAcceptable: (id) => (id === issuerId ? "YES" : "NO"),
  isCredentialSchemaAcceptable: () => "YES",
  issuer: (id) =>
    id === issuerId
      ? {
          legal_name: "Tamga Kimlik Servisi",
          delegate_keys: [
            { purpose: "status_list", fingerprint_sha256: certFingerprintHex(statusCert) },
            { purpose: "status_list", fingerprint_sha256: certFingerprintHex(statusJwtCert) },
          ],
        }
      : null,
};

const strangerKeys = new SoftwareKeyProvider(new MemoryKeyStore());
const strangerCert = certFor(jwkToRaw(await strangerKeys.generate("status")), "Yabanci (test)");

async function statusToken(
  bits: Record<number, number>,
  o: { exp?: number; signer?: "stranger"; sub?: string } = {},
): Promise<string> {
  const bytes = new Uint8Array(16);
  for (const [i, v] of Object.entries(bits)) bytes[Number(i) >> 2] |= v << ((Number(i) & 3) * 2);
  return signJwt(
    {
      typ: "statuslist+jwt",
      x5c: [Buffer.from(o.signer ? strangerCert : statusJwtCert).toString("base64")],
    },
    {
      sub: o.sub ?? STATUS_URI,
      iat: NOW,
      ttl: 3600,
      ...(o.exp !== undefined ? { exp: o.exp } : {}),
      status_list: { bits: 2, lst: b64u(new Uint8Array(deflateSync(bytes))) },
    },
    o.signer ? strangerKeys : statusKeys,
    "status",
  );
}

const ELEMENTS = {
  given_name: "Ayşe",
  family_name: "Yılmaz",
  birth_date: "1990-05-01",
  age_over_18: true,
  personal_administrative_number: "10000000146",
};

async function wallet(o: { identifierId?: Uint8Array; restricted?: boolean } = {}) {
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  const jwk = await keys.generate("c1");
  const m = issueMdoc({
    docType: PROFILE.docType,
    namespaces: { [PROFILE.namespace]: ELEMENTS },
    deviceKeyRaw: jwkToRaw(jwk),
    issuerSk,
    x5chain: [issuerCert],
    signed: NOW - 60,
    validFrom: NOW - 60,
    validUntil: NOW + 86400,
    randomBytes: (n) => p256.utils.randomSecretKey().slice(0, n),
    ...(o.identifierId
      ? { identifierList: { id: o.identifierId, uri: IL_URI } }
      : { status: { idx: 5, uri: STATUS_URI } }),
  });
  const claims = { given_name: "Ayşe", family_name: "Yılmaz", birthdate: "1990-05-01", age_over_18: true };
  const cred = {
    id: "id-1",
    vct: PROFILE.docType,
    typeName: "Kimlik",
    issuer: "https://id.example",
    issuerId,
    leafFingerprint: "f",
    iat: NOW - 60,
    claims,
    disclosureNames: Object.keys(claims),
    copies: [{ keyRef: "c1", cnf: jwk, combined: "x~", usedBy: [], mdoc: b64u(m.issuerSigned) }],
    receivedAt: Date.now(),
    ...(o.restricted
      ? {
          disclosurePolicy: {
            policy: {
              id: "https://issuer.example/p",
              type: "authorized_relying_parties",
              relying_parties: [{ rp_id: "x", service_id: "y" }],
            },
            digest: "sha256:00",
          },
        }
      : {}),
  } as unknown as StoredCredential;
  return { state: { ...newState("i"), credentials: [cred] } as WalletState, keys };
}

async function session(
  elements: string[],
  w: Awaited<ReturnType<typeof wallet>>,
  approve?: (v: W2wHolderView) => Promise<string[] | null>,
) {
  const link = fakeBleLink();
  let gotQr: (s: string) => void = () => {};
  const qr = new Promise<string>((r) => (gotQr = r));
  const holder = presentToPerson({
    profile: PROFILE,
    transport: link.holder,
    state: w.state,
    keys: w.keys,
    onQr: gotQr,
    timeoutMs: 5000,
    approve: approve ?? (async (v) => v.allowed),
  });
  const verifier = await runW2wVerifier({
    profile: PROFILE,
    transport: link.reader,
    qr: await qr,
    elements,
    timeoutMs: 5000,
  });
  return { verifier, holder: await holder };
}

describe("cüzdandan cüzdana — protokol çekirdeği", () => {
  it("uçtan uca, Status List ile: yalnız istenen izinli alanlar; günlükte 'bir kişi'; girdi baytları silinir", async () => {
    const { verifier, holder } = await session(["given_name", "birth_date"], await wallet());
    expect(holder.outcome).toBe("sent");
    expect(holder.state.presentationLog.at(-1)?.clientId).toBe(W2W_PERSON_KEY);
    expect(verifier.outcome).toBe("response");
    if (verifier.outcome !== "response") return;
    const resp = verifier.deviceResponse;
    const v = await verifyW2wResponse(resp, verifier.transcript, {
      profile: PROFILE,
      trust,
      requested: ["given_name", "birth_date"],
      fetchStatus: async () => statusToken({}),
    });
    expect(v).toEqual({
      kind: "valid",
      issuerName: "Tamga Kimlik Servisi",
      revocation: "checked",
      fields: [
        { name: "given_name", value: "Ayşe" },
        { name: "birth_date", value: "1990-05-01" },
      ],
    });
    expect(resp.every((b) => b === 0)).toBe(true);
  });

  it("Status List'te iptal edilmiş belge geçersiz", async () => {
    const { verifier } = await session(["given_name"], await wallet());
    if (verifier.outcome !== "response") throw new Error(verifier.outcome);
    const v = await verifyW2wResponse(verifier.deviceResponse, verifier.transcript, {
      profile: PROFILE,
      trust,
      requested: ["given_name"],
      fetchStatus: async () => statusToken({ 5: 1 }),
    });
    expect(v).toEqual({ kind: "invalid", reason: "revoked" });
  });

  it("VCR_10: Attestation Revocation List — listede değilse denetlendi, listedeyse iptal; kayıtsız imzacı GEÇERSİZ", async () => {
    const id = new Uint8Array(16).fill(9);
    const il = (ids: Uint8Array[], sk = statusSk, cert = statusCert) =>
      signIdentifierListToken({ uri: IL_URI, identifiers: ids, sk, x5chain: [cert], iat: NOW - 10, exp: NOW + 600 });
    for (const [ids, expected] of [
      [[new Uint8Array(16).fill(1)], { kind: "valid", revocation: "checked" }],
      [[id], { kind: "invalid", reason: "revoked" }],
    ] as const) {
      const { verifier } = await session(["age_over_18"], await wallet({ identifierId: id }));
      if (verifier.outcome !== "response") throw new Error(verifier.outcome);
      const v = await verifyW2wResponse(verifier.deviceResponse, verifier.transcript, {
        profile: PROFILE,
        trust,
        requested: ["age_over_18"],
        fetchIdentifierList: async () => il([...ids]),
      });
      expect(v).toMatchObject(expected);
    }
    const other = p256.utils.randomSecretKey();
    const { verifier } = await session(["age_over_18"], await wallet({ identifierId: id }));
    if (verifier.outcome !== "response") throw new Error(verifier.outcome);
    const v = await verifyW2wResponse(verifier.deviceResponse, verifier.transcript, {
      profile: PROFILE,
      trust,
      requested: ["age_over_18"],
      fetchIdentifierList: async () => il([id], other, certFor(p256.getPublicKey(other, false), "x")),
    });
    expect(v).toEqual({ kind: "invalid", reason: "status_invalid" });
  });

  it("0.5.2 (ağın D adımlarıyla aynı): Status List yanlış imzacı / adres → GEÇERSİZ; bayat, alınamayan, okunamayan → DOĞRULANAMADI", async () => {
    const run = async (fetchStatus?: (uri: string) => Promise<string | null>) => {
      const { verifier } = await session(["given_name"], await wallet());
      if (verifier.outcome !== "response") throw new Error(verifier.outcome);
      return verifyW2wResponse(verifier.deviceResponse, verifier.transcript, {
        profile: PROFILE,
        trust,
        requested: ["given_name"],
        ...(fetchStatus ? { fetchStatus } : {}),
      });
    };
    const invalid = { kind: "invalid", reason: "status_invalid" };
    const indeterminate = { kind: "indeterminate", reason: "status_unavailable" };
    expect(await run(async () => statusToken({}, { signer: "stranger" }))).toEqual(invalid);
    expect(await run(async () => statusToken({}, { sub: "https://status.example/lists/2" }))).toEqual(invalid);
    expect(await run(async () => statusToken({}, { exp: NOW - 10 }))).toEqual(indeterminate);
    expect(await run(async () => null)).toEqual(indeterminate);
    expect(await run(async () => Promise.reject(new Error("offline")))).toEqual(indeterminate);
    expect(await run(async () => "<html>captive portal</html>")).toEqual(indeterminate);
    expect(await run()).toEqual(indeterminate); // çekici yok (ağ yok)
    // kurumun iptal anahtarı listede kayıtlı değil: doğrulanamadı (ağın D3 STATUS_UNREACHABLE)
    const noKeys: W2wTrust = { ...trust, issuer: (id) => ({ ...trust.issuer(id)!, delegate_keys: [] }) };
    const { verifier } = await session(["given_name"], await wallet());
    if (verifier.outcome !== "response") throw new Error(verifier.outcome);
    expect(
      await verifyW2wResponse(verifier.deviceResponse, verifier.transcript, {
        profile: PROFILE,
        trust: noKeys,
        requested: ["given_name"],
        fetchStatus: async () => statusToken({}),
      }),
    ).toEqual(indeterminate);
  });

  it("0.5.2: Revocation List süresi geçmiş / alınamadı → DOĞRULANAMADI", async () => {
    const id = new Uint8Array(16).fill(9);
    for (const fetchIdentifierList of [
      async () =>
        signIdentifierListToken({
          uri: IL_URI,
          identifiers: [],
          sk: statusSk,
          x5chain: [statusCert],
          iat: NOW - 900,
          exp: NOW - 10,
        }),
      async () => null,
      async () => new Uint8Array([1, 2, 3]),
    ]) {
      const { verifier } = await session(["age_over_18"], await wallet({ identifierId: id }));
      if (verifier.outcome !== "response") throw new Error(verifier.outcome);
      const v = await verifyW2wResponse(verifier.deviceResponse, verifier.transcript, {
        profile: PROFILE,
        trust,
        requested: ["age_over_18"],
        fetchIdentifierList,
      });
      expect(v).toEqual({ kind: "indeterminate", reason: "status_unavailable" });
    }
  });

  it("0.6.0 (ADR-0048 K3): mdoc kopyasının CWT listesi (bits = 1) `fetchStatusBytes` ile okunur; JWT baytları da okunur", async () => {
    const cwt = (revoked: boolean, sk = statusSk, cert = statusCert) => {
      const bytes = new Uint8Array(16);
      if (revoked) bytes[0] |= 1 << 5; // bits = 1: idx 5 → bayt 0, bit 5
      return signStatusListCwt({
        uri: STATUS_URI,
        bits: 1,
        lst: new Uint8Array(deflateSync(bytes)),
        iat: NOW - 10,
        exp: NOW + 600,
        ttl: 60,
        x5chain: [cert],
        sign: rawStatusListSigner(sk),
      });
    };
    const run = async (fetchStatusBytes: (uri: string) => Promise<Uint8Array | null>) => {
      const { verifier } = await session(["given_name"], await wallet());
      if (verifier.outcome !== "response") throw new Error(verifier.outcome);
      return verifyW2wResponse(verifier.deviceResponse, verifier.transcript, {
        profile: PROFILE,
        trust,
        requested: ["given_name"],
        fetchStatusBytes,
      });
    };
    expect(await run(async () => cwt(false))).toMatchObject({ kind: "valid", revocation: "checked" });
    expect(await run(async () => cwt(true))).toEqual({ kind: "invalid", reason: "revoked" });
    const other = p256.utils.randomSecretKey();
    expect(await run(async () => cwt(false, other, certFor(p256.getPublicKey(other, false), "x")))).toEqual({
      kind: "invalid",
      reason: "status_invalid",
    });
    expect(await run(async () => new TextEncoder().encode(await statusToken({ 5: 1 })))).toEqual({
      kind: "invalid",
      reason: "revoked",
    });
    expect(await run(async () => null)).toEqual({ kind: "indeterminate", reason: "status_unavailable" });
  });

  it("ADR-0046: paylaşım kuralı kısıtlı belge gösterilmez (kişiye sorulmadan ret)", async () => {
    let asked = 0;
    const { verifier, holder } = await session(["given_name"], await wallet({ restricted: true }), async (v) => {
      asked++;
      return v.allowed;
    });
    expect(asked).toBe(0);
    expect(holder.outcome).toBe("declined");
    expect(holder.reason).toBe("restricted");
    expect(verifier.outcome).toBe("declined");
  });

  it("izin listesi dışındaki alan istenemez ve gönderilmez", async () => {
    const { verifier } = await session(["personal_administrative_number"], await wallet());
    expect(verifier).toMatchObject({ outcome: "error" });
  });
});

/** TS9 STS9_34 denetimini sınamak için kendi isteğini kuran okuyucu (runW2wVerifier teklif dışı istek kurmaz). */
async function rawReader(
  items: ItemsRequest[],
  w: Awaited<ReturnType<typeof wallet>>,
  opts: Record<string, unknown> = {},
) {
  const link = fakeBleLink();
  let gotQr: (s: string) => void = () => {};
  const qr = new Promise<string>((r) => (gotQr = r));
  let asked = 0;
  const holder = presentToPerson({
    profile: PROFILE,
    transport: link.holder,
    state: w.state,
    keys: w.keys,
    onQr: gotQr,
    timeoutMs: 5000,
    approve: async (v) => {
      asked++;
      return v.allowed;
    },
    ...opts,
  });
  const { session, establishment } = readerStart(await qr, items);
  const reasm = new BleReassembler();
  const msg = new Promise<Uint8Array>((res) =>
    link.reader.onChunk((c) => {
      const m = reasm.push(c);
      if (m) res(m);
    }),
  );
  await link.reader.connect(session.bleServiceUuid!);
  for (const c of bleChunks(establishment, 180)) await link.reader.send(c);
  const got = readerReceive(session, await msg);
  return { holder: await holder, deviceResponse: got.deviceResponse, asked, offer: session.offer };
}

describe("TS9 sunum teklifi (0.6.0)", () => {
  it("gösteren QR'a teklif koyar: izin listesindeki ve belgede bulunan alanlar; doğrulayan okur", async () => {
    const w = await wallet();
    const link = fakeBleLink();
    let gotQr: (s: string) => void = () => {};
    const qr = new Promise<string>((r) => (gotQr = r));
    const holder = presentToPerson({
      profile: PROFILE,
      transport: link.holder,
      state: w.state,
      keys: w.keys,
      onQr: gotQr,
      timeoutMs: 5000,
      approve: async (v) => v.allowed,
    });
    const q = await qr;
    expect(parseEngagement(q).offer).toEqual({
      version: "1.0",
      docs: [{ docType: PROFILE.docType, nameSpaces: { [PROFILE.namespace]: PROFILE.allowed.slice() } }],
    });
    expect(readW2wOffer(PROFILE, q)).toEqual({ offered: PROFILE.allowed.slice() });
    const v = await runW2wVerifier({ profile: PROFILE, transport: link.reader, qr: q, elements: ["given_name"] });
    expect(v.outcome).toBe("response");
    const h = await holder;
    expect(h.outcome).toBe("sent");
    expect(h.offered).toEqual(PROFILE.allowed.slice());
  });

  it("doğrulayan yalnız teklifteki alanları ister; teklifte olmayan seçim isteğe girmez", async () => {
    const w = await wallet();
    // belgede `age_over_18` yokmuş gibi: teklif ondan yoksun
    const cred = w.state.credentials[0];
    const claims = { ...cred.claims } as Record<string, unknown>;
    delete claims.age_over_18;
    w.state = { ...w.state, credentials: [{ ...cred, claims }] };
    const { verifier, holder } = await session(["given_name", "age_over_18"], w);
    expect(holder.offered).toEqual(["given_name", "family_name", "birth_date"]);
    expect(verifier.outcome).toBe("response");
    expect(holder.disclosed).toEqual(["given_name"]);
    const none = await session(["age_over_18"], w);
    expect(none.verifier).toMatchObject({ outcome: "error", reason: /offered/ });
  });

  it("STS9_34: teklif dışı istek → kişiye sorulmadan, belgesiz DeviceResponse status 10; doğrulayan `refused` görür", async () => {
    const w = await wallet();
    const r = await rawReader(
      [{ docType: PROFILE.docType, nameSpaces: { [PROFILE.namespace]: { personal_administrative_number: false } } }],
      w,
      { rejectDelayMs: 0 },
    );
    expect(r.asked).toBe(0);
    expect(r.holder).toMatchObject({ outcome: "declined", reason: "not_offered", disclosed: [] });
    expect(deviceResponseStatus(r.deviceResponse!)).toEqual({ status: 10, documents: 0 });
    expect(r.holder.state.presentationLog.at(-1)).toMatchObject({ outcome: "declined", disclosed: [] });
  });

  it("STS9_34: saklama niyetli (IntentToRetain = true) istek → status 10", async () => {
    const r = await rawReader(
      [{ docType: PROFILE.docType, nameSpaces: { [PROFILE.namespace]: { given_name: true } } }],
      await wallet(),
      { rejectDelayMs: 0 },
    );
    expect(r.asked).toBe(0);
    expect(r.holder.reason).toBe("intent_to_retain");
    expect(deviceResponseStatus(r.deviceResponse!).status).toBe(10);
  });

  it("STS9_34 zamanlama: kesme yanıtı isteğin alınışından sabit süre sonra gider (geçen süre ne olursa olsun)", async () => {
    let t = 1_000_000;
    const waits: number[] = [];
    const r = await rawReader(
      [{ docType: PROFILE.docType, nameSpaces: { [PROFILE.namespace]: { given_name: true } } }],
      await wallet(),
      {
        clock: () => (t += 7), // her okumada 7 ms geçmiş gibi
        sleep: async (ms: number) => {
          waits.push(ms);
          t += ms;
        },
      },
    );
    expect(r.holder.reason).toBe("intent_to_retain");
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBe(W2W_REJECT_DELAY_MS - 7);
  });

  it("teklifsiz gösteren (offer: false): QR'da teklif yok, doğrulayan izin listesinden seçer, akış olağan", async () => {
    const w = await wallet();
    const link = fakeBleLink();
    let gotQr: (s: string) => void = () => {};
    const qr = new Promise<string>((r) => (gotQr = r));
    const holder = presentToPerson({
      profile: PROFILE,
      transport: link.holder,
      state: w.state,
      keys: w.keys,
      onQr: gotQr,
      timeoutMs: 5000,
      offer: false,
      approve: async (v) => v.allowed,
    });
    const q = await qr;
    expect(readW2wOffer(PROFILE, q)).toEqual({ offered: null });
    const v = await runW2wVerifier({ profile: PROFILE, transport: link.reader, qr: q, elements: ["family_name"] });
    expect(v.outcome).toBe("response");
    const h = await holder;
    expect(h.offered).toBeUndefined();
    expect(h.disclosed).toEqual(["family_name"]);
  });
});
