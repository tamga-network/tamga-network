/**
 * ADR-0065: kapı terminalleri doğrulama servisine kimlik gösterir — terminal anahtarı (TK1–TK3). Anahtar bir terminal grubuna
 * bağlıdır; `POST /terminal/verify` yalnız `Authorization: Bearer <anahtar>` ile çağrılır ve geçiş kartı jetonu anahtarın
 * grubuna göre denetlenir. Sunucuda anahtarın yalnız SHA-256 özeti durur (`terminal-keys.json`; kişisel veri yok); anahtar yalnız
 * verildiği anda bir kez gösterilir. İşletmeci anahtarı yönetici ucundan verir ve iptal eder; yerel geliştirme ve sandbox için
 * ortamdan önceden yüklenen anahtarlar (`TAMGA_VERIFY_TERMINAL_KEYS="grup:anahtar,grup:anahtar"`, iptal edilemez, dosyaya yazılmaz).
 *
 * ADR-0069: anahtar kaydı grubun kurumunu (`owner`, imzalı listedeki `terminal_groups[].institution_id`) ve son kullanım anını
 * taşır; Kurum Konsolu yönetici uçlarını kuruma daraltılmış belirteçle çağırır (`institutionToken`) — kurum yalnız kendi
 * gruplarının anahtarlarını görür, verir ve iptal eder (TG2).
 *
 * Kapalı kalma (fail closed, 0.7.4): imzalı listede bir kez görülen grup kimlikleri dosyada tutulur (`listed_groups`). Böyle bir
 * grup ya da sahibi olan anahtar listede doğrulanamazsa (liste bayat ya da grup listeden çıkmış) kapı geçmez; grup listede
 * görünmeden önce işletmecinin verdiği sahipsiz anahtar, grup listeye girince grubun kurumuna bağlanır (`adoptOwner`).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface TerminalKeyRecord {
  id: string;
  terminalGroup: string;
  /** anahtarın SHA-256 özeti (base64url) — anahtarın kendisi tutulmaz */
  hash: string;
  label?: string;
  /** ADR-0069: grubun kurumu (listedeki `institution_id`); grup listede kurumsuzsa yok */
  owner?: string;
  createdAt: number;
  revokedAt?: number;
  /** son başarılı kapı isteği (saniye; en çok dakikada bir diske yazılır) */
  lastUsedAt?: number;
}
/** Dışa gösterilen kayıt (özet yok). */
export type TerminalKeyInfo = Omit<TerminalKeyRecord, "hash"> & { source: "issued" | "env" };

const GROUP_RE = /^[a-z0-9-]{1,40}$/;
const hashOf = (key: string) => createHash("sha256").update(key).digest("base64url");
/** Son kullanım anı en çok bu sıklıkta diske yazılır (her kapı okumasında dosya yazılmasın). */
const LAST_USED_SAVE_SEC = 60;

/**
 * ADR-0069 TG2: kuruma daraltılmış yönetici belirteci = base64url(HMAC-SHA256(yönetici belirteci, "tamga-terminal-keys/v1:" +
 * kurum)). Kurum Konsolu sunucu tarafında üretir ve `x-tamga-institution` + `x-institution-token` başlıklarıyla gönderir;
 * doğrulayıcı aynı formülle denetler. Belirteç yalnız o kurumun terminal anahtarı uçlarını açar.
 */
