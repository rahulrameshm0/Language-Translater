import { parseRelease, isNewerRelease } from "../src/releases.ts";
function assert(value: unknown): asserts value {
  if (!value) throw new Error("Assertion failed");
}
const row = {
  platform: "android",
  version: "1.2.0",
  build_number: 4,
  download_url:
    "https://github.com/rahulrameshm0/vaylo-downloads/releases/download/v1.2.0/Vaylo-1.2.0.apk",
  notes: "New version",
};
Deno.test(
  "update compares native build numbers, not lexical version strings",
  () => {
    const release = parseRelease(row, "android");
    assert(release);
    assert(isNewerRelease(release, 3));
    assert(!isNewerRelease(release, 4));
    assert(!isNewerRelease(release, 5));
  },
);
Deno.test(
  "update links reject unrelated hosts, cleartext, credentials and wrong platforms",
  () => {
    for (const download_url of [
      "http://expo.dev/artifacts/eas/file.apk",
      "https://evil.example/file.apk",
      "https://expo.dev.evil.example/artifacts/eas/file.apk",
      "https://user:secret@expo.dev/artifacts/eas/file.apk",
      "https://github.com/other/repo/releases/download/v1/app.apk",
    ])
      assert(parseRelease({ ...row, download_url }, "android") === null);
    assert(parseRelease(row, "ios") === null);
    assert(parseRelease({ ...row, build_number: -1 }, "android") === null);
    assert(parseRelease({ ...row, build_number: 1.5 }, "android") === null);
  },
);
Deno.test(
  "release accepts official Expo artifacts and handles missing rows",
  () => {
    assert(
      parseRelease(
        { ...row, download_url: "https://expo.dev/artifacts/eas/file.apk" },
        "android",
      ),
    );
    assert(parseRelease(null, "android") === null);
  },
);
