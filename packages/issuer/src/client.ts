/**
 * `@tamga-network/issuer/client` — Tamga'nın BARINDIRDIĞI ihraç servisini (issuer.tamga.network/{slug}) kullanan kurumun
 * kendi sisteminden çağırdığı istemci (D14). Kendi anahtarıyla kendi ihraç servisini çalıştıran kurum bunu değil
 * `@tamga-network/issuer` kütüphanesini kullanır.
 *
 *   const tamga = createIssuerClient({ baseUrl: "https://issuer.tamga.network", slug: "bubilet", apiKey });
 *   const sale = await tamga.sellTicket({ eventId: "konser-2026-10", ticketClass: "Genel" });
 *   // sale.offer.deepLink → QR / "cüzdanda aç";  sale.offer.txCode → AYRI kanaldan (S5: SMS, e-posta, kasa ekranı)
 *
 * Kimlik: `apiKey` — kurumun kiracı API anahtarı (`tmg_<slug>_…`, ADR-0016) → `/{slug}/api/v1/*`. `adminToken` yalnızca Tamga'nın
 * kendi iç servisleri içindir (`/{slug}/admin/*`, sunucunun dışına kapalı).
 * Bağımlılık yok (yalnızca `fetch`); Node 18+, Deno, Bun ve sunucusuz ortamlarda çalışır. Tarayıcıda KULLANMA: anahtar sayfaya konamaz.
 */

export interface IssuerClientOptions {
  /** Barındırılan ihraç servisinin tabanı, ör. `https://issuer.tamga.network` (slug eklenmez). */
  baseUrl: string;
  /** Kurumun güven listesindeki kısa adı (ör. `bilgi`, `bubilet`). */
  slug: string;
  /** Kiracı API anahtarı (`tmg_<slug>_…`, ADR-0016). Gizli; yalnızca sunucuda. */
  apiKey?: string;
  /** Yalnızca Tamga iç servisleri: operatör anahtarı (`x-admin-token`, `/admin`). Dış kurumlar `apiKey` kullanır. */
  adminToken?: string;
  /** Test veya özel taşıma için; varsayılan `globalThis.fetch`. */
  fetch?: typeof fetch;
}

/** Cüzdana teklif: `deepLink` QR/bağlantı olarak gösterilir; `txCode` teklifle AYNI kanaldan gönderilmez (S5/S6). */
export interface CredentialOffer {
  offerId: string;
  txCode: string;
  /** Unix saniye. */
  expiresAt: number;
  offerUri: string;
  deepLink: string;
}

/**
 * Kimliğe bağlı teklif (ADR-0020 Yol A): PIN yok; kişi cüzdanda kimlik belgesini sunarak teklifin kendisine ait olduğunu
 * kanıtlar. Bağlantıyı kurum kişiye kendi kanalıyla (e-posta, öğrenci portalı) iletir; 7 gün geçerli, tek kullanımlık.
 */
export interface BoundCredentialOffer {
  offerId: string;
  /** Unix saniye. */
  expiresAt: number;
  offerUri: string;
  deepLink: string;
}

export interface TicketSale {
  ticketId: string;
  ticketNo: string;
  event: { id: string; name: string; start: string; venue: string };
  offer: CredentialOffer;
}

/** `on-screen`: kod ekranda; `out-of-band`: kod ayrı kanalla (kiracı varsayılanı geçerli). */
export type OfferDelivery = "on-screen" | "out-of-band";

export class IssuerClientError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "IssuerClientError";
  }
}

interface RawOffer {
  offer_id: string;
  tx_code: string;
  expires_at: number;
  offer_uri: string;
  deep_link: string;
}
const offerOf = (o: RawOffer): CredentialOffer => ({
  offerId: o.offer_id,
  txCode: o.tx_code,
  expiresAt: o.expires_at,
  offerUri: o.offer_uri,
  deepLink: o.deep_link,
});

