/**
 * Düğüm bildirimi (ADR-0052 K2) — bir işletmecinin Besu düğümünü ağ yapılandırmasında bildirdiği dosya
 * (`network/permissions/nodes/<cc>-<ad>.json`, şema `network/permissions/schema/node-declaration.schema.json`).
 *
 * Zincire yazılmaz (altyapı bilgisi; kontrat ABI'sinde serbest metin yok). Kişisel veri yok: iletişim alanı kurumun görev
 * adresidir (ör. `noc@…`, `https://…/iletisim`), kişi adı değil. Bildirim yetki vermez: validator düğümünün açık anahtarından
 * türeyen adres Governance'ta o devletin AKTİF validator adresi değilse izin listesine girmez (eşleşme kuralı `matchDeclarations`).
 * Yanlış IP/port yalnız bağlantıyı bozar.
 */
import { computeAddress } from "ethers";

export const NODE_DECLARATION_FORMAT = "tamga-node-declaration/1";
export type NodeRole = "validator" | "rpc";

export interface NodeDeclaration {
  format: typeof NODE_DECLARATION_FORMAT;
  /** ISO 3166-1 alfa-2, büyük harf (Governance üye kodu) */
  state: string;
  /** validator: QBFT doğrulayıcısı (izin listesine bütün işletmecilerde girer); rpc: işletmecinin kendi RPC/full düğümü */
  role: NodeRole;
  /** secp256k1 açık anahtarı, sıkıştırılmamış, 04 öneki olmadan: 128 onaltılık karakter (enode kimliği) */
  node_public_key: string;
  /** IPv4 ya da IPv6 değişmezi (Besu izin listesi DNS adını varsayılan olarak kabul etmez) */
  ip: string;
  p2p_port: number;
  /** kurumun görev iletişim adresi (e-posta ya da https) — kişi adı yazılmaz */
  contact: string;
}

const KEYS = ["$schema", "format", "state", "role", "node_public_key", "ip", "p2p_port", "contact"] as const;
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;
const CONTACT = /^(mailto:)?[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$|^https:\/\/[^\s]+$/i;

/** Bildirimi doğrular; hata listesi boşsa geçerli. Şema dosyasıyla aynı kurallar (test ikisini birlikte dener). */
export function validateNodeDeclaration(x: unknown): string[] {
  const errs: string[] = [];
  if (typeof x !== "object" || x === null || Array.isArray(x)) return ["nesne değil"];
  const o = x as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!(KEYS as readonly string[]).includes(k)) errs.push(`bilinmeyen alan: ${k}`);
  if (o.format !== NODE_DECLARATION_FORMAT) errs.push(`format "${NODE_DECLARATION_FORMAT}" olmalı`);
  if (typeof o.state !== "string" || !/^[A-Z]{2}$/.test(o.state)) errs.push("state: iki büyük harf (ISO 3166-1)");
  if (o.role !== "validator" && o.role !== "rpc") errs.push("role: validator | rpc");
  if (typeof o.node_public_key !== "string" || !/^[0-9a-f]{128}$/.test(o.node_public_key))
    errs.push("node_public_key: 128 küçük onaltılık karakter (04 öneki ve 0x olmadan)");
  if (typeof o.ip !== "string" || !(IPV4.test(o.ip) || (o.ip.includes(":") && IPV6.test(o.ip))))
    errs.push("ip: IPv4 ya da IPv6 değişmezi");
  if (!Number.isInteger(o.p2p_port) || (o.p2p_port as number) < 1 || (o.p2p_port as number) > 65535)
    errs.push("p2p_port: 1–65535");
  if (typeof o.contact !== "string" || o.contact.length > 254 || !CONTACT.test(o.contact))
    errs.push("contact: kurumun görev e-postası ya da https adresi");
  return errs;
}

/** Açık anahtardan düğüm adresi (QBFT doğrulayıcı adresi = düğüm anahtarının adresi). */
export const nodeAddressOf = (publicKeyHex: string) => computeAddress("0x04" + publicKeyHex).toLowerCase();

