/**
 * Cüzdan sağlayıcı durumu (ADR-0025): birim kayıtları (birim anahtarı parmak izi → açık anahtar, çözüm, sürüm, iptal) ve iptal
 * listeleri. Kişisel veri yok (WIA2). Tek JSON dosyası, atomik yazma; pilot hacmi için yeterli.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { JWK } from "jose";
import { IndexAllocator, MIN_CAPACITY, StatusBitstring, StatusValue, type KeyStorage } from "@tamga-network/issuer";

/** KA iptali tür başına ortak giriş (TS3 Seçenek 1). */
export const KA_TYPE_INDEX: Record<KeyStorage, number> = {
  software: 0,
  secure_enclave: 1,
  strongbox: 2,
  wscd: 3,
  tee: 4,
};

export interface UnitRecord {
  jwk: JWK;
  solution_id: string;
  app_version: string;
  platform: string;
  storage: KeyStorage;
  created_at: number;
  revoked_at?: number;
  wia_idx: number[];
  /** P4-2: doğrulanmış cihaz kanıtı (kişi verisi yok) */
  device?: { platform: "android" | "ios"; verified_at: number; details?: Record<string, unknown> };
}
interface State {
  units: Record<string, UnitRecord>;
  wia_bits: string; // base64
  wia_used: number[];
  ka_bits: string;
}

export class WpStore {
  wiaBits: StatusBitstring;
  kaBits: StatusBitstring;
  private alloc: IndexAllocator;
  private constructor(
    private file: string | null,
    private s: State,
  ) {
    this.wiaBits = new StatusBitstring(
      MIN_CAPACITY,
      s.wia_bits ? new Uint8Array(Buffer.from(s.wia_bits, "base64")) : undefined,
    );
    this.kaBits = new StatusBitstring(
      MIN_CAPACITY,
      s.ka_bits ? new Uint8Array(Buffer.from(s.ka_bits, "base64")) : undefined,
    );
    this.alloc = new IndexAllocator(MIN_CAPACITY, s.wia_used);
  }
  /** `dir` yoksa yalnız bellekte (test). */
  static async open(dir: string | null): Promise<WpStore> {
    let file: string | null = null;
    let s: State = { units: {}, wia_bits: "", wia_used: [], ka_bits: "" };
    if (dir) {
      mkdirSync(dir, { recursive: true });
      file = resolve(dir, "wp-state.json");
      if (existsSync(file)) s = JSON.parse(readFileSync(file, "utf8")) as State;
    }
    return new WpStore(file, s);
  }
  private async save() {
    this.s.wia_bits = Buffer.from(this.wiaBits.bytes).toString("base64");
    this.s.ka_bits = Buffer.from(this.kaBits.bytes).toString("base64");
    this.s.wia_used = this.alloc.snapshot();
    if (!this.file) return;
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.s), { mode: 0o600 });
    renameSync(tmp, this.file);
  }
  unit(id: string): UnitRecord | undefined {
    return Object.prototype.hasOwnProperty.call(this.s.units, id) ? this.s.units[id] : undefined;
  }
  async addUnit(id: string, u: UnitRecord) {
    this.s.units[id] = u;
    await this.save();
  }
  /** Doğrulanmış cihaz kanıtıyla anahtar deposu seviyesi güncellenir. */
  async setUnitDevice(id: string, storage: KeyStorage, device: NonNullable<UnitRecord["device"]>) {
    const u = this.unit(id);
    if (!u) return;
    u.storage = storage;
    u.device = device;
    await this.save();
  }
  /** Yeni, rastgele WIA girişi; birime kaydedilir (iptal için). */
  async allocateWia(unitId: string): Promise<number> {
    const idx = this.alloc.allocate();
    this.s.units[unitId].wia_idx.push(idx);
    await this.save();
    return idx;
  }
  /** Birim + bütün WIA girişleri iptal (WIA2). Dönen: iptal edilen giriş sayısı. */
  async revokeUnit(unitId: string, now: number): Promise<number> {
    const u = this.unit(unitId);
    if (!u) return 0;
    u.revoked_at ??= now;
    for (const i of u.wia_idx) this.wiaBits.set(i, StatusValue.INVALID);
    await this.save();
    return u.wia_idx.length;
  }
  /**
   * Kişinin silme isteği: birim iptal edilir (bütün WIA bitleri INVALID), sonra kaydı (açık anahtar, sürüm, cihaz kanıtı
   * bilgisi) tamamen silinir. İptal listesinde yalnız bitler kalır; ayrılmış indeksler yeniden kullanılmaz (bağlanamazlık).
   */
  async deleteUnit(unitId: string, now: number): Promise<number> {
    const n = await this.revokeUnit(unitId, now);
    if (!this.unit(unitId)) return n;
    delete this.s.units[unitId];
    await this.save();
    return n;
  }
  async setKaType(storage: KeyStorage, v: StatusValue) {
    this.kaBits.set(KA_TYPE_INDEX[storage], v);
    await this.save();
  }
  counts() {
    const units = Object.values(this.s.units);
    return { units: units.length, revoked_units: units.filter((u) => u.revoked_at).length };
  }
}
