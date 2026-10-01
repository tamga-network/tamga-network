/**
 * Derleme türüne göre yapılandırma (P4-5). `app.json` temel; EAS profili `APP_VARIANT` verir (eas.json):
 *  - development: geliştirme derlemesi (Expo Dev Client) — ayrı paket kimliği (mağaza sürümüyle yan yana kurulur),
 *    App Attest "development" ortamı. wallet-provider'da: TAMGA_WP_DEVICE_DEV=1,
 *    TAMGA_WP_ANDROID_PACKAGE=network.tamga.wallet.dev, TAMGA_WP_APPLE_APP_ID=<TEAM>.network.tamga.wallet.dev
 *  - preview: iç dağıtım (TestFlight / APK), mağaza paket kimliği, App Attest "production"
 *  - production: mağaza
 * Expo Go'da ve yerel `expo start`'ta APP_VARIANT yoksa app.json olduğu gibi kullanılır.
 */
import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT;
  const base = config as ExpoConfig;
  if (variant !== "development") return base;
  return {
    ...base,
    name: `${base.name} (Dev)`,
    ios: {
      ...base.ios,
      bundleIdentifier: `${base.ios?.bundleIdentifier}.dev`,
      entitlements: {
        ...base.ios?.entitlements,
        "com.apple.developer.devicecheck.appattest-environment": "development",
      },
    },
    android: { ...base.android, package: `${base.android?.package}.dev` },
  };
};
