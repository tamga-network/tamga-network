/**
 * LOTL ve ülke listelerinin ağ düzeyi kayıtları → `NetworkRegistry` kayıtları (ADR-0074 K3; SPEC-BC-0001 §16.5). SAF: yeniden oynatma
 * planı (yazım) ve eşdeğerlik testi (beklenen kayıt) aynı eşlemeyi kullanır. Serbest metin ve kişisel veri zincire gitmez (PJ2):
 * ad, not, adres, onay kaydı yalnız ayrıntı özetinde (`detailsHash`, RFC 8785 + SHA-256).
 *
 * | Liste | `kind` | `recordId` | öteki alanlar |
 * |---|---|---|---|
 * | `zk_circuits[]` | ZK_CIRCUIT | keccak256(circuit_id) | `subtype` sistem (1 = longfellow-libzk-v1), `flags` = sürüm ‖ öznitelik sayısı (sürüm << 32), `fingerprint` dosya SHA-256; `note` yazılmaz |
 * | `external_lists[]` | EXTERNAL_LIST | keccak256(list_id) | `region` ülke / EU, `subtype` biçim (1 LoTE JSON, 2 TL XML), `flags` kapsam (aşağıda), `digests` imzacı parmak izleri + keccak256(tür) + keccak256("recognized_by:" ‖ ülke); adres, işletmeci adı ve onay → `detailsHash` |
 * | `eaa_categories` | EAA_CATEGORY | keccak256(kod) | etiket → `detailsHash` |
 * | imzacılar | LIST_SIGNER | keccak256("tamga:signer:" ‖ parentId ‖ ":" ‖ amaç ‖ ":" ‖ parmak izi) | `parentId` liste anahtarı (LOTL ya da `tl-<cc>`), `subtype` amaç (1 çapa / LOTL, 2 JSON liste, 3 XML liste), `fingerprint`, geçerlilik (liste `valid_to` dahil → +1 sn) |
 * | `operator` | LIST_OPERATOR | liste anahtarı | durum PROVISIONAL / DESIGNATED; ad + `on_behalf_of` → `detailsHash` |
 * | `national_lists[]` | STATE_SLOT | keccak256("tamga:slot:" ‖ ülke) | `region` ülke, `subtype` üyelik (1 TDT_MEMBER, 2 TDT_OBSERVER); `list_url` → `detailsHash` |
 * | `national_lists[].roles` | ROLE_SLOT | keccak256("tamga:slot:" ‖ ülke ‖ ":" ‖ rol) | `parentId` devlet slotu; rol bloğu (durum hariç) → `detailsHash` |
 * | `catalogue` | CATALOGUE | keccak256("catalogue") | adres → `detailsHash` |
 *
 * İmzacı ve rol kimlikleri listeyi de içerir: aynı anahtar birden çok listeyi imzalayabilir, aynı rol her ülkede vardır (`recordId`
 * tür başına tektir). Listeden kalkan kayıt silinmez, `RETIRED` yazılır.
 */
import type { Lotl, NationalList } from "@tamga-network/trust";

import { ZERO32, bytes2, detailsHash, fpToBytes32, keccakText, sec } from "./ids.js";
import type { NetworkRecordArgs } from "./replay-plan.js";

export const NetKind = {
  WALLET_PROVIDER: 1,
  WALLET_PROVIDER_KEY: 2,
  ZK_CIRCUIT: 3,
  EXTERNAL_LIST: 4,
  EAA_CATEGORY: 5,
  LIST_SIGNER: 6,
  LIST_OPERATOR: 7,
  STATE_SLOT: 8,
  ROLE_SLOT: 9,
  CATALOGUE: 10,
} as const;
export const NET_KIND_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(NetKind).map(([k, v]) => [v, k.toLowerCase()]),
);
export const NET_STATUS = {
  ACTIVE: 1,
  SUSPENDED: 2,
  REVOKED: 3,
  RETIRED: 4,
  RESERVED: 5,
  PROVISIONAL: 6,
  DEPRECATED: 7,
  DESIGNATED: 8,
} as const;

