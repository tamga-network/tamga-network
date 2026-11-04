/**
 * Sandbox geçmiş temizliği (ADR-0038 K5 "sandbox verileri her an sıfırlanabilir", SB5) — `cli.ts history-reset`.
 *
 * Sandbox yayın klasörü (`dist-sandbox/`) zamanla eski test kayıtlarının adlarını taşıyan geçmiş biriktirir: eski liste
 * sürümleri (`archive/<liste>.vNNNN.{jws,xml}`), herkese açık CHANGELOG satırları, durum dosyasının arşiv kopyaları
 * (`archive/wrprc-status.<zaman>.json`) ve iptal edilmiş kayıt sertifikalarının yayın yolları. Temizlik yalnız GEÇMİŞE dokunur:
 *   - güncel imzalı listeler (`lotl`, `tl-<cc>`, XML görünümü, LoTE'ler) ve sürüm numaraları DEĞİŞMEZ — cüzdan ve doğrulayıcıların
 *     sürüm belleği (TL2) ve bir sonraki sürümün `previous_version_hash` bağı korunur;
 *   - her listenin arşivde yalnız son (güncel) sürümü kalır;
 *   - kayıt sertifikası durum listesinin bitleri DEĞİŞMEZ (iptal iptal kalır, geçerli geçerli); yalnız yayımlanmayan iptal
 *     girdilerinin yolu adsızlaşır (`redactRetiredWrprcPaths`);
 *   - çapa günlüğüne ve arşivlerine (`archive/anchors-*.jsonl`) dokunulmaz: satırlarda ad yok (issuer_id = keccak256(ülke,
 *     sha256(sertifika))), kontrol noktası zinciri arşivlere bağlıdır; günlük zaten gece sıfırlamasında yeniden başlar.
 * Yalnız sandbox kayıt defteriyle ve adı "sandbox" içeren yayın klasöründe çalışır; gerçek ağda reddedilir.
 */

/** Sürümlü arşiv dosyası: `<taban>.v<sürüm>.<uzantı>` (ör. `tl-tr.v0042.jws`, `lote-issuers.v0007.jws`, `tl-tr.v0042.xml`). */
const VERSIONED = /^(.+)\.v(\d+)\.(jws|xml)$/;
/** Durum dosyasının arşiv kopyası (ADR-0068). */
const WRPRC_STATE_COPY = /^wrprc-status\..+\.json$/;

export interface ArchivePrunePlan {
  /** silinecek dosyalar (arşiv klasörüne göre ad) */
  remove: string[];
  /** her taban + uzantı için kalan (son) sürüm */
  kept: string[];
}

/**
 * Arşiv klasörü için silme planı: her `<taban>.<uzantı>` için yalnız en yüksek sürüm kalır; durum dosyası kopyalarının hepsi
 * silinir (komut güncel durumu yeniden arşivler). Çapa arşivleri ve tanınmayan dosyalar plana girmez (dokunulmaz).
 */
export function planArchivePrune(files: readonly string[]): ArchivePrunePlan {
  const latest = new Map<string, { v: number; f: string }>();
  for (const f of files) {
    const m = VERSIONED.exec(f);
    if (!m) continue;
    const key = `${m[1]}\u0000${m[3]}`;
    const v = Number(m[2]);
    const cur = latest.get(key);
    if (!cur || v > cur.v) latest.set(key, { v, f });
  }
  const kept = new Set([...latest.values()].map((x) => x.f));
  const remove = files.filter((f) => (VERSIONED.test(f) && !kept.has(f)) || WRPRC_STATE_COPY.test(f));
  return { remove: [...remove].sort(), kept: [...kept].sort() };
}

/** CHANGELOG'un geçmiş temizliği satırı (yalnız bu biçimdeki satırlar "temizlik sonrası" sayılır). */
export const HISTORY_RESET_MARK = "history reset (sandbox, ADR-0038 K5)";

/** CHANGELOG yalnız başlıktan ve temizlik satırlarından mı oluşuyor (yeniden yazmak gereksiz)? */
export function changelogIsReset(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.startsWith("- "));
  return lines.length > 0 && lines.every((l) => l.includes(HISTORY_RESET_MARK));
}
