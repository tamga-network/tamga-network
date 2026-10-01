/**
 * SD-JWT iç içe seçici açıklama — IETF SD-JWT (RFC 9901) §4.2 ve §7.1. Platformdan bağımsız: içe aktarma yok, özet işlevi
 * dışarıdan verilir (Node: sha256, React Native: @noble). Doğrulayıcı (@tamga-network/sd-jwt) ve cüzdan (wallet-core) AYNI
 * kuralı kullanır (ADR-0036 Part B; AB PID `address{…}`, `nationalities[]`).
 *
 *  - Nesne özelliği disclosure'ı: [salt, ad, değer]; nesnenin `_sd` dizisindeki özetle eşleşir.
 *  - Dizi öğesi disclosure'ı: [salt, değer]; dizide `{"...": özet}` öğesiyle eşleşir.
 *  - Açıklanan değer de iç içe `_sd` / `...` taşıyabilir (özyineleme).
 *  - Her disclosure tam bir kez kullanılmalı; eşleşmeyen disclosure RED (C10). Eşleşmeyen özet = gizli ya da sahte (decoy) → yok sayılır.
 *  - Yol adları: nesne alanı `a.b`, dizi öğesi `a[i]` (i = sonuç dizisindeki konum). Kök düzeydeki alan yalnız adıyla (geriye uyum).
 */

export interface DecodedDisclosure {
  disclosure: string;
  digest: string;
  salt: string;
  /** Dizi öğesi disclosure'ında yok */
  name?: string;
  value: unknown;
}

export interface ResolvedDisclosure extends DecodedDisclosure {
  /** Sonuç belgesindeki yolu: `given_name`, `address.locality`, `nationalities[0]` */
  path: string;
}

export class SdStructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SdStructureError";
  }
}

/** Yapısal ve güvenlik açısından yasak alan adları (her düzeyde). */
const FORBIDDEN_NAMES = new Set(["_sd", "_sd_alg", "...", "__proto__", "constructor", "prototype"]);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Disclosure dizelerini çözer. `decodeJson` base64url → JSON (platforma göre verilir), `digest` = SHA-256 → base64url
 * (disclosure DİZESİNİN ASCII baytları üzerinden; önce özet, sonra çöz — C4/C14).
 */
export function decodeDisclosures(
  disclosures: string[],
  digest: (disclosure: string) => string,
  decodeJson: (b64u: string) => unknown,
): DecodedDisclosure[] {
  return disclosures.map((d) => {
    const dg = digest(d);
    let arr: unknown;
    try {
      arr = decodeJson(d);
    } catch {
      throw new SdStructureError("disclosure is not valid base64url JSON");
    }
    if (!Array.isArray(arr) || (arr.length !== 3 && arr.length !== 2))
      throw new SdStructureError("Ş5d: disclosure is not a 2- or 3-element array");
    const salt = arr[0];
    if (typeof salt !== "string") throw new SdStructureError("Ş5e: salt is not a string");
    if (arr.length === 3) {
      if (typeof arr[1] !== "string") throw new SdStructureError("Ş5d: claim name is not a string");
      return { disclosure: d, digest: dg, salt, name: arr[1] as string, value: arr[2] };
    }
    return { disclosure: d, digest: dg, salt, value: arr[1] };
  });
}

/**
 * Yükü disclosure'larla çözer: `_sd` / `...` yerlerine açıklanan değerleri koyar, yapısal alanları siler.
 * `topLevelNonSelective`: kök düzeyde seçici açıklanamayacak adlar (iss, vct, cnf, status…).
 */