/** Kapalı kümeler (1 tabanlı; 0 = belirtilmemiş). Yalnız sona eklenir. */
export const ZK_SYSTEMS = ["longfellow-libzk-v1"] as const;
export const EXTERNAL_FORMATS = ["etsi-lote-json", "etsi-tl-xml"] as const;
export const SIGNER_PURPOSES = ["anchor", "json-list", "xml-list"] as const;
export const MEMBERSHIPS = ["TDT_MEMBER", "TDT_OBSERVER"] as const;
export const EXTERNAL_ROLES = ["wallet_provider", "pid_provider", "eaa_provider", "access_ca"] as const;
const ASSURANCES = ["I1", "I2", "I3"];
const CLASSES = ["PUB", "QUALIFIED", "EAA"];
const CATEGORIES = ["GOVERNMENT", "IDENTITY", "EDUCATION", "HEALTH", "FINANCE", "LOGISTICS", "OTHER", "EVENTS"];
const KEY_STORAGES = ["software", "tee", "secure_enclave", "strongbox", "wscd"];
const idx1 = (xs: readonly string[], x: string | undefined) => (x === undefined ? 0 : xs.indexOf(x) + 1);

/** Liste anahtarı (TrustListAnchorRegistry ile aynı: keccak256("tamga:trust-list:<ortam>:<dosya>")). */
export const listKeyOf = (environment: string, file: string) => keccakText(`tamga:trust-list:${environment}:${file}`);
export const stateSlotIdOf = (cc: string) => keccakText(`tamga:slot:${cc}`);
export const roleSlotIdOf = (cc: string, role: string) => keccakText(`tamga:slot:${cc}:${role}`);
export const signerIdOf = (parentId: string, purpose: number, fp: string) =>
  keccakText(`tamga:signer:${parentId}:${purpose}:${fp.toLowerCase()}`);

const statusOf = (s: string | undefined) => NET_STATUS[(s ?? "") as keyof typeof NET_STATUS] ?? 0;
const rec = (
  r: Partial<NetworkRecordArgs> & Pick<NetworkRecordArgs, "kind" | "recordId" | "status">,
): NetworkRecordArgs => ({
  parentId: ZERO32,
  region: "0x0000",
  subtype: 0,
  validFrom: 0,
  validUntil: 0,
  fingerprint: ZERO32,
  detailsHash: ZERO32,
  flags: "0",
  digests: [],
  ...r,
});

type Key = { fingerprint_sha256: string; status?: string; valid_from?: string; valid_to?: string };
const signer = (parentId: string, purpose: number, k: Key) =>
  rec({
    kind: NetKind.LIST_SIGNER,
    recordId: signerIdOf(parentId, purpose, k.fingerprint_sha256),
    parentId,
    subtype: purpose,
    status: statusOf(k.status ?? "ACTIVE"),
    validFrom: k.valid_from ? sec(k.valid_from) : 0,
    // liste `valid_to` dahil; zincir yarı açık → bir saniye sonrası (cüzdan sağlayıcı anahtarlarıyla aynı kural)
    validUntil: k.valid_to ? sec(k.valid_to) + 1 : 0,
    fingerprint: fpToBytes32(k.fingerprint_sha256),
  });
const operatorRecord = (listKey: string, op: { name: string; status: string; on_behalf_of?: string } | undefined) =>
  op &&
  rec({
    kind: NetKind.LIST_OPERATOR,
    recordId: listKey,
    status: op.status === "designated" ? NET_STATUS.DESIGNATED : NET_STATUS.PROVISIONAL,
    detailsHash: detailsHash({ name: op.name, on_behalf_of: op.on_behalf_of }),
  });

/** Bir kaydın listedeki yerini gösteren kısa ad (uyarı ve eşdeğerlik raporu için). */
export interface NamedRecord {
  what: string;
  record: NetworkRecordArgs;
}