export function institutionToken(adminToken: string, institutionId: string): string {
  return createHmac("sha256", adminToken).update(`tamga-terminal-keys/v1:${institutionId}`).digest("base64url");
}

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
  /** imzalı listede en az bir kez görülen grup kimlikleri (kalıcı) */
  private listed = new Set<string>();

  /** `file` null → yalnız bellekte (test). `envSpec`: ortamdan yüklenen anahtarlar (sandbox / yerel). */
  constructor(
    private file: string | null,
    envSpec?: string,
  ) {
    if (file) {
      try {
        const j = JSON.parse(readFileSync(file, "utf8")) as { keys?: TerminalKeyRecord[]; listed_groups?: unknown };
        this.issued = Array.isArray(j.keys) ? j.keys : [];
        if (Array.isArray(j.listed_groups))
          for (const g of j.listed_groups) if (typeof g === "string" && GROUP_RE.test(g)) this.listed.add(g);
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
    writeFileSync(this.file, JSON.stringify({ keys: this.issued, listed_groups: [...this.listed].sort() }, null, 2));
  }
  /** Grup imzalı listede görüldü (kalıcı iz; bir daha listede doğrulanamazsa kapı kapalı kalır). */
  markListed(terminalGroup: string): void {
    if (!GROUP_RE.test(terminalGroup) || this.listed.has(terminalGroup)) return;
    this.listed.add(terminalGroup);
    this.save();
  }
  /** Grup hiç imzalı listede görüldü mü? */
  wasListed(terminalGroup: string): boolean {
    return this.listed.has(terminalGroup);
  }
  /**
   * Grup listeye kurumla girince, o gruba önceden (listesizken) verilmiş sahipsiz anahtarlar grubun kurumuna bağlanır: kurum
   * onları görür ve iptal eder, sonraki kurum değişikliğinde kapıda geçmezler (TG3). Ortam anahtarları dosyaya yazılmaz (değişmez).
   * Bağlanan kayıt sayısını döndürür.
   */
  adoptOwner(terminalGroup: string, owner: string): number {
    let n = 0;
    for (const r of this.issued)
      if (r.terminalGroup === terminalGroup && !r.owner && !r.revokedAt) {
        r.owner = owner;
        n++;
      }
    if (n) this.save();
    return n;
  }
  /** Yeni anahtar (bir kez gösterilir); grup biçimi K1 (politikalardaki `terminal_group`). */
  issue(
    terminalGroup: string,
    label?: string,
    now = Math.floor(Date.now() / 1000),
    owner?: string,
  ): { id: string; key: string } {
    if (!GROUP_RE.test(terminalGroup)) throw new Error("invalid terminal group");
    const key = `tk_${randomBytes(24).toString("base64url")}`;
    const id = randomBytes(6).toString("hex");
    this.issued.push({
      id,
      terminalGroup,
      hash: hashOf(key),
      ...(label ? { label: label.slice(0, 60) } : {}),
      ...(owner ? { owner } : {}),
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
  /** Tek kayıt (özet yok); yoksa null. */
  get(id: string): TerminalKeyInfo | null {
    return this.list().find((k) => k.id === id) ?? null;
  }
  /** Hiç anahtar var mı (etkin)? */
  get size() {
    return this.env.length + this.issued.filter((k) => !k.revokedAt).length;
  }
  /**
   * `Authorization: Bearer <anahtar>` → anahtarın grubu; yoksa/iptalse null. Karşılaştırma özet üzerinden ve sabit zamanlı;
   * bütün kayıtlar her seferinde dolaşılır (hangi anahtarın tutmadığı zamanlamadan okunmaz).
   */
  authenticate(
    header: string | string[] | undefined,
    now = Math.floor(Date.now() / 1000),
  ): { id: string; terminalGroup: string; owner?: string } | null {
    if (typeof header !== "string") return null;
    const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
    if (!m || m[1].length > 256) return null;
    const h = Buffer.from(hashOf(m[1]));
    let rec: TerminalKeyRecord | null = null;
    for (const r of [...this.env, ...this.issued]) {
      const ok = timingSafeEqual(h, Buffer.from(r.hash));
      if (ok && !r.revokedAt && !rec) rec = r;
    }
    if (!rec) return null;
    const prev = rec.lastUsedAt ?? 0;
    rec.lastUsedAt = now;
    if (now - prev >= LAST_USED_SAVE_SEC && this.issued.includes(rec)) this.save();
    return { id: rec.id, terminalGroup: rec.terminalGroup, ...(rec.owner ? { owner: rec.owner } : {}) };
  }
}
