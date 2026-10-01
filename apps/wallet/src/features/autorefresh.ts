/**
 * ADR-0023: sessiz kopya yenileme — kilit açıkken, uygulama öne gelince. Eşiği aşan kurum belgelerine rastgele gecikme atanır
 * (`dueAt`); zamanı gelenler yenileme belirteciyle yenilenir. Sonuç en güncel duruma birleştirilir (kullanıcının bu sırada yaptığı
 * değişiklikler ezilmez). Ayarlardan kapatılabilir.
 */
import {
  autoRefreshCredential,
  fetchHttp,
  scheduleRefreshes,
  type StoredCredential,
  type WalletState,
} from "@tamga-network/wallet-core";
import { keys, randomBytes } from "@/platform";
import { ensureWua, keyAttestorOf } from "@/wallet";

export interface AutoRefreshOutcome {
  /** en güncel duruma uygulanacak dönüşüm */
  apply: (latest: WalletState) => WalletState;
  /** değişen alanlar (kullanıcıya gösterilir — ISSU_59) */
  changed: Array<{ credential: StoredCredential; fields: string[] }>;
}

/** Zamanlama + yenileme. Hiçbir şey yapılmadıysa null. */
export async function runAutoRefresh(state: WalletState): Promise<AutoRefreshOutcome | null> {
  if (state.settings.autoRefresh === false) return null;
  const now = Math.floor(Date.now() / 1000);
  const sch = scheduleRefreshes(state, now);
  const dueAt = new Map(
    sch.state.credentials.filter((c) => c.refresh?.dueAt !== undefined).map((c) => [c.id, c.refresh!.dueAt!]),
  );
  const steps: Array<(s: WalletState) => WalletState> = [];
  // 1) yeni zamanlamalar (dueAt) — belge hâlâ duruyorsa işlenir
  if (sch.state !== state)
    steps.push((s) => ({
      ...s,
      credentials: s.credentials.map((c) =>
        c.refresh && c.refresh.dueAt === undefined && dueAt.has(c.id)
          ? { ...c, refresh: { ...c.refresh, dueAt: dueAt.get(c.id) } }
          : c,
      ),
    }));
  const changed: AutoRefreshOutcome["changed"] = [];
  if (sch.due.length) {
    const ensured = await ensureWua(sch.state);
    let cur = ensured.state;
    if (ensured.state !== sch.state && ensured.state.wua) {
      const wua = ensured.state.wua;
      steps.push((s) => ({ ...s, wua }));
    }
    const wuaRec = cur.wua;
    if (wuaRec) {
      for (const id of sch.due) {
        const r = await autoRefreshCredential({
          state: cur,
          credentialId: id,
          keys,
          http: fetchHttp,
          wua: wuaRec,
          keyAttestor: keyAttestorOf(cur),
          randomBytes,
          now,
        });
        for (const k of r.removedKeyRefs) await keys.delete(k).catch(() => {});
        if (r.ok) {
          const neu = r.state.credentials.find((c) => c.id === r.newId)!;
          steps.push((s) => replaceCredential(s, id, neu));
          if (r.changed.length) changed.push({ credential: neu, fields: r.changed });
          cur = r.state;
        } else if (r.revoked) {
          // kurum reddetti (kayıt yok / belirteç geçersiz): bağ kalkar, kullanıcı bugünkü uyarı akışını görür
          steps.push((s) => ({ ...s, credentials: s.credentials.map((c) => (c.id === id ? dropRefresh(c) : c)) }));
          cur = r.state;
        }
      }
    }
  }
  if (!steps.length) return null;
  return { apply: (latest) => steps.reduce((s, f) => f(s), latest), changed };
}

const dropRefresh = (c: StoredCredential): StoredCredential => {
  const { refresh: _r, ...rest } = c;
  return rest;
};

/** Eski belgenin yerine yenisi: geçiş kartları ve sabitleme yeni kimliğe taşınır. */
function replaceCredential(s: WalletState, oldId: string, neu: StoredCredential): WalletState {
  if (!s.credentials.some((c) => c.id === oldId)) return s; // kullanıcı bu sırada sildiyse ekleme
  return {
    ...s,
    credentials: [...s.credentials.filter((c) => c.id !== oldId), neu],
    ...(s.passes
      ? { passes: s.passes.map((p) => (p.credentialId === oldId ? { ...p, credentialId: neu.id } : p)) }
      : {}),
    settings: {
      ...s.settings,
      ...(s.settings.pinned ? { pinned: s.settings.pinned.map((x) => (x === oldId ? neu.id : x)) } : {}),
    },
  };
}
