/**
 * AB PID kodlaması — ISO mdoc tarafı (Komisyon Uygulama Tüzüğü (AB) 2026/1731 §4.1, Tablo 6; ADR-0045). Aynı veri SD-JWT VC'de
 * başka adla taşınır (`birthdate` ↔ `birth_date`, `nationalities` ↔ `nationality`); ad tablosu `@tamga-network/core/pid`.
 * `full-date` öznitelikleri #6.1004(tstr) etiketiyle kodlanır (RFC 8943; CIR 2026/1731 §4.1 (e)).
 */
import { CBOR_TAG_FULL_DATE, CBOR_TAG_TDATE, pidMdocName } from "@tamga-network/core/pid";
import { CborTag, type CborValue } from "./cbor.js";

/** CIR 2026/1731 Tablo 6: kodlaması `full-date` olan mdoc öznitelikleri. */
export const PID_FULL_DATE_ELEMENTS: ReadonlySet<string> = new Set(["birth_date"]);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * SD-JWT VC claim'leri → mdoc öğeleri (AB PID kodlaması): ad tablodan (`birthdate` → `birth_date`), `full-date` öğeleri
 * #6.1004(tstr). Değeri JSON olan öteki claim'ler aynen (dizi `nationality` dahil).
 */
export function toPidMdocElements(claims: Record<string, unknown>): Record<string, CborValue> {
  const out: Record<string, CborValue> = {};
  for (const [name, value] of Object.entries(claims)) {
    const el = pidMdocName(name);
    if (PID_FULL_DATE_ELEMENTS.has(el)) {
      if (typeof value !== "string" || !DATE_RE.test(value)) throw new Error(`mdoc: ${el} must be YYYY-MM-DD`);
      out[el] = new CborTag(CBOR_TAG_FULL_DATE, value);
    } else out[el] = value as CborValue;
  }
  return out;
}

/** mdoc öğe değeri → düz değer (JSON): `full-date` (1004) ve `tdate` (0) etiketleri dizgiye; öteki değerler aynen. */
export function plainElementValue(v: unknown): unknown {
  if (v instanceof CborTag && (v.tag === CBOR_TAG_FULL_DATE || v.tag === CBOR_TAG_TDATE) && typeof v.value === "string")
    return v.value;
  return v;
}
