/**
 * Tema — tek kaynak (beceri: .claude/skills/wallet-ux §2). Varsayılan karanlık (mürekkep + altın); açık tema kağıt paleti.
 * Renk sabiti bileşen dışında yazılmaz; `useTheme()` ile alınır.
 */
import { createContext, useContext } from "react";

export interface Theme {
  mode: "dark" | "light";
  bg: string;
  surface: string;
  card: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  onAccent: string;
  danger: string;
  onDanger: string;
  success: string;
  info: string;
  warn: string;
  inputBg: string;
  tabBar: string;
}

export const DARK: Theme = {
  mode: "dark",
  bg: "#17110F",
  surface: "#221A17",
  card: "#2B221E",
  line: "#3A2F2A",
  text: "#F4EDE2",
  muted: "#B8ACA2",
  accent: "#C8A24C",
  onAccent: "#17110F",
  danger: "#B01E22",
  onDanger: "#FFFFFF",
  success: "#3C9A5F",
  info: "#4E8FB0",
  warn: "#D08A2E",
  inputBg: "#1E1714",
  tabBar: "#1C1512",
};

export const LIGHT: Theme = {
  mode: "light",
  bg: "#F4EDE2",
  surface: "#FBF6EE",
  card: "#FFFDF9",
  line: "#E3D9C8",
  text: "#17110F",
  muted: "#6B615B",
  accent: "#B8922F",
  onAccent: "#17110F",
  danger: "#B01E22",
  onDanger: "#FFFFFF",
  success: "#2E7D32",
  info: "#2A6F8E",
  warn: "#B26A00",
  inputBg: "#FFFFFF",
  tabBar: "#FFFDF9",
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { card: 20, button: 14, chip: 999, input: 14 } as const;
export const type = {
  display: { fontSize: 28, fontWeight: "700" as const, lineHeight: 34 },
  title: { fontSize: 22, fontWeight: "700" as const, lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: "700" as const, lineHeight: 22 },
  body: { fontSize: 16, fontWeight: "400" as const, lineHeight: 22 },
  secondary: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },
  mono: { fontSize: 12, fontFamily: "Courier", lineHeight: 16 },
} as const;

export const ThemeContext = createContext<Theme>(DARK);
export const useTheme = () => useContext(ThemeContext);
