import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
export type ThemePreference = "system" | "light" | "dark";
const light = {
  bg: "#EEF2FA",
  surface: "#FFFFFF",
  secondary: "#EAF0FA",
  ink: "#14213D",
  muted: "#65738E",
  line: "#DCE5F2",
  accent: "#3157FF",
  accentText: "#FFFFFF",
  tint: "#EAF0FF",
  teal: "#087F78",
  tealTint: "#DFF6F0",
  error: "#AC293D",
  overlay: "rgba(10,22,40,0.55)",
  navBg: "#14213D",
  navSelected: "#2A3C60",
  navActive: "#58A6FF",
  navMuted: "#B8C5DF",
};
const dark = {
  bg: "#1C1C1E",
  surface: "#2C2C30",
  secondary: "#242427",
  ink: "#F6F6F8",
  muted: "#A9A9B0",
  line: "#414146",
  accent: "#58A6FF",
  accentText: "#0A1C34",
  tint: "#243954",
  teal: "#7DE3CD",
  tealTint: "#143D3C",
  error: "#FFADB8",
  overlay: "rgba(0,0,0,0.7)",
  navBg: "#1C1C1E",
  navSelected: "#273C57",
  navActive: "#58A6FF",
  navMuted: "#B8C5DF",
};
export type Colors = typeof light;
const ThemeContext = createContext({
  dark: false,
  colors: light,
  preference: "system" as ThemePreference,
  setPreference: (_value: ThemePreference) => {},
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const changed = useRef(false);
  const [preference, setState] = useState<ThemePreference>("dark");
  useEffect(() => {
    void SecureStore.getItemAsync("vaylo.theme")
      .then((value) => {
        if (
          !changed.current &&
          (value === "light" || value === "dark" || value === "system")
        )
          setState(value);
      })
      .catch(() => {});
  }, []);
  const isDark =
    preference === "dark" || (preference === "system" && system === "dark");
  function setPreference(value: ThemePreference) {
    changed.current = true;
    setState(value);
    void SecureStore.setItemAsync("vaylo.theme", value).catch(() => {});
  }
  return (
    <ThemeContext.Provider
      value={{
        dark: isDark,
        colors: isDark ? dark : light,
        preference,
        setPreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
