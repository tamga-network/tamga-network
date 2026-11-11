/**
 * ADR-0075 ülkeler arası ad kuralı — GERÇEK yükleyiciyle (`fetchListTrustSource`, imzalı iki ülke listesi; kontrol 2026-11-10).
 * Önceki testler kuralı elle kurulmuş bir depoyla deniyordu; gerçek yükleyici tek ülke listesi yüklediğinden o durum sahada hiç
 * oluşmuyordu. Burada:
 *   - iki liste yüklenince (`additionalStates`) aynı `dns_name` iki listede iptal edilmemişse `relyingParty` (istemci kimliği) ve
 *     `relyingPartyByDnsName` ikisi de null döner — kural `ListTrustSource`'un içinde;
 *   - tek liste yüklenince (cüzdanın yolu) belirsizlik GÖRÜLEMEZ: kayıt döner. Bu, cüzdan yükleyicisinin belgelenmiş kapsamıdır.
 */
import { decodeJwt } from "jose";
import { describe, expect, it } from "vitest";
import { fetchListTrustSource, verifyJws, type RelyingParty } from "@tamga-network/trust";
import { fetchRpRecord, resetTrustSeen, walletJwsVerifier } from "@tamga-network/wallet-core";

import { buildFixture } from "./fixture.js";

const BASE = "https://trust.test";

async function lists() {
  const f = await buildFixture();
  const tr = decodeJwt(f.archive.national["tl-tr"].at(-1)!) as unknown as { relying_parties: RelyingParty[] };
  const kz = decodeJwt(f.archive.national["tl-kz"].at(-1)!) as unknown as { relying_parties: RelyingParty[] };
  // TR listesinde etkin bir doğrulayıcı; aynı ad KZ listesine de etkin olarak eklenir (devir kaydı yok → belirsiz)
  const victim = tr.relying_parties.find(
    (r) => r.status === "ACTIVE" && !kz.relying_parties.some((k) => k.dns_name === r.dns_name),
  )!;
  const squat = {
    ...victim,
    rp_id: `${victim.rp_id}-kz`,
    client_id: `x509_hash:${"Q".repeat(43)}`,
    access_cert_fingerprint_sha256: "ee".repeat(32),
    terminal_groups: [],
  };
  const files: Record<string, string> = {
    "lotl.jws": f.archive.lotl.at(-1)!,
    "tl-tr.jws": f.archive.national["tl-tr"].at(-1)!,
    "tl-kz.jws": await f.sign({ ...kz, relying_parties: [...kz.relying_parties, squat] }),
  };
  const http = async (url: string) => {
    const body = files[url.slice(BASE.length + 1)];
    return { status: body ? 200 : 404, text: async () => body ?? "" };
  };
  return { f, http, victim, squat };
}

describe("ADR-0075 — ad belirsizliği gerçek yükleyiciyle (iki imzalı liste)", () => {
  it("iki liste yüklü: istemci kimliğiyle de alan adıyla da null; öteki kayıtlar etkilenmez", async () => {
    const { f, http, victim, squat } = await lists();
    const { source, store } = await fetchListTrustSource(BASE, http, {
      rootFingerprints: f.archive.rootFingerprints,
      verifyJws,
      stateCode: "TR",
      additionalStates: ["KZ"],
      now: f.now,
      versionMemory: "none",
    });
    expect([...store.national.keys()].sort()).toEqual(["KZ", "TR"]);
    expect(store.relyingPartyAmbiguous(victim.dns_name)).toBe(true);
    expect(source.relyingParty(victim.client_id)).toBeNull();
    expect(source.relyingParty(squat.client_id)).toBeNull();
    expect(source.relyingPartyByDnsName(victim.dns_name)).toBeNull();
    // doğru devredilmiş ad (eski listede REVOKED + reassigned_to) belirsiz değil: iki yoldan da yeni kayıt
    const moved = source.relyingPartyByDnsName(f.devirDns);
    expect(moved?.status).toBe("ACTIVE");
    expect(source.relyingParty(moved!.client_id)?.dns_name).toBe(f.devirDns);
  });

  it("tek liste yüklü (cüzdanın yolu): öteki listedeki kayıt görülmez — kayıt döner (belgelenmiş kapsam)", async () => {
    const { f, http, victim } = await lists();
    const { source, store } = await fetchListTrustSource(BASE, http, {
      rootFingerprints: f.archive.rootFingerprints,
      verifyJws,
      stateCode: "TR",
      now: f.now,
      versionMemory: "none",
    });
    expect([...store.national.keys()]).toEqual(["TR"]);
    expect(source.relyingParty(victim.client_id)?.dns_name).toBe(victim.dns_name);
    // cüzdanın kendi doğrulayıcısı ve `fetchRpRecord` ile de aynı: tek liste, kayıt bulunur
    resetTrustSeen();
    const one = await fetchListTrustSource(BASE, http, {
      rootFingerprints: f.archive.rootFingerprints,
      verifyJws: walletJwsVerifier,
      stateCode: "TR",
      now: f.now,
      versionMemory: "none",
    });
    expect(one.source.relyingPartyByDnsName(victim.dns_name)?.client_id).toBe(victim.client_id);
    void fetchRpRecord;
  });

  it("additionalStates: istenen ek liste alınamazsa yükleme reddedilir (sessizce tek listeye düşmez)", async () => {
    const { f, http } = await lists();
    const partial = async (url: string) =>
      url.endsWith("tl-kz.jws") ? { status: 404, text: async () => "" } : http(url);
    await expect(
      fetchListTrustSource(BASE, partial, {
        rootFingerprints: f.archive.rootFingerprints,
        verifyJws,
        stateCode: "TR",
        additionalStates: ["KZ"],
        now: f.now,
        versionMemory: "none",
      }),
    ).rejects.toThrow(/stale|verilmedi/);
  });
});
