// Ağ deposunda Expo kurulu değil: tip denetimi için asgari bildirim. Uygulamada gerçek `expo-modules-core` (eş bağımlılık) kullanılır.
declare module "expo-modules-core" {
  export function requireOptionalNativeModule<T>(name: string): T | null;
}
