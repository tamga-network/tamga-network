/**
 * Yakın alan sunumu (P4-3; ISO/IEC 18013-5 BLE): yerel TamgaBle modülünü wallet-core'un `ProximityTransport`'una bağlar.
 * Expo Go'da modül yoktur → `proximityAvailable` false; ekran bunu söyler. Android 12+ çalışma anı izinleri burada istenir.
 */
import { PermissionsAndroid, Platform } from "react-native";
import { b64, b64Decode, type ProximityTransport } from "@tamga-network/wallet-core";
import { TamgaBle } from "../../modules/tamga-ble";

export const proximityAvailable = TamgaBle != null;

/** Android 12+: BLUETOOTH_ADVERTISE + BLUETOOTH_CONNECT. iOS izni ilk yayında sistem sorar. */
export async function ensureBlePermission(): Promise<boolean> {
  if (Platform.OS !== "android" || Number(Platform.Version) < 31) return true;
  const r = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
  return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
}

export function bleTransport(): ProximityTransport {
  const ble = TamgaBle;
  if (!ble) throw new Error("BLE module not available");
  return {
    start: (uuid) => ble.start(uuid),
    send: (chunk) => ble.send(b64(chunk)),
    stop: () => ble.stop(),
    onChunk: (cb) => {
      const s = ble.addListener("onData", (e) => cb(b64Decode(e.chunk)));
      return () => s.remove();
    },
    onMtu: (cb) => {
      const s = ble.addListener("onMtu", (e) => cb(e.mtu));
      return () => s.remove();
    },
    onClose: (cb) => {
      const subs = [
        ble.addListener("onDisconnect", () => cb("disconnected")),
        ble.addListener("onError", (e) => cb(e.reason)),
        // okuyucu State karakteristiğine 0x02 yazdı: oturum bitti
        ble.addListener("onState", (e) => e.state === 0x02 && cb("reader ended")),
      ];
      return () => subs.forEach((s) => s.remove());
    },
  };
}
