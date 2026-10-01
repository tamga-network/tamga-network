/** Bileşen sözlüğü — haptics (ui/index.tsx'ten bölündü, 2026-09-27; beceri wallet-ux §3). */
import * as Haptics from "expo-haptics";

export const tap = () => {
  void Haptics.selectionAsync().catch(() => {});
};

export const hapticSuccess = () => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

export const hapticError = () => {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
};
