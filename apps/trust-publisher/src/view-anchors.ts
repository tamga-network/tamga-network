/**
 * ADR-0074 K4 (PJ5) — çapa günlüğünün yeni satırları: kayıt sertifikası durum listesi (`registration_status`, ADR-0068) ve liste
 * görünümleri (`list_view`, ETSI TS 119 612 XML ve TS 119 602 LoTE, ADR-0066). SAF yardımcılar (dosya yok, ağ yok); cli.ts
 * yayın anında satırı bunlarla kurar ve imzalar.
 *
 * Sıra (K4): yükleyici bilinmeyen satır türünde DURUR. Bu yüzden satırlar, yeni türleri tanıyan paket sürümü yayımlanmadan
 * yazılmaz: yayın yalnız zincir projeksiyonu açıkken (`TAMGA_CHAIN_ENABLED=1`, ADR-0051 CH5 — üretimde kapalı) yapılır; satırların
 * tek tüketicisi zincir çapasıdır (`trust:chain-submit`). Zincir açılmadan önce paket sürümü yayımlanmış olur.
 */
import { sha256Tag, type Anchor } from "@tamga-network/trust";

type RegistrationStatusLine = Extract<Anchor, { kind: "registration_status" }>;
type ListViewLine = Extract<Anchor, { kind: "list_view" }>;
export type RegistrationStatusBody = Omit<RegistrationStatusLine, "seq" | "previous_hash" | "ts">;
export type ListViewBody = Omit<ListViewLine, "seq" | "previous_hash" | "ts">;

/** Yeni satır türleri yazılsın mı (ADR-0074 K4 sırası; yukarıdaki not). */
export const viewLinesEnabled = (env: NodeJS.ProcessEnv = process.env) => env.TAMGA_CHAIN_ENABLED === "1";

/**
 * Günlüğün güncel diliminde (baştaki kontrol noktasının durumu dahil) bu liste için son `list_version`; yoksa 0. Sayaç liste
 * başınadır ve yalnız artar (yükleyici geri gideni reddeder).
 */
export function lastRegistrationStatusVersion(payloads: Anchor[], listUri: string): number {
  let v = 0;
  for (const p of payloads) {
    if (p.kind === "checkpoint")
      for (const r of p.state?.registration_status ?? []) if (r.list_uri === listUri) v = Math.max(v, r.list_version);
    if (p.kind === "registration_status" && p.list_uri === listUri) v = Math.max(v, p.list_version);
  }
  return v;
}

/** Durum listesi yayını → satır gövdesi. `token` imzalı listenin kendisi (statuslist+jwt, compact). */
export function registrationStatusBody(
  payloads: Anchor[],
  listUri: string,
  token: string,
  publishedAt: Date,
): RegistrationStatusBody {
  return {
    kind: "registration_status",
    list_uri: listUri,
    content_hash: sha256Tag(new TextEncoder().encode(token)),
    list_version: lastRegistrationStatusVersion(payloads, listUri) + 1,
    published_at: publishedAt.toISOString(),
  };
}

/**
 * Görünüm yayını → satır gövdesi. `file` yayın kökündeki yol (`tl-tr.xml`, `lote/<tür>.jws`); `bytes` dosyanın baytları
 * (XML için `.sha2` ile aynı özet). Görünümün sürümü kaynak listenin sürümüdür (ADR-0066 K1).
 */
export function listViewBody(v: {
  file: string;
  format: ListViewBody["format"];
  sourceFile: string;
  sourceVersion: number;
  bytes: Uint8Array;
}): ListViewBody {
  return {
    kind: "list_view",
    file: v.file,
    format: v.format,
    source_file: v.sourceFile,
    source_version: v.sourceVersion,
    content_hash: sha256Tag(v.bytes),
  };
}

/**
 * TL12 anlık durum eki: verilen satırlardan (ve baştaki kontrol noktasının durumundan) liste başına son durum listesi satırı ve
 * dosya başına son görünüm satırı. Kontrol noktası bunları da taşır; arşiv okunmadan zincir çapası kurulabilir.
 */
export function viewSnapshotOf(payloads: Anchor[]) {
  const rs = new Map<
    string,
    NonNullable<NonNullable<Extract<Anchor, { kind: "checkpoint" }>["state"]>["registration_status"]>[number]
  >();
  const lv = new Map<
    string,
    NonNullable<NonNullable<Extract<Anchor, { kind: "checkpoint" }>["state"]>["list_views"]>[number]
  >();
  for (const p of payloads) {
    if (p.kind === "checkpoint") {
      for (const r of p.state?.registration_status ?? []) rs.set(r.list_uri, r);
      for (const r of p.state?.list_views ?? []) lv.set(r.file, r);
    } else if (p.kind === "registration_status") {
      const { list_uri, content_hash, list_version, published_at, seq } = p;
      rs.set(list_uri, { list_uri, content_hash, list_version, published_at, seq });
    } else if (p.kind === "list_view") {
      const { file, format, source_file, source_version, content_hash, seq } = p;
      lv.set(file, { file, format, source_file, source_version, content_hash, seq });
    }
  }
  return { registration_status: [...rs.values()], list_views: [...lv.values()] };
}
