import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { configured, supabase } from "./supabase";
import {
  AppRelease,
  CURRENT_BUILD,
  isNewerRelease,
  parseRelease,
} from "./releases";
export function useAppUpdate() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [status, setStatus] = useState<
    "checking" | "current" | "available" | "unavailable" | "error"
  >("checking");
  const lastCheck = useRef(0);
  const checking = useRef(false);
  const check = useCallback(async (force = false) => {
    if (
      !configured ||
      checking.current ||
      (!force && Date.now() - lastCheck.current < 60000)
    )
      return;
    checking.current = true;
    lastCheck.current = Date.now();
    setStatus("checking");
    try {
      const { data, error } = await supabase
        .from("app_releases")
        .select("platform,version,build_number,download_url,notes")
        .eq("platform", Platform.OS)
        .maybeSingle();
      if (error) throw error;
      const next = parseRelease(data, Platform.OS);
      setRelease(next);
      setStatus(
        !next
          ? "unavailable"
          : isNewerRelease(
                next,
                Number(Constants.nativeBuildVersion ?? CURRENT_BUILD),
              )
            ? "available"
            : "current",
      );
    } catch {
      setStatus("error");
    } finally {
      checking.current = false;
    }
  }, []);
  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void check();
    });
    return () => sub.remove();
  }, [check]);
  async function download() {
    if (release && parseRelease(release, Platform.OS))
      await Linking.openURL(release.download_url);
  }
  return { release, status, check, download };
}
