/** Yakın alan sunumu (P4-3): sahte BLE taşıyıcısı + gerçek okuyucu mantığı; onay, seçim, ret, belge yok. */
import { describe, it, expect } from "vitest";
import { p256 } from "@noble/curves/nist.js";
import {
  BleReassembler,
  bleChunks,
  issueMdoc,
  parseDeviceResponse,
  readerReceive,
  readerStart,
  verifyDeviceAuth,
  verifyIssuerSigned,
} from "@tamga-network/mdoc";
import {
  MemoryKeyStore,
  SoftwareKeyProvider,
  b64u,
  jwkToRaw,
  newState,
  presentProximity,
  PROXIMITY_NO_COPY_REASON,
  type ProximityRequestView,
  type ProximityTransport,
  type StoredCredential,
  type WalletState,
} from "./index.js";

const DOCTYPE = "urn:tamga:id:IdentityAttestation:1";
const NS = "tamga.id.1";
const issuerSk = p256.utils.randomSecretKey();
const issuerPub = p256.getPublicKey(issuerSk, false);

async function walletWithIdentity(): Promise<{ state: WalletState; keys: SoftwareKeyProvider }> {
  const keys = new SoftwareKeyProvider(new MemoryKeyStore());
  const now = Math.floor(Date.now() / 1000);
  const claims = { given_name: "Ayşe", family_name: "Yılmaz", age_over_18: true };
  const copies = [];
  for (const ref of ["c1", "c2"]) {
    const jwk = await keys.generate(ref);
    const m = issueMdoc({
      docType: DOCTYPE,
      namespaces: { [NS]: claims },
      deviceKeyRaw: jwkToRaw(jwk),
      issuerSk,
      x5chain: [new Uint8Array([0x30, 1])],
      signed: now,
      validFrom: now,
      validUntil: now + 86400,
      randomBytes: (n) => p256.utils.randomSecretKey().slice(0, n),
    });
    copies.push({ keyRef: ref, cnf: jwk, combined: "x~", usedBy: [], mdoc: b64u(m.issuerSigned) });
  }
  const cred = {
    id: "id-1",
    vct: DOCTYPE,
    typeName: "Kimlik",
    issuer: "https://id.tamga.network",
    issuerId: "0x1",
    leafFingerprint: "f",
    iat: now,
    claims,
    disclosureNames: Object.keys(claims),
    copies,
    receivedAt: Date.now(),
  } as StoredCredential;
  return { state: { ...newState("i"), credentials: [cred] }, keys };
}

/** Bellek içi BLE: cüzdan ↔ okuyucu. Okuyucu QR gelince isteği yollar, yanıtı toplar. */
function bleLink(request: Record<string, boolean>) {
  let toWallet: ((c: Uint8Array) => void) | null = null;
  const fromWallet = new BleReassembler();
  let readerSession: ReturnType<typeof readerStart>["session"] | null = null;
  const result: { response: Uint8Array | null; ended: boolean; transcript?: Uint8Array } = {
    response: null,
    ended: false,
  };
  const transport: ProximityTransport = {
    start: async () => {},
    stop: async () => {},
    send: async (chunk) => {
      const m = fromWallet.push(chunk);
      if (m && readerSession) {
        const r = readerReceive(readerSession, m);
        result.response = r.deviceResponse;
        result.ended = r.ended;
      }
    },
    onChunk: (cb) => ((toWallet = cb), () => (toWallet = null)),
    onMtu: (cb) => (cb(185), () => {}),
  };
  const onQr = (qr: string) => {
    const { session, establishment } = readerStart(qr, [{ docType: DOCTYPE, nameSpaces: { [NS]: request } }]);
    readerSession = session;
    result.transcript = session.transcript;
    // okuyucu, cüzdan yayına başladıktan sonra yazar
    setTimeout(() => bleChunks(establishment, 20).forEach((c) => toWallet?.(c)), 0);
  };
  return { transport, onQr, result };
}

