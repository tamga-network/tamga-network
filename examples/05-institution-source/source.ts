/**
 * Example 05 — your institution's lookup endpoint for Tamga's hosted issuing service (contract:
 * docs.tamga.network/api/institution-source).
 *
 * The authentic source stays with you: Tamga keeps no student records. When a student takes a credential, the hosted
 * service asks this endpoint for exactly one record, signs the credential and forgets the answer. Put this handler in
 * front of your student information system, or in front of a regularly refreshed export of it.
 *
 * What it checks on every request (all of them, or the request is refused with 401):
 *   1. the body is a compact JWS with `typ: tamga-source-request+jwt` and ES256;
 *   2. the signing certificate (`x5c[0]`) is the access certificate of a relying party in Tamga's signed trust list,
 *      the record is ACTIVE, and it is one of the records you agreed with the operator (`callers`, by `dns_name`);
 *   3. `iss` equals that certificate's client identifier (`x509_hash:…`), `aud` equals your endpoint URL,
 *      the request is at most 60 seconds old and `jti` is used once.
 * It then answers with only the fields the requested document type needs, never the national ID number.
 *
 *   npm install @tamga-network/trust @tamga-network/core
 */
import { X509Certificate, createPublicKey, verify } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { x509HashClientId } from "@tamga-network/core";
import type { TrustSource } from "@tamga-network/trust";

const STUDENT = "urn:tamga:edu:StudentCredential:1";
const DIPLOMA = "urn:tamga:edu:DiplomaCredential:1";
const MAX_AGE_SEC = 60;
const SKEW_SEC = 30;

/** The education profile of the contract (`SubjectRecord`). `id` is your opaque, permanent person reference. */
export interface SubjectRecord {
  id: string;
  student_no: string;
  family_name: string;
  given_name: string;
  birth_date: string;
  /** Used only for matching; never returned to Tamga and never written into a credential. */
  personal_administrative_number?: string;
  programme_title_tr: string;
  programme_title_en?: string;
  faculty_tr?: string;
  isced_f_code?: string | null;
  study_level: number;
  enrollment_year: number;
  enrollment_date?: string;
  programme_credit_points?: number;
  student_status: "ACTIVE" | "ON_LEAVE";
  expected_graduation_year?: number;
  graduate?: {
    qualification_tr: string;
    qualification_en?: string;
    eqf_level: number;
    awarding_date: string;
    grade?: string;
    thesis_title_tr?: string;
    mode_of_study?: "FULL_TIME" | "PART_TIME" | "DISTANCE" | "BLENDED";
  };
}

/** Where the records come from: your database, your SIS API or an export. Return null when there is no such person. */
export interface RecordStore {
  byMatch(nationalId: string, birthDate: string): Promise<SubjectRecord | null>;
  byId(id: string): Promise<SubjectRecord | null>;
}

/** The simplest store: an array (for example a nightly JSON export). Replace with a query against your system. */
export function memoryStore(records: SubjectRecord[]): RecordStore {
  return {
    byMatch: async (pan, birth) =>
      records.find((r) => r.personal_administrative_number === pan && r.birth_date === birth) ?? null,
    byId: async (id) => records.find((r) => r.id === id) ?? null,
  };
}

export interface SourceOptions {
  /** Your endpoint's public URL, exactly as registered with the operator (it is the `aud` of every request). */
  url: string;
  /** Tamga's trust lists, refreshed regularly (see example 04: `fetchListTrustSource`). */
  trust: () => TrustSource;
  /** `dns_name` of the relying-party record(s) the hosted service uses for your institution (agreed at registration). */
  callers: string[];
  store: RecordStore;
  /** Document types you issue through Tamga. */
  vcts?: string[];
  now?: () => number;
}

type Answer = { status: number; body: unknown };

