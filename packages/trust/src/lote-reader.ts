/**
 * ETSI TS 119 602 (Lists of Trusted Entities, LoTE) JSON okuyucusu — ADR-0036 federasyon. Platformdan bağımsız (Node API yok;
 * cüzdanda da çalışır). Yalnız güven kararına gereken alanlar okunur: liste bilgisi (sıra no, yayın ve sonraki güncelleme
 * zamanı, ülke) ve her kurumun hizmetleri (hizmet türü + X.509 sertifikaları + varsa hizmet durumu).
 *
 * Hizmet türü → Tamga rolü (URI'nin yol parçasına göre; ETSI ve AB profillerinin adlandırması):
 *   …/WalletSolution/… → wallet_provider · …/PID/… → pid_provider · …/(Q|Pub|NonQ)?EAA/… → eaa_provider · …/WRPAC/… → access_ca
 * Hizmetin sonu: …/Issuance → belge/sertifika imzalama; …/Revocation → iptal (durum listesi) imzalama.
 * Geri çekilmiş/askıya alınmış hizmet (ServiceStatus …/withdrawn|revoked|suspended|deprecated) alınmaz.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import type { ExternalEntityKind } from "./types.js";

export interface LoteService {
  kind: ExternalEntityKind | null;
  role: "issuance" | "revocation" | "other";
  typeUri: string;
  name: string;
  certsDer: Uint8Array[];
}
export interface LoteEntity {
  name: string;
  services: LoteService[];
}
export interface ParsedLote {
  sequence: number;
  territory: string;
  issuedAt: Date;
  nextUpdate: Date;
  loteType: string;
  operatorName: string;
  entities: LoteEntity[];
}

export class LoteParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoteParseError";
  }
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** Saf base64 çözücü (standart ya da URL güvenli; boşluk ve '=' yok sayılır). */
export function b64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/[\s=]/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new LoteParseError("invalid base64 in certificate");
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}
export const sha256HexPortable = (b: Uint8Array) =>
  Array.from(sha256(b), (x) => x.toString(16).padStart(2, "0")).join("");
export function derToPemPortable(der: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < der.length; i += 3) {
    const n = (der[i] << 16) | ((der[i + 1] ?? 0) << 8) | (der[i + 2] ?? 0);
    bin += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    bin += i + 1 < der.length ? B64[(n >> 6) & 63] : "=";
    bin += i + 2 < der.length ? B64[n & 63] : "=";
  }
  return `-----BEGIN CERTIFICATE-----\n${bin.match(/.{1,64}/g)!.join("\n")}\n-----END CERTIFICATE-----\n`;
}

const SVC_KIND: Array<[RegExp, ExternalEntityKind]> = [
  [/\/WalletSolution\//i, "wallet_provider"],
  [/\/PID\//i, "pid_provider"],
  [/\/(Q|Pub|NonQ|PuB)?EAA\//i, "eaa_provider"],
  [/\/WRPAC\//i, "access_ca"],
];
export function serviceKind(typeUri: string): ExternalEntityKind | null {
  for (const [re, k] of SVC_KIND) if (re.test(typeUri)) return k;
  return null;
}
const INACTIVE = /(withdrawn|revoked|suspended|deprecated|expired)$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const firstText = (v: any): string =>
  Array.isArray(v) ? String(v[0]?.value ?? v[0] ?? "") : String(v?.value ?? v ?? "");

/** LoTE JSON nesnesini (JWS yükü) çözer. Biçim ETSI TS 119 602 Ek A.1; bilinmeyen alanlar yok sayılır. */
export function parseLote(json: unknown): ParsedLote {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = (json as any)?.LoTE;
  if (!root || typeof root !== "object") throw new LoteParseError("not a LoTE document (missing LoTE)");
  const info = root.ListAndSchemeInformation;
  if (!info) throw new LoteParseError("ListAndSchemeInformation missing");
  if (Number(info.LoTEVersionIdentifier) !== 1) throw new LoteParseError("unknown LoTEVersionIdentifier (CMP2)");
  const issuedAt = new Date(String(info.ListIssueDateTime));
  const nextUpdate = new Date(String(info.NextUpdate));
  if (!Number.isFinite(issuedAt.getTime()) || !Number.isFinite(nextUpdate.getTime()))
    throw new LoteParseError("ListIssueDateTime / NextUpdate unreadable");
  const sequence = Number(info.LoTESequenceNumber);
  if (!Number.isInteger(sequence) || sequence < 0) throw new LoteParseError("LoTESequenceNumber invalid");
  const entities: LoteEntity[] = [];
  for (const te of (root.TrustedEntitiesList ?? []) as Array<Record<string, unknown>>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tei = te.TrustedEntityInformation as any;
    const services: LoteService[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (te.TrustedEntityServices ?? []) as any[]) {
      const si = s?.ServiceInformation;
      if (!si) continue;
      const typeUri = String(si.ServiceTypeIdentifier ?? "");
      const status = si.ServiceStatus ? String(si.ServiceStatus) : "";
      if (status && INACTIVE.test(status)) continue;
      const certs: Uint8Array[] = [];
      for (const c of (si.ServiceDigitalIdentity?.X509Certificates ?? []) as Array<{ val?: string }>)
        if (typeof c?.val === "string" && c.val) certs.push(b64ToBytes(c.val));
      services.push({
        kind: serviceKind(typeUri),
        role: /\/Issuance$/i.test(typeUri) ? "issuance" : /\/Revocation$/i.test(typeUri) ? "revocation" : "other",
        typeUri,
        name: firstText(si.ServiceName),
        certsDer: certs,
      });
    }
    entities.push({ name: firstText(tei?.TEName), services });
  }
  return {
    sequence,
    territory: String(info.SchemeTerritory ?? ""),
    issuedAt,
    nextUpdate,
    loteType: String(info.LoTEType ?? ""),
    operatorName: firstText(info.SchemeOperatorName),
    entities,
  };
}