describe("presentProximity", () => {
  it("onay: yalnız seçilen alan gider; okuyucu imzayı doğrular; kopya işaretlenir, günlük", async () => {
    const { state, keys } = await walletWithIdentity();
    const link = bleLink({ age_over_18: false, given_name: false });
    const r = await presentProximity({
      registrarKeys: false /* ADR-0056 K10: bu testler kayıt sertifikasını değil alan seçimini sınar */,
      transport: link.transport,
      state,
      keys,
      onQr: link.onQr,
      approve: async (v) => {
        expect([...v.requested].sort()).toEqual(["age_over_18", "given_name"]);
        expect(v.missing).toEqual([]);
        return ["age_over_18"]; // kişi adını göndermemeyi seçti
      },
    });
    expect(r.outcome).toBe("sent");
    expect(link.result.ended).toBe(true);
    const dr = parseDeviceResponse(link.result.response!);
    const v = verifyIssuerSigned(dr.issuerSigned, { issuerPubRaw: issuerPub, expectedDocType: DOCTYPE });
    expect(v.valid).toBe(true);
    expect(v.claims?.[NS]).toEqual({ age_over_18: true });
    expect(verifyDeviceAuth(dr.deviceSignature, link.result.transcript!, DOCTYPE, v.deviceKeyRaw!)).toBe(true);
    expect(r.state.credentials[0].copies.filter((c) => c.usedBy.length).length).toBe(1);
    expect(r.state.presentationLog.at(-1)).toMatchObject({
      clientId: "proximity",
      disclosed: ["age_over_18"],
      outcome: "sent",
    });
  });

  it("ADR-0046: yakın mesafede paylaşım kuralı değerlendirilemez — kısıtlı belgede görünüm uyarı bilgisini taşır", async () => {
    const { state, keys } = await walletWithIdentity();
    const restricted = {
      ...state,
      credentials: state.credentials.map((c) => ({
        ...c,
        disclosurePolicy: {
          policy: {
            id: "https://issuer.example/p",
            type: "authorized_relying_parties",
            relying_parties: [{ rp_id: "x" }],
          },
          digest: "sha256:00",
        },
      })),
    } as typeof state;
    const views: Array<{ restricted?: boolean; outcome?: string }> = [];
    for (const s of [state, restricted]) {
      const link = bleLink({ age_over_18: false });
      await presentProximity({
        registrarKeys: false /* ADR-0056 K10: bu testler kayıt sertifikasını değil alan seçimini sınar */,
        transport: link.transport,
        state: s,
        keys,
        onQr: link.onQr,
        approve: async (v) => (
          views.push({ restricted: v.disclosurePolicy?.restricted, outcome: v.disclosurePolicy?.outcome }),
          null
        ),
      });
    }
    expect(views).toEqual([
      { restricted: false, outcome: "passed" },
      { restricted: true, outcome: "not_evaluable" },
    ]);
  });

  it("ret: yanıt yok, oturum sonu; günlükte declined", async () => {
    const { state, keys } = await walletWithIdentity();
    const link = bleLink({ age_over_18: false });
    const r = await presentProximity({
      registrarKeys: false /* ADR-0056 K10: bu testler kayıt sertifikasını değil alan seçimini sınar */,
      transport: link.transport,
      state,
      keys,
      onQr: link.onQr,
      approve: async () => null,
    });
    expect(r.outcome).toBe("declined");
    expect(link.result).toMatchObject({ response: null, ended: true });
    expect(r.state.presentationLog.at(-1)?.outcome).toBe("declined");
  });

  it("askıdaki ya da iptal edilmiş belge önerilmez (uzaktan sunumla aynı kural)", async () => {
    for (const value of ["suspended", "revoked"] as const) {
      const { state, keys } = await walletWithIdentity();
      const s = {
        ...state,
        credentials: state.credentials.map((c) => ({ ...c, status: { value, checkedAt: Date.now() } })),
      };
      const link = bleLink({ age_over_18: false });
      let seen: StoredCredential | null | undefined;
      const r = await presentProximity({
        registrarKeys: false /* ADR-0056 K10: bu testler kayıt sertifikasını değil alan seçimini sınar */,
        transport: link.transport,
        state: s,
        keys,
        onQr: link.onQr,
        approve: async (v) => ((seen = v.credential), ["age_over_18"]),
      });
      expect(seen ?? null).toBeNull();
      expect(r.outcome).toBe("declined");
    }
  });

  it("belge yoksa sorulmadan ret", async () => {
    const keys = new SoftwareKeyProvider(new MemoryKeyStore());
    const link = bleLink({ age_over_18: false });
    let asked = false;
    const r = await presentProximity({
      registrarKeys: false /* ADR-0056 K10: bu testler kayıt sertifikasını değil alan seçimini sınar */,
      transport: link.transport,
      state: newState("i"),
      keys,
      onQr: link.onQr,
      approve: async () => ((asked = true), ["age_over_18"]),
    });
    expect(asked).toBe(false);
    expect(r.outcome).toBe("declined");
  });

  it("okuyucu bağlanmazsa zaman aşımı", async () => {
    const { state, keys } = await walletWithIdentity();
    const t: ProximityTransport = {
      start: async () => {},
      stop: async () => {},
      send: async () => {},
      onChunk: () => () => {},
    };
    const r = await presentProximity({
      registrarKeys: false /* ADR-0056 K10: bu testler kayıt sertifikasını değil alan seçimini sınar */,
      transport: t,
      state,
      keys,
      onQr: () => {},
      approve: async () => null,
      timeoutMs: 20,
    });
    expect(r).toMatchObject({ outcome: "error", reason: "no reader connected" });
  });

  it("bağlantı koparsa beklemeden biter", async () => {
    const { state, keys } = await walletWithIdentity();
    let close: (r: string) => void = () => {};
    const t: ProximityTransport = {
      start: async () => void setTimeout(() => close("disconnected"), 0),
      stop: async () => {},
      send: async () => {},
      onChunk: () => () => {},
      onClose: (cb) => ((close = cb), () => {}),
    };
    const r = await presentProximity({
      registrarKeys: false /* ADR-0056 K10: bu testler kayıt sertifikasını değil alan seçimini sınar */,
      transport: t,
      state,
      keys,
      onQr: () => {},
      approve: async () => null,
    });
    expect(r).toMatchObject({ outcome: "error", reason: "disconnected" });
  });

  it("ikinci inceleme 0.8.3 (WL5): yanıt gönderilirken taşıyıcı hata verirse imzalanan kopya 'kullanıldı' kalır", async () => {
    const { state, keys } = await walletWithIdentity();
    const link = bleLink({ age_over_18: false });
    const failing: ProximityTransport = {
      ...link.transport,
      send: async () => {
        throw new Error("ble write failed");
      },
    };
    const r = await presentProximity({
      registrarKeys: false,
      transport: failing,
      state,
      keys,
      onQr: link.onQr,
      approve: async () => ["age_over_18"],
    });
    expect(r).toMatchObject({ outcome: "error", reason: "ble write failed" });
    // karşı taraf yanıtın bir kısmını almış olabilir: aynı kopya başka okuyucuya "kullanılmamış" diye verilmez
    expect(r.state.credentials[0].copies.filter((c) => c.usedBy.length).length).toBe(1);
    expect(r.state.presentationLog.at(-1)).toMatchObject({ clientId: "proximity", disclosed: [], outcome: "error" });
  });

  it("ikinci inceleme 0.8.3: süresi dolmuş belge yakın alanda da önerilmez", async () => {
    const { state, keys } = await walletWithIdentity();
    const past = Math.floor(Date.now() / 1000) - 10;
    const s = { ...state, credentials: state.credentials.map((c) => ({ ...c, exp: past })) };
    const link = bleLink({ age_over_18: false });
    let asked = false;
    const r = await presentProximity({
      registrarKeys: false,
      transport: link.transport,
      state: s,
      keys,
      onQr: link.onQr,
      approve: async () => ((asked = true), ["age_over_18"]),
    });
    expect(asked).toBe(false);
    expect(r.outcome).toBe("declined");
  });
});