export function createIssuerClient(opts: IssuerClientOptions) {
  const f = opts.fetch ?? globalThis.fetch;
  if (!opts.apiKey === !opts.adminToken) throw new Error("exactly one of apiKey or adminToken is required");
  const surface = opts.apiKey ? "api/v1" : "admin";
  const auth: Record<string, string> = opts.apiKey
    ? { authorization: `Bearer ${opts.apiKey}` }
    : { "x-admin-token": opts.adminToken as string };
  const base = `${opts.baseUrl.replace(/\/$/, "")}/${encodeURIComponent(opts.slug)}/${surface}`;
  const call = async <T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> => {
    const r = await f(base + path, {
      method,
      headers: {
        ...auth,
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* düz metin hata */
    }
    if (!r.ok) {
      const msg =
        (json as { message?: string; reason?: string; title?: string } | null)?.message ??
        (json as { reason?: string })?.reason ??
        (json as { title?: string })?.title;
      // JSON değilse gövde metninin kısa hâli (HTML ise etiketler atılır) — hata nedeni kaybolmasın (iç inceleme O2)
      const plain =
        json === null && text
          ? text
              .replace(/<[^>]*>/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 200)
          : "";
      throw new IssuerClientError(r.status, msg ?? (plain ? `HTTP ${r.status}: ${plain}` : `HTTP ${r.status}`));
    }
    return json as T;
  };

  return {
    /** Kurumun kayıtlı kişisi için belge teklifi (ör. öğrenci belgesi, diploma). `subjectId` kurumun kendi kayıt numarasıdır. */
    async createOffer(p: { subjectId: string; vct: string; delivery?: OfferDelivery }): Promise<CredentialOffer> {
      const r = await call<RawOffer>("POST", "/offers", { subject_id: p.subjectId, vct: p.vct, klass: p.delivery });
      return offerOf(r);
    },

    /**
     * Kimliğe bağlı teklif (ADR-0020): `bind` kişinin T.C. kimlik no + doğum tarihidir; Tamga yalnızca anahtarlı özetini
     * saklar. Başka biri bağlantıyı açarsa belge verilmez. Kişi kurumun kaynağında (`subjectId`) bulunmalıdır.
     */
    async createBoundOffer(p: {
      subjectId: string;
      vct: string;
      bind: { personalAdministrativeNumber: string; birthDate: string };
    }): Promise<BoundCredentialOffer> {
      const r = await call<Omit<RawOffer, "tx_code">>("POST", "/offers", {
        subject_id: p.subjectId,
        vct: p.vct,
        bind: { personal_administrative_number: p.bind.personalAdministrativeNumber, birth_date: p.bind.birthDate },
      });
      return { offerId: r.offer_id, expiresAt: r.expires_at, offerUri: r.offer_uri, deepLink: r.deep_link };
    },

    /** Bilet satışı → cüzdana bilet teklifi (EventTicket; kişisel veri yok). Satıcı: EVENTS kategorisi (ADR-0014). */
    async sellTicket(p: {
      eventId: string;
      ticketClass: string;
      seat?: string;
      delivery?: OfferDelivery;
    }): Promise<TicketSale> {
      const r = await call<{
        ticket_id: string;
        ticket_no: string;
        event: TicketSale["event"];
        offer: RawOffer;
      }>("POST", "/tickets", { event_id: p.eventId, ticket_class: p.ticketClass, seat: p.seat, klass: p.delivery });
      return { ticketId: r.ticket_id, ticketNo: r.ticket_no, event: r.event, offer: offerOf(r.offer) };
    },

    /** İptal (geri alınamaz). Etkisi bir sonraki sabit aralıklı status yayınında görünür (S6). */
    revoke: (credentialId: string, reason?: string) =>
      call<{ ok: true; effective_after_next_publish: boolean; interval_sec: number }>("POST", "/revocations", {
        credential_id: credentialId,
        action: "revoke",
        reason,
      }),
    /** Askıya alma (geri alınabilir: `reinstate`). */
    suspend: (credentialId: string, reason?: string) =>
      call<{ ok: true; effective_after_next_publish: boolean; interval_sec: number }>("POST", "/revocations", {
        credential_id: credentialId,
        action: "suspend",
        reason,
      }),
    reinstate: (credentialId: string) =>
      call<{ ok: true; effective_after_next_publish: boolean; interval_sec: number }>("POST", "/revocations", {
        credential_id: credentialId,
        action: "reinstate",
      }),
  };
}

export type IssuerClient = ReturnType<typeof createIssuerClient>;
