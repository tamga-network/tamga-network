/**
 * ÜRETİLEN DOSYA — elle düzenleme; `npm run pin:trust` (scripts/pin-trust.mjs).
 * Güven çapası (S-13): cüzdan LOTL imzasını YALNIZCA bu parmak izleriyle kabul eder; liste sunucusuna güvenmez.
 * Kaynak: apps/trust-publisher/dist/keys/root-fingerprints.json (tamga.network/trust-anchor ile aynı).
 */
import type { TrustPins } from "@tamga-network/wallet-core";

export const TRUST_PINS: TrustPins = {
  lotlSigners: ["7fd176d58fd3fba3bdea137374d6ae3dc8ffc8dcb9b645c2b08566464764fdc1"],
};