describe("yakın alan kopya tüketimi (SPEC-WALLET-0001 §4.1; 0.8.4)", () => {
  const run = async (state: WalletState, keys: SoftwareKeyProvider, extra: { reuseLastCopy?: boolean } = {}) => {
    const link = bleLink({ age_over_18: false });
    const views: ProximityRequestView[] = [];
    const r = await presentProximity({
      registrarKeys: false,
      transport: link.transport,
      state,
      keys,
      onQr: link.onQr,
      approve: async (v) => (views.push(v), ["age_over_18"]),
      ...extra,
    });
    return { r, view: views[0], link };
  };
  const deviceKeyOf = (link: ReturnType<typeof bleLink>) =>
    b64u(
      verifyIssuerSigned(parseDeviceResponse(link.result.response!).issuerSigned, {
        issuerPubRaw: issuerPub,
        expectedDocType: DOCTYPE,
      }).deviceKeyRaw!,
    );

  it("her oturum yeni kopya; durum çağırana döner (onaydan önce ve oturumdan sonra)", async () => {
    const { state, keys } = await walletWithIdentity();
    const a = await run(state, keys);
    expect(a.view.copies).toEqual({ total: 2, remaining: 2, low: true, exhausted: false, refreshable: false });
    expect(a.r).toMatchObject({ outcome: "sent", copies: { remaining: 1, exhausted: false } });
    expect(a.r.reused).toBeUndefined();
    const b = await run(a.r.state, keys);
    expect(b.r).toMatchObject({ outcome: "sent", copies: { remaining: 0, low: true, exhausted: true } });
    expect(deviceKeyOf(a.link)).not.toBe(deviceKeyOf(b.link)); // iki oturum iki ayrı kopya (bağlanamaz)
    expect(b.r.state.presentationLog.every((e) => e.reused === undefined)).toBe(true);
  });

  it("kopya bitti, seçenek yok: bugünkü davranış — oturum hatayla biter, kopya yeniden kullanılmaz", async () => {
    const { state, keys } = await walletWithIdentity();
    const spent = (await run((await run(state, keys)).r.state, keys)).r.state;
    const c = await run(spent, keys);
    expect(c.view.copies).toMatchObject({ remaining: 0, exhausted: true });
    expect(c.r).toMatchObject({ outcome: "error", reason: PROXIMITY_NO_COPY_REASON });
    expect(c.r.reused).toBeUndefined();
    expect(c.link.result.response).toBeNull();
    expect(c.r.state).toBe(spent); // hiçbir şey işaretlenmedi, günlüğe yazılmadı
  });

  it("kopya bitti, kişi uyarıyı kabul etti (reuseLastCopy): son kopya yeniden kullanılır; sonuç ve günlük işaretli", async () => {
    const { state, keys } = await walletWithIdentity();
    const first = await run(state, keys);
    const second = await run(first.r.state, keys);
    const third = await run(second.r.state, keys, { reuseLastCopy: true });
    expect(third.r).toMatchObject({ outcome: "sent", reused: true, copies: { remaining: 0, exhausted: true } });
    expect(deviceKeyOf(third.link)).toBe(deviceKeyOf(second.link)); // SON kopya
    expect(third.r.state.presentationLog.at(-1)).toMatchObject({
      clientId: "proximity",
      disclosed: ["age_over_18"],
      outcome: "sent",
      reused: true,
    });
    // sonraki yeniden kullanım da aynı kopyada toplanır
    const fourth = await run(third.r.state, keys, { reuseLastCopy: true });
    expect(deviceKeyOf(fourth.link)).toBe(deviceKeyOf(second.link));
    expect(fourth.r.state.credentials[0].copies.map((k) => k.usedBy.length)).toEqual([1, 3]);
  });

  it("kullanılmamış kopya varken reuseLastCopy etkisizdir (yeni kopya gider, işaret yok)", async () => {
    const { state, keys } = await walletWithIdentity();
    const a = await run(state, keys, { reuseLastCopy: true });
    expect(a.r.outcome).toBe("sent");
    expect(a.r.reused).toBeUndefined();
    expect(a.r.state.presentationLog.at(-1)?.reused).toBeUndefined();
    expect(a.r.copies?.remaining).toBe(1);
  });

  it("yeniden kullanımda gönderim yarıda kalırsa günlükteki hata girişi de işaretlidir", async () => {
    const { state, keys } = await walletWithIdentity();
    const spent = (await run((await run(state, keys)).r.state, keys)).r.state;
    const link = bleLink({ age_over_18: false });
    const r = await presentProximity({
      registrarKeys: false,
      transport: {
        ...link.transport,
        send: async () => {
          throw new Error("ble write failed");
        },
      },
      state: spent,
      keys,
      onQr: link.onQr,
      approve: async () => ["age_over_18"],
      reuseLastCopy: true,
    });
    expect(r).toMatchObject({ outcome: "error", reason: "ble write failed", reused: true });
    expect(r.state.presentationLog.at(-1)).toMatchObject({ outcome: "error", disclosed: [], reused: true });
  });
});

