/**
 * TamgaBle yerel modülü — ISO 18013-5 BLE (mdoc peripheral server mode). Expo Go'da yoktur (`null`); yakın alan sunumu
 * mağaza/geliştirme derlemesinde çalışır. Olaylar: onState (0x01 başla / 0x02 bitir), onData (ham parça, base64),
 * onMtu, onDisconnect, onError.
 */
import { requireOptionalNativeModule } from "expo";

type EventSubscription = { remove(): void };

export interface NativeTamgaBle {
  start(serviceUuid: string): Promise<void>;
  send(chunkB64: string): Promise<void>;
  stop(): Promise<void>;
  addListener(event: "onState", cb: (e: { state: number }) => void): EventSubscription;
  addListener(event: "onData", cb: (e: { chunk: string }) => void): EventSubscription;
  addListener(event: "onMtu", cb: (e: { mtu: number }) => void): EventSubscription;
  addListener(event: "onDisconnect", cb: () => void): EventSubscription;
  addListener(event: "onError", cb: (e: { reason: string }) => void): EventSubscription;
}

export const TamgaBle = requireOptionalNativeModule<NativeTamgaBle>("TamgaBle");
