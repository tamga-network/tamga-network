/**
 * Kapı (turnike) istatistikleri — kurum konsolu için yalnızca SAYILAR: gün × terminal grubu → kabul, red, red nedeni.
 * Kişi, geçiş kartı kimliği, saat damgası, cihaz TUTULMAZ (AP3; holder izlenemez): "kim geçti" sorusunun cevabı burada yoktur.
 * Gün, Türkiye saatine göre (UTC+3). Tüm geçmiş tutulur (satır başına birkaç sayı). Dosya: <dataDir>/gate-stats.json (atomik yazım).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface GateDay {
  day: string; // YYYY-AA-GG (UTC+3)
  group: string;
  accepted: number;
  rejected: number;
  reasons: Record<string, number>;
}

const dayOf = (ms: number) => new Date(ms + 3 * 3600_000).toISOString().slice(0, 10);

export class GateStats {
  private rows = new Map<string, GateDay>();
  private timer: NodeJS.Timeout | null = null;

  constructor(private file?: string) {
    if (file && existsSync(file)) {
      try {
        for (const r of JSON.parse(readFileSync(file, "utf8")) as GateDay[]) this.rows.set(`${r.day}|${r.group}`, r);
      } catch {
        /* bozuk dosya: sayaç sıfırdan başlar (yalnız istatistik) */
      }
    }
  }

  record(group: string, ok: boolean, reason?: string, now = Date.now()) {
    const day = dayOf(now);
    const key = `${day}|${group}`;
    const r = this.rows.get(key) ?? { day, group, accepted: 0, rejected: 0, reasons: {} };
    if (ok) r.accepted++;
    else {
      r.rejected++;
      const k = (reason ?? "bilinmiyor").slice(0, 60);
      r.reasons[k] = (r.reasons[k] ?? 0) + 1;
    }
    this.rows.set(key, r);
    this.schedule();
  }

  /** Son `days` gün (0 = tüm geçmiş), verilen gruplar (boşsa hepsi), yeni günden eskiye. */
  query(groups: string[], days = 14, now = Date.now()): GateDay[] {
    const from = days > 0 ? dayOf(now - (days - 1) * 86400_000) : "";
    return [...this.rows.values()]
      .filter((r) => r.day >= from && (!groups.length || groups.includes(r.group)))
      .sort((a, b) => (a.day === b.day ? a.group.localeCompare(b.group) : b.day.localeCompare(a.day)));
  }

  private schedule() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, 2000);
    this.timer.unref?.();
  }
  flush() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify([...this.rows.values()]));
    renameSync(tmp, this.file);
  }
}
