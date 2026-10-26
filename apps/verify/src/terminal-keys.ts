/**
 * ADR-0065: kapı terminalleri doğrulama servisine kimlik gösterir — terminal anahtarı (TK1–TK3). Anahtar bir terminal grubuna
 * bağlıdır; `POST /terminal/verify` yalnız `Authorization: Bearer <anahtar>` ile çağrılır ve geçiş kartı jetonu anahtarın
 * grubuna göre denetlenir. Sunucuda anahtarın yalnız SHA-256 özeti durur (`terminal-keys.json`; kişisel veri yok); anahtar yalnız
 * verildiği anda bir kez gösterilir. İşletmeci anahtarı yönetici ucundan verir ve iptal eder; yerel geliştirme ve sandbox için
 * ortamdan önceden yüklenen anahtarlar (`TAMGA_VERIFY_TERMINAL_KEYS="grup:anahtar,grup:anahtar"`, iptal edilemez, dosyaya yazılmaz).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface TerminalKeyRecord {
  id: string;
  terminalGroup: string;
  /** anahtarın SHA-256 özeti (base64url) — anahtarın kendisi tutulmaz */
  hash: string;
  label?: string;
  createdAt: number;
  revokedAt?: number;
}
/** Dışa gösterilen kayıt (özet yok). */
export type TerminalKeyInfo = Omit<TerminalKeyRecord, "hash"> & { source: "issued" | "env" };

const GROUP_RE = /^[a-z0-9-]{1,40}$/;
const hashOf = (key: string) => createHash("sha256").update(key).digest("base64url");

/** `grup:anahtar,grup:anahtar` → kayıtlar (biçimsiz parça atlanır; boş dize → hiç). */
export function parseEnvTerminalKeys(spec: string | undefined): Array<{ terminalGroup: string; key: string }> {
  if (!spec) return [];
  const out: Array<{ terminalGroup: string; key: string }> = [];
  for (const part of spec.split(",")) {
    const i = part.indexOf(":");
    if (i <= 0) continue;
    const terminalGroup = part.slice(0, i).trim();
    const key = part.slice(i + 1).trim();
    if (GROUP_RE.test(terminalGroup) && key.length >= 8) out.push({ terminalGroup, key });
  }
  return out;
}

export class TerminalKeyRegistry {
  private issued: TerminalKeyRecord[] = [];
  private env: TerminalKeyRecord[] = [];

  /** `file` null → yalnız bellekte (test). `envSpec`: ortamdan yüklenen anahtarlar (sandbox / yerel). */
  constructor(
    private file: string | null,
    envSpec?: string,
  ) {
    if (file) {
      try {
        const j = JSON.parse(readFileSync(file, "utf8")) as { keys?: TerminalKeyRecord[] };
        this.issued = Array.isArray(j.keys) ? j.keys : [];
      } catch {
        this.issued = [];
      }
    }
    this.env = parseEnvTerminalKeys(envSpec).map((e, i) => ({
      id: `env-${i + 1}`,
      terminalGroup: e.terminalGroup,
      hash: hashOf(e.key),
      label: "env",
      createdAt: 0,
    }));
  }
  private save() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify({ keys: this.issued }, null, 2));
  }
  /** Yeni anahtar (bir kez gösterilir); grup biçimi K1 (politikalardaki `terminal_group`). */
  issue(terminalGroup: string, label?: string, now = Math.floor(Date.now() / 1000)): { id: string; key: string } {
    if (!GROUP_RE.test(terminalGroup)) throw new Error("invalid terminal group");
    const key = `tk_${randomBytes(24).toString("base64url")}`;
    const id = randomBytes(6).toString("hex");
    this.issued.push({
      id,
      terminalGroup,
      hash: hashOf(key),
      ...(label ? { label: label.slice(0, 60) } : {}),
      createdAt: now,
    });
    this.save();
    return { id, key };
  }
  /** İptal: anahtar bir daha geçmez (kayıt kalır). Ortam anahtarı iptal edilemez → false. */
  revoke(id: string, now = Math.floor(Date.now() / 1000)): boolean {
    const r = this.issued.find((k) => k.id === id);
    if (!r) return false;
    r.revokedAt ??= now;
    this.save();
    return true;
  }
  list(): TerminalKeyInfo[] {
    const strip = (r: TerminalKeyRecord, source: TerminalKeyInfo["source"]): TerminalKeyInfo => {
      const { hash: _h, ...rest } = r;
      return { ...rest, source };
    };
    return [...this.env.map((r) => strip(r, "env")), ...this.issued.map((r) => strip(r, "issued"))];
  }
  /** Hiç anahtar var mı (etkin)? */
  get size() {
    return this.env.length + this.issued.filter((k) => !k.revokedAt).length;
  }
  /**
   * `Authorization: Bearer <anahtar>` → anahtarın grubu; yoksa/iptalse null. Karşılaştırma özet üzerinden ve sabit zamanlı;
   * bütün kayıtlar her seferinde dolaşılır (hangi anahtarın tutmadığı zamanlamadan okunmaz).
   */
  authenticate(header: string | string[] | undefined): { id: string; terminalGroup: string } | null {
    if (typeof header !== "string") return null;
    const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
    if (!m || m[1].length > 256) return null;
    const h = Buffer.from(hashOf(m[1]));
    let hit: { id: string; terminalGroup: string } | null = null;
    for (const r of [...this.env, ...this.issued]) {
      const ok = timingSafeEqual(h, Buffer.from(r.hash));
      if (ok && !r.revokedAt && !hit) hit = { id: r.id, terminalGroup: r.terminalGroup };
    }
    return hit;
  }
}
