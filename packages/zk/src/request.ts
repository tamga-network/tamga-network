/**
 * DCQL isteğinden ZK ile ispatlanacak öğeleri çıkarır (ADR-0032; AB TS13 `format: "mso_mdoc_zk"`). ZK ispatı yalnız sabit değerli
 * öğeleri kanıtlar ("age_over_18 = true"): tek bir beklenen değeri olmayan öğe ZK ile istenemez (ZK açıklama değil, ispattır).
 * Bir sorgu tek belge türü ve tek ad alanı içerir (ZK6: bir belge türünde bir öğe adı yalnız bir ad alanında bulunur).
 */
import { ZkError, type ZkClaim } from "./types.js";

export const ZK_FORMAT = "mso_mdoc_zk";

/** DCQL `credentials[]` öğesinin bu paketi ilgilendiren kısmı. */
export interface DcqlCredentialQuery {
  id: string;
  format: string;
  meta?: { doctype_value?: string };
  claims?: { path: (string | number)[]; values?: unknown[] }[];
}

export interface ZkQuery {
  queryId: string;
  docType: string;
  claims: ZkClaim[];
}

/** Sorgu ZK sorgusu mu? */
export const isZkQuery = (q: DcqlCredentialQuery) => q.format === ZK_FORMAT;

/** ZK sorgusunu ispatlanacak öğelere çevirir; ispatlanamayan biçimdeyse `unsupported_request`. */
export function zkQueryFromDcql(q: DcqlCredentialQuery): ZkQuery {
  if (!isZkQuery(q)) throw new ZkError("unsupported_request", `not a ${ZK_FORMAT} query`);
  const docType = q.meta?.doctype_value;
  if (!docType) throw new ZkError("unsupported_request", "doctype_value missing");
  const claims: ZkClaim[] = (q.claims ?? []).map((c) => {
    const [namespace, element] = c.path;
    if (c.path.length !== 2 || typeof namespace !== "string" || typeof element !== "string")
      throw new ZkError("unsupported_request", "claim path must be [namespace, element]");
    if (!c.values || c.values.length !== 1)
      throw new ZkError("unsupported_request", `claim ${element}: exactly one expected value is required`);
    const v = c.values[0];
    if (typeof v !== "boolean" && typeof v !== "string" && typeof v !== "number")
      throw new ZkError("unsupported_request", `claim ${element}: value type not supported`);
    return { namespace, element, value: v };
  });
  if (claims.length === 0) throw new ZkError("unsupported_request", "no claims");
  if (new Set(claims.map((c) => c.namespace)).size > 1)
    throw new ZkError("unsupported_request", "claims must share one namespace");
  return { queryId: q.id, docType, claims };
}
