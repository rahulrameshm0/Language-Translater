export type AppRelease = {
  platform: "android" | "ios";
  version: string;
  build_number: number;
  download_url: string;
  notes: string;
};
export const CURRENT_BUILD = 3;
export function parseRelease(
  value: unknown,
  platform: string,
): AppRelease | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    row.platform !== platform ||
    typeof row.version !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(row.version) ||
    !Number.isSafeInteger(row.build_number) ||
    Number(row.build_number) < 1 ||
    typeof row.download_url !== "string"
  )
    return null;
  try {
    const url = new URL(row.download_url);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const expo =
      url.hostname === "expo.dev" &&
      url.pathname.startsWith("/artifacts/eas/") &&
      url.pathname.endsWith(".apk");
    const github =
      url.hostname === "github.com" &&
      url.pathname.startsWith(
        "/rahulrameshm0/vaylo-downloads/releases/download/",
      ) &&
      url.pathname.endsWith(".apk");
    if (platform === "android" && !expo && !github) return null;
    if (platform === "ios" && url.hostname !== "apps.apple.com") return null;
  } catch {
    return null;
  }
  return {
    ...row,
    notes: typeof row.notes === "string" ? row.notes : "",
  } as AppRelease;
}
export function isNewerRelease(release: AppRelease, currentBuild: number) {
  return release.build_number > currentBuild;
}
