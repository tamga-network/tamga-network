/**
 * Example 04 — ask the trust lists: is this institution registered, active, and authorized for this document?
 * Useful for a directory page, an onboarding screen or a back-office check. No personal data involved.
 *
 *   npm install @tamga-network/trust
 */
import { fetchListTrustSource, verifyJws } from "@tamga-network/trust";

export async function institutionStatus(
  trustBase: string,
  rootFingerprints: string[],
  slug: string,
  vct: string,
  opts: { fetch?: typeof fetch; anchorMaxAgeMs?: number } = {},
) {
  const f = opts.fetch ?? fetch;
  const { source } = await fetchListTrustSource(
    trustBase,
    async (url) => {
      const r = await f(url);
      return { status: r.status, text: () => r.text() };
    },
    { rootFingerprints, verifyJws },
  );
  const issuer = source.issuers().find((i) => i.slug === slug);
  if (!issuer) return { registered: false as const };
  const now = Date.now();
  const authorized = issuer.schema_authorizations.some(
    (a) =>
      a.vct === vct &&
      a.allowed &&
      new Date(a.valid_from).getTime() <= now &&
      (!a.valid_until || now < new Date(a.valid_until).getTime()),
  );
  return {
    registered: true as const,
    name: issuer.legal_name,
    category: issuer.category,
    status: issuer.status, // ACTIVE | SUSPENDED | REVOKED | RETIRED
    authorized,
  };
}