/** LOTL'un ağ düzeyi kayıtları (cüzdan sağlayıcılar hariç — onlar ayrı yazılır). Durumu zincirde yazılamayan kayıt uyarıyla atlanır. */
export function lotlNetworkRecords(l: Lotl, environment: string, warnings: string[] = []): NamedRecord[] {
  const out: NamedRecord[] = [];
  const add = (what: string, r: NetworkRecordArgs | undefined) => {
    if (!r) return;
    if (r.status === 0) warnings.push(`ağ düzeyi kayıt ${what}: durum zincirde yok — yazılmadı`);
    else out.push({ what, record: r });
  };
  const lotlKey = listKeyOf(environment, "lotl");
  add("operator:lotl", operatorRecord(lotlKey, l.operator));
  if (l.catalogue)
    add(
      "catalogue",
      rec({
        kind: NetKind.CATALOGUE,
        recordId: keccakText("catalogue"),
        status: NET_STATUS.ACTIVE,
        detailsHash: detailsHash({ url: l.catalogue.url }),
      }),
    );
  for (const k of l.anchor_signing_keys) add(`signer:lotl:${k.fingerprint_sha256.slice(0, 12)}`, signer(lotlKey, 1, k));
  for (const [code, label] of Object.entries(l.eaa_categories ?? {}).sort(([a], [b]) => a.localeCompare(b)))
    add(
      `eaa_category:${code}`,
      rec({
        kind: NetKind.EAA_CATEGORY,
        recordId: keccakText(code),
        status: NET_STATUS.ACTIVE,
        detailsHash: detailsHash({ label }),
      }),
    );
  for (const c of l.zk_circuits ?? [])
    add(
      `zk_circuit:${c.circuit_id.slice(0, 12)}`,
      rec({
        kind: NetKind.ZK_CIRCUIT,
        recordId: keccakText(c.circuit_id),
        subtype: idx1(ZK_SYSTEMS, c.system),
        status: statusOf(c.status),
        fingerprint: fpToBytes32(c.sha256),
        flags: ((BigInt(c.version) << 32n) | BigInt(c.attributes)).toString(),
      }),
    );
  for (const x of l.external_lists ?? []) {
    const s = x.scope;
    const roles = s.entity_kinds.reduce((m, k) => m | (1 << EXTERNAL_ROLES.indexOf(k)), 0);
    // kapsam bit alanı: rol maskesi | güvence << 8 | sınıf << 16 | kategori << 24 | en az anahtar deposu << 32 (1 tabanlı)
    const flags =
      BigInt(roles) |
      (BigInt(idx1(ASSURANCES, s.assurance)) << 8n) |
      (BigInt(idx1(CLASSES, s.class)) << 16n) |
      (BigInt(idx1(CATEGORIES, s.category)) << 24n) |
      (BigInt(idx1(KEY_STORAGES, s.min_key_storage)) << 32n);
    add(
      `external_list:${x.list_id}`,
      rec({
        kind: NetKind.EXTERNAL_LIST,
        recordId: keccakText(x.list_id),
        region: bytes2(x.territory),
        subtype: idx1(EXTERNAL_FORMATS, x.format),
        status: statusOf(x.status),
        validFrom: sec(x.approval.approved_at),
        detailsHash: detailsHash({ list_url: x.list_url, operator: x.operator.name, approval_ref: x.approval.ref }),
        flags: flags.toString(),
        digests: [
          ...x.signing_keys.map((k) => fpToBytes32(k.fingerprint_sha256)),
          ...(s.vct ?? []).map(keccakText),
          ...(s.recognized_by ?? []).map((cc) => keccakText(`recognized_by:${cc}`)),
        ],
      }),
    );
  }
  for (const n of [...l.national_lists].sort((a, b) => a.state_code.localeCompare(b.state_code))) {
    const cc = n.state_code;
    const slot = stateSlotIdOf(cc);
    const membership = idx1(MEMBERSHIPS, n.membership);
    if (n.membership && !membership)
      warnings.push(`slot ${cc}: üyelik türü ${n.membership} kapalı kümede yok — 0 yazıldı`);
    add(
      `state_slot:${cc}`,
      rec({
        kind: NetKind.STATE_SLOT,
        recordId: slot,
        region: bytes2(cc),
        subtype: membership,
        status: statusOf(n.status),
        detailsHash: detailsHash({ list_url: n.list_url }),
      }),
    );
    for (const [role, block] of Object.entries(n.roles ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      const { status, ...rest } = (block ?? {}) as { status?: string } & Record<string, unknown>;
      add(
        `role_slot:${cc}:${role}`,
        rec({
          kind: NetKind.ROLE_SLOT,
          recordId: roleSlotIdOf(cc, role),
          parentId: slot,
          status: statusOf(status),
          detailsHash: detailsHash(rest),
        }),
      );
    }
    const tlKey = listKeyOf(environment, `tl-${cc.toLowerCase()}`);
    for (const k of n.signing_keys ?? [])
      add(`signer:tl-${cc}:json:${k.fingerprint_sha256.slice(0, 12)}`, signer(tlKey, 2, k));
    for (const k of n.xml_signing_keys ?? [])
      add(`signer:tl-${cc}:xml:${k.fingerprint_sha256.slice(0, 12)}`, signer(tlKey, 3, k));
  }
  return out;
}

/** Ülke listesinin işletmecisi (listenin kendi `operator` alanı; ADR-0070). */
export function nationalNetworkRecords(tl: NationalList, environment: string): NamedRecord[] {
  const r = operatorRecord(listKeyOf(environment, `tl-${tl.state_code.toLowerCase()}`), tl.operator);
  return r ? [{ what: `operator:tl-${tl.state_code}`, record: r }] : [];
}