/** Besu enode URL'si: `enode://<anahtar>@<ip>:<port>` (IPv6 köşeli parantezde). */
export function enodeOf(d: Pick<NodeDeclaration, "node_public_key" | "ip" | "p2p_port">): string {
  const host = d.ip.includes(":") ? `[${d.ip.toLowerCase()}]` : d.ip;
  return `enode://${d.node_public_key}@${host}:${d.p2p_port}`;
}

/** Karşılaştırma için enode biçimi: küçük harf, sorgu (`?discport=…`) yok. */
export function normalizeEnode(enode: string): string {
  return enode.trim().toLowerCase().replace(/\?.*$/, "");
}

export interface ValidatorMember {
  code: string;
  validator: string;
  active: boolean;
}

export interface DeclarationMatch {
  /** izin listesine girecek enode'lar (sıralı değil; çizici sıralar) */
  validatorNodes: string[];
  ownNodes: string[];
  /** reddedilen bildirimler (yetki vermez; neden) */
  rejected: Array<{ file: string; reason: string }>;
  /** bildirimi olmayan aktif validator'lar (bağlantı kurulamaz; uyarı) */
  missing: string[];
}

/**
 * Eşleşme kuralı (ADR-0052 K2):
 *  - `validator`: `state` Governance'ta AKTİF üye ve açık anahtardan türeyen adres o üyenin `validatorAddress`'i → listeye girer;
 *    değilse reddedilir. Bir devletin birden çok validator bildirimi olamaz (Governance'ta devlet başına tek validator adresi).
 *  - `rpc`: yalnız `operator` (bu dosyayı üreten işletmecinin devlet kodu) ile aynı devletinse ve o devlet aktif üyeyse girer;
 *    öteki işletmecilerin listesine girmez (paylaşılan özet `shared_sha256` bunları içermez).
 *  - Aynı açık anahtar iki bildirimde → ikisi de reddedilir.
 */
export function matchDeclarations(
  decls: Array<{ file: string; decl: unknown }>,
  members: ValidatorMember[],
  operator: string | null,
): DeclarationMatch {
  const out: DeclarationMatch = { validatorNodes: [], ownNodes: [], rejected: [], missing: [] };
  const valid: Array<{ file: string; d: NodeDeclaration }> = [];
  for (const { file, decl } of decls) {
    const errs = validateNodeDeclaration(decl);
    if (errs.length) out.rejected.push({ file, reason: `şema: ${errs.join("; ")}` });
    else valid.push({ file, d: decl as NodeDeclaration });
  }
  const keyCount = new Map<string, number>();
  for (const { d } of valid) keyCount.set(d.node_public_key, (keyCount.get(d.node_public_key) ?? 0) + 1);
  const byCode = new Map(members.map((m) => [m.code, m]));
  const covered = new Set<string>();
  for (const { file, d } of valid) {
    if ((keyCount.get(d.node_public_key) ?? 0) > 1) {
      out.rejected.push({ file, reason: "aynı düğüm anahtarı birden çok bildirimde" });
      continue;
    }
    const m = byCode.get(d.state);
    if (!m || !m.active) {
      out.rejected.push({ file, reason: `${d.state} Governance'ta aktif üye değil` });
      continue;
    }
    if (d.role === "validator") {
      if (nodeAddressOf(d.node_public_key) !== m.validator.toLowerCase()) {
        out.rejected.push({ file, reason: `düğüm adresi ${d.state} validator adresiyle eşleşmiyor` });
        continue;
      }
      if (covered.has(d.state)) {
        out.rejected.push({ file, reason: `${d.state} için ikinci validator bildirimi` });
        continue;
      }
      covered.add(d.state);
      out.validatorNodes.push(enodeOf(d));
    } else if (operator && d.state === operator) out.ownNodes.push(enodeOf(d));
  }
  for (const m of members) if (m.active && !covered.has(m.code)) out.missing.push(m.code);
  out.missing.sort();
  out.rejected.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  return out;
}