/** Pure core (easy to test and to wrap in any framework): request body in, status + JSON body out. */
export function institutionSource(opts: SourceOptions) {
  const vcts = new Set(opts.vcts ?? [STUDENT, DIPLOMA]);
  const now = opts.now ?? (() => Math.floor(Date.now() / 1000));
  const seen = new Map<string, number>(); // jti → expiry (memory; one process — use a shared store with several)
  const deny = (why: string): Answer => ({ status: 401, body: { error: "unauthorized", reason: why } });

  return async function answer(body: unknown): Promise<Answer> {
    const request = (body as { request?: unknown } | null)?.request;
    if (typeof request !== "string" || request.split(".").length !== 3)
      return { status: 400, body: { error: "invalid_request" } };
    const [h, p, s] = request.split(".");
    let header: { alg?: string; typ?: string; x5c?: string[] };
    let claims: Record<string, unknown>;
    try {
      header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
      claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    } catch {
      return { status: 400, body: { error: "invalid_request" } };
    }
    if (header.alg !== "ES256" || header.typ !== "tamga-source-request+jwt" || !header.x5c?.length)
      return deny("header");

    // 2. the caller: an ACTIVE relying party of Tamga's signed list, and one you agreed to
    const leaf = new Uint8Array(Buffer.from(header.x5c[0], "base64"));
    const clientId = x509HashClientId(leaf);
    const rp = opts.trust().relyingParty(clientId);
    if (!rp || rp.status !== "ACTIVE" || !opts.callers.includes(rp.dns_name)) return deny("caller");
    const cert = new X509Certificate(leaf);
    const signed = Buffer.from(`${h}.${p}`);
    const sig = Buffer.from(s, "base64url");
    const key = createPublicKey(cert.publicKey.export({ type: "spki", format: "pem" }));
    if (!verify("sha256", signed, { key, dsaEncoding: "ieee-p1363" }, sig)) return deny("signature");

    // 3. bound to you, fresh and used once
    const t = now();
    const iat = Number(claims.iat),
      exp = Number(claims.exp);
    if (claims.iss !== clientId) return deny("iss");
    if (claims.aud !== opts.url) return deny("aud");
    if (!(iat <= t + SKEW_SEC && exp > t - SKEW_SEC && exp - iat <= MAX_AGE_SEC)) return deny("time");
    const jti = String(claims.jti ?? "");
    for (const [k, until] of seen) if (until < t) seen.delete(k);
    if (!jti || seen.has(jti)) return deny("replay");
    seen.set(jti, exp + SKEW_SEC);

    const vct = String(claims.vct ?? "");
    if (!vcts.has(vct)) return { status: 404, body: { subject: null } };
    let rec: SubjectRecord | null = null;
    if (claims.op === "lookup") {
      const m = (claims.match ?? {}) as { personal_administrative_number?: string; birth_date?: string };
      if (!m.personal_administrative_number || !m.birth_date)
        return { status: 400, body: { error: "invalid_request" } };
      rec = await opts.store.byMatch(m.personal_administrative_number, m.birth_date);
    } else if (claims.op === "fetch") {
      if (typeof claims.subject_ref !== "string") return { status: 400, body: { error: "invalid_request" } };
      rec = await opts.store.byId(claims.subject_ref);
    } else return { status: 400, body: { error: "invalid_request" } };

    // a diploma only for graduates (the contract: `graduate` is required for DiplomaCredential)
    if (!rec || (vct === DIPLOMA && !rec.graduate)) return { status: 404, body: { subject: null } };
    return { status: 200, body: { subject: minimal(rec, vct) } };
  };
}

/** Only what the document type needs; the national ID number never leaves your system. */
function minimal(r: SubjectRecord, vct: string): Omit<SubjectRecord, "personal_administrative_number"> {
  const { personal_administrative_number: _pan, graduate, ...rest } = r;
  return vct === DIPLOMA ? { ...rest, graduate } : rest;
}

/** Node `http` handler around the core (POST only, JSON, small bodies). Serve it over TLS only. */
export function nodeHandler(opts: SourceOptions) {
  const answer = institutionSource(opts);
  return async (req: IncomingMessage, res: ServerResponse) => {
    const send = (a: Answer) => {
      res.writeHead(a.status, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(a.body));
    };
    if (req.method !== "POST") return send({ status: 405, body: { error: "method_not_allowed" } });
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of req) {
      size += (c as Buffer).length;
      if (size > 16 * 1024) return send({ status: 413, body: { error: "too_large" } });
      chunks.push(c as Buffer);
    }
    let body: unknown = null;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return send({ status: 400, body: { error: "invalid_request" } });
    }
    // Never log the request body: it carries the matching keys (national ID number, date of birth).
    send(await answer(body));
  };
}
