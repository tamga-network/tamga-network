/** Ortak .env okuyucu — yorum, boşluk, sıra önceliği, ortamı ezmeme, olmayan dosya. */
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadDotenv } from "./dotenv.js";

const dir = mkdtempSync(resolve(tmpdir(), "tamga-dotenv-"));
const file = (name: string, body: string) => {
  const p = resolve(dir, name);
  writeFileSync(p, body);
  return p;
};

describe("loadDotenv", () => {
  it("AD=değer satırlarını okur; yorum ve boşluk atılır; küçük harfli ad yok sayılır", () => {
    const env: NodeJS.ProcessEnv = {};
    loadDotenv(
      file("a.env", "# baş yorum\r\nTAMGA_A = bir  # satır sonu\nTAMGA_B=\nlower=x\n  TAMGA_C=http://h:1/x\n"),
      env,
    );
    expect(env).toEqual({ TAMGA_A: "bir", TAMGA_B: "", TAMGA_C: "http://h:1/x" });
  });

  it("ortamda tanımlı değeri ezmez; zincirde ilk dosya kazanır; olmayan dosya sessizce atlanır", () => {
    const env: NodeJS.ProcessEnv = { TAMGA_X: "ortam" };
    for (const p of [
      resolve(dir, "yok.env"),
      file("app.env", "TAMGA_X=app\nTAMGA_Y=app\n"),
      file("root.env", "TAMGA_Y=root\nTAMGA_Z=root\n"),
    ])
      loadDotenv(p, env);
    expect(env).toEqual({ TAMGA_X: "ortam", TAMGA_Y: "app", TAMGA_Z: "root" });
  });
});
