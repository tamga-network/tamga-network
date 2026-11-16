/**
 * ADR-0036 dış listeler — istemcinin özgün adrese doğrudan çekme yedeği (`externalListsDirect`, gerçek yükleyiciyle). Yayıncının
 * kopyası yoksa varsayılan davranış `list_url`'e gitmektir; `externalListsDirect: false` iken istemci Tamga dışı liste sunucusuna
 * hiç istek göndermez (o sunucu IP adresini ve zamanı göremez). Fikstürün LOTL'ı bir dış liste işaretçisi taşır.
 */
import { describe, expect, it } from "vitest";
import { fetchListTrustSource, resetListMonotonicity, verifyJws } from "@tamga-network/trust";

import { buildFixture } from "./fixture.js";

const BASE = "https://trust.test";

async function setup() {
  const f = await buildFixture();
  const files: Record<string, string> = {
    "lotl.jws": f.archive.lotl.at(-1)!,
    "tl-tr.jws": f.archive.national["tl-tr"].at(-1)!,
  };
  const calls: string[] = [];
  const http = async (url: string) => {
    calls.push(url);
    const body = url.startsWith(BASE) ? files[url.slice(BASE.length + 1)] : undefined;
    return { status: body ? 200 : 404, text: async () => body ?? "" };
  };
  return { f, http, calls };
}

describe("dış liste: özgün adrese doğrudan çekme yedeği", () => {
  it("varsayılan: yayıncının kopyası yoksa list_url denenir", async () => {
    const { f, http, calls } = await setup();
    resetListMonotonicity();
    await fetchListTrustSource(BASE, http, {
      rootFingerprints: f.archive.rootFingerprints,
      verifyJws,
      stateCode: "TR",
      now: f.now,
      externalLists: true,
      versionMemory: "none",
    });
    expect(calls).toContain(`${BASE}/external/eu-example-pid.jws`);
    expect(calls).toContain("https://lists.example/eu/pid.json");
  });

  it("externalListsDirect: false — yalnız yayıncının kopyası; Tamga dışı sunucuya istek yok", async () => {
    const { f, http, calls } = await setup();
    resetListMonotonicity();
    const { store } = await fetchListTrustSource(BASE, http, {
      rootFingerprints: f.archive.rootFingerprints,
      verifyJws,
      stateCode: "TR",
      now: f.now,
      externalLists: true,
      externalListsDirect: false,
      versionMemory: "none",
    });
    expect(calls).toContain(`${BASE}/external/eu-example-pid.jws`);
    expect(calls.every((u) => u.startsWith(BASE))).toBe(true);
    expect(store.national.has("TR")).toBe(true);
  });
});