export function resolveSdPayload(
  payload: Record<string, unknown>,
  disclosures: DecodedDisclosure[],
  topLevelNonSelective: ReadonlySet<string> = new Set(),
): { claims: Record<string, unknown>; resolved: ResolvedDisclosure[] } {
  const byDigest = new Map<string, DecodedDisclosure>();
  for (const d of disclosures) {
    if (byDigest.has(d.digest)) throw new SdStructureError("duplicate digest (Ş6)");
    byDigest.set(d.digest, d);
  }
  const used = new Set<string>();
  const resolved: ResolvedDisclosure[] = [];

  const take = (dg: string): DecodedDisclosure | undefined => {
    const d = byDigest.get(dg);
    if (!d) return undefined;
    if (used.has(dg)) throw new SdStructureError("digest referenced more than once (Ş6)");
    used.add(dg);
    return d;
  };

  const walk = (node: unknown, path: string, root: boolean): unknown => {
    if (Array.isArray(node)) {
      const out: unknown[] = [];
      for (const el of node) {
        if (isPlainObject(el) && Object.keys(el).length === 1 && Object.prototype.hasOwnProperty.call(el, "...")) {
          const dg = el["..."];
          if (typeof dg !== "string") throw new SdStructureError("array element digest is not a string");
          const d = take(dg);
          if (!d) continue; // gizli öğe ya da sahte özet — sonuçta yok
          if (d.name !== undefined) throw new SdStructureError("object-property disclosure used for an array element");
          const p = `${path}[${out.length}]`;
          resolved.push({ ...d, path: p });
          out.push(walk(d.value, p, false));
        } else out.push(walk(el, `${path}[${out.length}]`, false));
      }
      return out;
    }
    if (!isPlainObject(node)) return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === "_sd" || (root && k === "_sd_alg")) continue;
      if (k === "...") throw new SdStructureError(`"..." is only allowed inside array elements`);
      out[k] = walk(v, path ? `${path}.${k}` : k, false);
    }
    const sd = node._sd;
    if (sd !== undefined) {
      if (!Array.isArray(sd) || sd.some((x) => typeof x !== "string"))
        throw new SdStructureError("_sd is not a string array");
      for (const dg of sd as string[]) {
        const d = take(dg);
        if (!d) continue; // gizli alan ya da sahte özet
        if (d.name === undefined) throw new SdStructureError("array-element disclosure used for an object property");
        if (FORBIDDEN_NAMES.has(d.name) || (root && topLevelNonSelective.has(d.name)))
          throw new SdStructureError(`claim cannot be selectively disclosed: ${d.name}`);
        if (Object.prototype.hasOwnProperty.call(out, d.name))
          throw new SdStructureError(`conflicting claim: ${d.name} (Ş5f)`);
        const p = path ? `${path}.${d.name}` : d.name;
        resolved.push({ ...d, path: p });
        out[d.name] = walk(d.value, p, false);
      }
    }
    return out;
  };

  const claims = walk(payload, "", true) as Record<string, unknown>;
  for (const d of disclosures) if (!used.has(d.digest)) throw new SdStructureError("unmatched disclosure (C10)");
  return { claims, resolved };
}

/**
 * Sunum seçimi (cüzdan): istenen yollar için açılması gereken disclosure'lar. Bir yol istenirse (ör. `address.locality`)
 * hem kendisi hem atası (`address` bir disclosure ise) hem de altındakiler (`address` istenirse bütün alt alanları) açılır.
 * Dizi için `nationalities` istenirse bütün öğeleri açılır. Bilinmeyen yol hata verir (cüzdan olmayan alanı sunmaz).
 */
export function selectDisclosuresForPaths(resolved: ResolvedDisclosure[], paths: string[]): ResolvedDisclosure[] {
  const norm = (p: string) => p.replace(/\[\d+\]/g, "[]");
  const isUnder = (child: string, parent: string) =>
    child === parent || child.startsWith(parent + ".") || child.startsWith(parent + "[");
  const chosen = new Set<ResolvedDisclosure>();
  const missing: string[] = [];
  for (const want of paths) {
    let hit = false;
    for (const d of resolved) {
      // istenen yolun altı (alt alanlar ya da öğeler) ya da kendisi
      if (isUnder(d.path, want) || norm(d.path) === norm(want)) {
        chosen.add(d);
        hit = true;
      }
      // istenen yolun atası bir disclosure ise o da açılmalı (yoksa alt alan yerleşemez)
      if (isUnder(want, d.path) && want !== d.path) chosen.add(d);
    }
    if (!hit) missing.push(want);
  }
  if (missing.length)
    throw new SdStructureError(`requested claim is not a disclosure in the credential: ${missing.join(",")}`);
  // ata açıldıysa, atanın açılması için gereken üst atalar da (çok düzeyli)
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of [...chosen])
      for (const d of resolved)
        if (!chosen.has(d) && isUnder(c.path, d.path) && c.path !== d.path) {
          chosen.add(d);
          grew = true;
        }
  }
  return resolved.filter((d) => chosen.has(d));
}

/** Nokta/köşeli parantez yolundan değer okur (`address.country`, `nationalities[0]`); yoksa undefined. */
export function getClaimAtPath(claims: Record<string, unknown>, path: string): unknown {
  const tokens = path.match(/[^.[\]]+|\[\d+\]/g) ?? [];
  let cur: unknown = claims;
  for (const t of tokens) {
    if (cur === null || cur === undefined) return undefined;
    if (t.startsWith("[")) {
      if (!Array.isArray(cur)) return undefined;
      cur = cur[Number(t.slice(1, -1))];
    } else {
      if (typeof cur !== "object" || !Object.prototype.hasOwnProperty.call(cur, t)) return undefined;
      cur = (cur as Record<string, unknown>)[t];
    }
  }
  return cur;
}
