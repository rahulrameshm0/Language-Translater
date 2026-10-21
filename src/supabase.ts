import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(url && key && !url.includes("YOUR_PROJECT"));
// Chunk sessions because native secure storage has a per-value size limit.
const storage = {
  async getItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.count`));
    if (!count) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.getItemAsync(`${key}.${i}`),
      ),
    );
    return chunks.some((v) => v === null) ? null : chunks.join("");
  },
  async setItem(key: string, value: string) {
    await storage.removeItem(key);
    const chunks = value.match(/[\s\S]{1,1000}/g) ?? [];
    for (let i = 0; i < chunks.length; i++)
      await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
    await SecureStore.setItemAsync(`${key}.count`, String(chunks.length));
  },
  async removeItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.count`));
    for (let i = 0; i < count; i++)
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    await SecureStore.deleteItemAsync(`${key}.count`);
  },
};
export const supabase = createClient(
  url || "https://unconfigured.supabase.co",
  key || "unconfigured",
  {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