describe("beforeSend kancası (WL5; 0.8.4)", () => {
  it("yanıt üretildikten sonra, gönderilmeden önce bir kez çağrılır; verilen durumda kopya işaretli", async () => {
    const { state, keys } = await walletWithIdentity();
    const link = bleLink({ age_over_18: false });
    const calls: Array<{ marked: WalletState; sentBefore: boolean }> = [];
    let sent = false;
    const r = await presentProximity({
      registrarKeys: false,
      transport: { ...link.transport, send: async (c) => ((sent = true), link.transport.send(c)) },
      state,
      keys,
      onQr: link.onQr,
      approve: async () => ["age_over_18"],
      beforeSend: async (marked) => void calls.push({ marked, sentBefore: sent }),
    });
    expect(r.outcome).toBe("sent");
    expect(calls).toHaveLength(1);
    expect(calls[0].sentBefore).toBe(false); // gönderimden ÖNCE
    expect(calls[0].marked.credentials[0].copies.map((k) => k.usedBy.length)).toEqual([1, 0]);
    expect(calls[0].marked.presentationLog).toEqual([]); // kalıcı işaret; günlük girişi sonuçla gelir
    expect(r.state.credentials[0].copies[0].usedBy).toEqual(calls[0].marked.credentials[0].copies[0].usedBy);
  });

  it("kanca hata verirse yanıt gönderilmez; dönen durum değişmemiştir", async () => {
    const { state, keys } = await walletWithIdentity();
    const link = bleLink({ age_over_18: false });
    let sent = 0;
    const r = await presentProximity({
      registrarKeys: false,
      transport: { ...link.transport, send: async (c) => (sent++, link.transport.send(c)) },
      state,
      keys,
      onQr: link.onQr,
      approve: async () => ["age_over_18"],
      beforeSend: async () => {
        throw new Error("disk full");
      },
    });
    expect(r).toMatchObject({ outcome: "error", reason: "disk full" });
    expect(sent).toBe(0);
    expect(link.result.response).toBeNull();
    expect(r.state).toBe(state);
    expect(r.copies).toBeUndefined();
  });

  it("ret ve kopyasız oturumda çağrılmaz", async () => {
    const { state, keys } = await walletWithIdentity();
    let called = 0;
    const link = bleLink({ age_over_18: false });
    await presentProximity({
      registrarKeys: false,
      transport: link.transport,
      state,
      keys,
      onQr: link.onQr,
      approve: async () => null,
      beforeSend: () => void called++,
    });
    const spent = {
      ...state,
      credentials: state.credentials.map((c) => ({
        ...c,
        copies: c.copies.map((k) => ({ ...k, usedBy: ["proximity:x"] })),
      })),
    };
    const link2 = bleLink({ age_over_18: false });
    const r = await presentProximity({
      registrarKeys: false,
      transport: link2.transport,
      state: spent,
      keys,
      onQr: link2.onQr,
      approve: async () => ["age_over_18"],
      beforeSend: () => void called++,
    });
    expect(r.outcome).toBe("error");
    expect(called).toBe(0);
  });
});
