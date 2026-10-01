/** Bileşen sözlüğü — styles (ui/index.tsx'ten bölündü, 2026-09-27; beceri wallet-ux §3). */
import { StyleSheet } from "react-native";
import { radius, space } from "./theme";

export const st = StyleSheet.create({
  btn: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnText: { fontSize: 16, fontWeight: "700" },
  card: { borderRadius: radius.card, padding: space.lg, gap: 6 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.chip,
    alignSelf: "flex-start",
  },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8, borderBottomWidth: 1 },
  input: { borderWidth: 1, borderRadius: radius.input, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.chip,
    borderWidth: 1,
    minHeight: 36,
  },
  key: { width: 72, height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
