/**
 * `@tamga-network/issuer/client` — ağsız birim testi (sahte `fetch`): URL/başlık kurgusu, snake_case → camelCase
 * dönüşümü, HTTP hatasının `IssuerClientError`'a çevrilmesi (JSON ve düz metin gövde) ve `sellTicket` gövdesi.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createIssuerClient, IssuerClientError } from "./client.js";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const textResponse = (status: number, body: string) =>
  new Response(body, { status, headers: { "content-type": "text/plain" } });

describe("createIssuerClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
  });

  it("URL = baseUrl (sondaki / kırpılır) + /{slug}/admin/offers ve x-admin-token başlığı", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        offer_id: "o1",
        tx_code: "123456",
        expires_at: 1000,
        offer_uri: "https://issuer.tamga.network/bilgi/offers/o1",
        deep_link: "openid-credential-offer://x",
      }),
    );
    const client = createIssuerClient({
      baseUrl: "https://issuer.tamga.network/",
      slug: "bilgi",
      adminToken: "gizli-t",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await client.createOffer({ subjectId: "s-1", vct: "urn:tamga:edu:StudentCredential:1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://issuer.tamga.network/bilgi/admin/offers");
    expect((init.headers as Record<string, string>)["x-admin-token"]).toBe("gizli-t");
  });

  it("apiKey (ADR-0016): /{slug}/api/v1/… ve Bearer başlığı; yönetici başlığı gitmez; ikisi birden ya da hiçbiri → hata", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ok: true, effective_after_next_publish: true, interval_sec: 60 }),
    );
    const client = createIssuerClient({
      baseUrl: "https://issuer.tamga.network",
      slug: "bubilet",
      apiKey: "tmg_bubilet_abc",
      fetch: fetchMock as unknown as typeof fetch,
    });
    await client.revoke("c-1", "iade");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://issuer.tamga.network/bubilet/api/v1/revocations");
    const h = init.headers as Record<string, string>;
    expect(h.authorization).toBe("Bearer tmg_bubilet_abc");
    expect(h["x-admin-token"]).toBeUndefined();
    expect(() => createIssuerClient({ baseUrl: "x", slug: "a" })).toThrow();
    expect(() => createIssuerClient({ baseUrl: "x", slug: "a", apiKey: "k", adminToken: "t" })).toThrow();
  });

  it("snake_case yanıt camelCase'e çevrilir", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        offer_id: "o42",
        tx_code: "654321",
        expires_at: 1234567890,
        offer_uri: "https://issuer.tamga.network/bilgi/offers/o42",
        deep_link: "openid-credential-offer://y",
      }),
    );
    const client = createIssuerClient({
      baseUrl: "https://issuer.tamga.network",
      slug: "bilgi",
      adminToken: "t",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const offer = await client.createOffer({ subjectId: "s-1", vct: "urn:tamga:edu:StudentCredential:1" });

    expect(offer).toEqual({
      offerId: "o42",
      txCode: "654321",
      expiresAt: 1234567890,
      offerUri: "https://issuer.tamga.network/bilgi/offers/o42",
      deepLink: "openid-credential-offer://y",
    });
  });

  it("HTTP hata (JSON gövde) → IssuerClientError (status + sunucu mesajı)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, { message: "yanlış anahtar" }));
    const client = createIssuerClient({
      baseUrl: "https://issuer.tamga.network",
      slug: "bilgi",
      adminToken: "yanlis",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const err = await client
      .createOffer({ subjectId: "s-1", vct: "urn:tamga:edu:StudentCredential:1" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(IssuerClientError);
    expect((err as IssuerClientError).status).toBe(403);
    expect((err as IssuerClientError).message).toBe("yanlış anahtar");
  });

  it("HTTP hata (JSON gövde, reason alanı) → mesaj reason'dan gelir", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { reason: "bilinmeyen teklif" }));
    const client = createIssuerClient({
      baseUrl: "https://issuer.tamga.network",
      slug: "bilgi",
      adminToken: "t",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const err = await client.revoke("yok").catch((e) => e);
    expect(err).toBeInstanceOf(IssuerClientError);
    expect((err as IssuerClientError).status).toBe(404);
    expect((err as IssuerClientError).message).toBe("bilinmeyen teklif");
  });

  it("HTTP hata (düz metin gövde) → IssuerClientError, mesajda gövdenin kısa hâli (O2)", async () => {
    fetchMock.mockResolvedValueOnce(textResponse(500, "internal server error (html değil, düz metin)"));
    const client = createIssuerClient({
      baseUrl: "https://issuer.tamga.network",
      slug: "bilgi",
      adminToken: "t",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const err = await client
      .createOffer({ subjectId: "s-1", vct: "urn:tamga:edu:StudentCredential:1" })
      .catch((e) => e);
    expect(err).toBeInstanceOf(IssuerClientError);
    expect((err as IssuerClientError).status).toBe(500);
    expect((err as IssuerClientError).message).toBe("HTTP 500: internal server error (html değil, düz metin)");
  });

  it("sellTicket gövdesi event_id/ticket_class taşır", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ticket_id: "tk1",
        ticket_no: "N-001",
        event: { id: "EVT-1", name: "Konser", start: "2026-10-01T20:00:00Z", venue: "Salon" },
        offer: {
          offer_id: "o9",
          tx_code: "111222",
          expires_at: 999,
          offer_uri: "https://issuer.tamga.network/bubilet/offers/o9",
          deep_link: "openid-credential-offer://z",
        },
      }),
    );
    const client = createIssuerClient({
      baseUrl: "https://issuer.tamga.network",
      slug: "bubilet",
      adminToken: "t",
      fetch: fetchMock as unknown as typeof fetch,
    });
    const sale = await client.sellTicket({ eventId: "EVT-1", ticketClass: "STANDARD", seat: "A1" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://issuer.tamga.network/bubilet/admin/tickets");
    const body = JSON.parse(init.body as string);
    expect(body.event_id).toBe("EVT-1");
    expect(body.ticket_class).toBe("STANDARD");
    expect(sale.ticketId).toBe("tk1");
    expect(sale.offer.offerId).toBe("o9");
  });
  it("createBoundOffer: bind alanları API adlarıyla gider, PIN dönmez (ADR-0020)", async () => {
    let body: Record<string, unknown> = {};
    const c = createIssuerClient({
      baseUrl: "https://issuer.tamga.network",
      slug: "bilgi",
      apiKey: "tmg_bilgi_x",
      fetch: (async (_u: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(
          JSON.stringify({
            offer_id: "o7",
            expires_at: 1,
            offer_uri: "https://issuer.tamga.network/bilgi/offers/o7",
            deep_link: "openid-credential-offer://?credential_offer_uri=x",
            identity_bound: true,
          }),
        );
      }) as unknown as typeof fetch,
    });
    const o = await c.createBoundOffer({
      subjectId: "s-1",
      vct: "urn:tamga:edu:DiplomaCredential:1",
      bind: { personalAdministrativeNumber: "10000000146", birthDate: "2002-05-14" },
    });
    expect(body).toEqual({
      subject_id: "s-1",
      vct: "urn:tamga:edu:DiplomaCredential:1",
      bind: { personal_administrative_number: "10000000146", birth_date: "2002-05-14" },
    });
    expect(o).toEqual({
      offerId: "o7",
      expiresAt: 1,
      offerUri: "https://issuer.tamga.network/bilgi/offers/o7",
      deepLink: "openid-credential-offer://?credential_offer_uri=x",
    });
    expect("txCode" in o).toBe(false);
  });
});
