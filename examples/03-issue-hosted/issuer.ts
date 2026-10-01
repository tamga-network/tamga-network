/**
 * Example 03 — issue documents from your own system, using Tamga's hosted issuing service.
 *
 * Your institution gets a scoped API key from the Tamga operator (ADR-0016). Your server calls the service;
 * the person scans the returned link as a QR code and types the PIN you show them separately.
 *
 *   npm install @tamga-network/issuer
 */
import { createIssuerClient, IssuerClientError } from "@tamga-network/issuer/client";

export function institution(cfg: { apiKey: string; slug: string; baseUrl?: string; fetch?: typeof fetch }) {
  const tamga = createIssuerClient({
    baseUrl: cfg.baseUrl ?? "https://issuer.tamga.network",
    slug: cfg.slug,
    apiKey: cfg.apiKey, // tmg_<slug>_… — server side only
    fetch: cfg.fetch,
  });

  return {
    /** A university: offer a diploma to a graduate in your records (your own student number). */
    async offerDiploma(studentNo: string) {
      const offer = await tamga.createOffer({ subjectId: studentNo, vct: "urn:tamga:edu:DiplomaCredential:1" });
      // offer.deepLink → show as a QR code or an "Add to wallet" link.
      // offer.txCode   → show on a DIFFERENT channel than the link (screen, SMS, e-mail): never inside the QR.
      return offer;
    },

    /** A ticket seller: sell a ticket straight into the buyer's wallet (the ticket carries no personal data). */
    async sellTicket(eventId: string, ticketClass: string) {
      const sale = await tamga.sellTicket({ eventId, ticketClass });
      return { ticketId: sale.ticketId, qr: sale.offer.deepLink, pin: sale.offer.txCode };
    },

    /** Revoke (final) or suspend (reversible); verifiers see it at the next fixed publication. */
    async cancel(credentialId: string, reason: string) {
      try {
        return await tamga.revoke(credentialId, reason);
      } catch (e) {
        if (e instanceof IssuerClientError && e.status === 404) return null; // unknown credential
        throw e;
      }
    },
  };
}
