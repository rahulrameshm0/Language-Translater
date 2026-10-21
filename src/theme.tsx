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
  bg: "#F3F6FC",
  surface: "#FFFFFF",
  secondary: "#EAF0FA",
  ink: "#14243D",
  muted: "#64748C",
  line: "#DCE5F2",
  accent: "#235CEB",
  accentText: "#FFFFFF",
  tint: "#EAF0FF",
  teal: "#087D72",
  tealTint: "#DFF6F0",
  error: "#AC293D",
  overlay: "rgba(10,22,40,0.55)",
};
const dark = {
  bg: "#0A1323",
  surface: "#142139",
  secondary: "#1D2D48",
  ink: "#EFF4FF",
  muted: "#A6B6D0",
  line: "#2A3D5B",
  accent: "#93B8FF",
  accentText: "#0B2349",
  tint: "#20385D",
  teal: "#7DE3CD",
  tealTint: "#143D3C",
  error: "#FFADB8",
  overlay: "rgba(0,0,0,0.7)",
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
  const [preference, setState] = useState<ThemePreference>("system");
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
