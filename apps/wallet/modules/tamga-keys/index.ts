/**
 * TamgaKeys yerel modülü (donanım anahtarları). Expo Go'da yoktur (`null`) — uygulama yazılım anahtarına düşer (sapma S-9).
 * Mağaza/geliştirme derlemesinde: iOS Secure Enclave, Android StrongBox ya da TEE.
 */
import { requireOptionalNativeModule } from "expo";

import type { NativeKeyBackend } from "@tamga-network/wallet-core";

export const TamgaKeys = requireOptionalNativeModule<NativeKeyBackend>("TamgaKeys");
