# Verification

Current Android release: **Vaylo 1.0.1 (version code 2)**, build `2b5f4916-9b45-410a-abbc-0f0d4c957cc8`. Earlier APK links below are historical.

## Passed locally

- TypeScript: `npm run typecheck`.
- Eleven Deno tests: `npm test`; all six translation directions, Unicode character counting, invalid input, missing/invalid authentication, rate limiting, provider errors/timeouts, verified history ownership, history-save warnings, Gemini quota exhaustion, missing configuration, and blocked/truncated/malformed model responses. External services are mocked in these backend HTTP integration tests.
- Edge Function type check: `npm run check:function`.
- PostgreSQL migration and policy tests: `npm run test:database`. The embedded PostgreSQL engine executes the actual migration and SQL assertions, including cross-account read/delete isolation, owner deletion, denied client inserts and rate-limit RPC access, and the 30-request limit. The test harness supplies a minimal Supabase Auth schema and roles.
- Formatting: `npm run format:check`.
- Expo dependency compatibility: `EXPO_NO_TELEMETRY=1 npx expo install --check` passed against Expo's bundled dependency map. The online well-known-versions endpoint was unavailable in the sandbox.
- iOS and Android JavaScript/Hermes bundle export: `EXPO_NO_TELEMETRY=1 npx expo export --platform ios --platform android`.

## Not yet verified

The Supabase project `mejnwvewnrdkzkagqxdc` is now configured. The history tables, RLS policies, and rate limiter were applied successfully through the SQL editor. The `translate` function is deployed with custom user-token verification, and its Gemini secret is stored in Supabase. A live unauthenticated request returned HTTP 401 with the function’s sign-in error. Email confirmation is enabled, password minimum is eight characters, and both mobile callback URLs are saved. Expo project `e77aa483-7ec9-46b6-a208-3fa02ab82b7d` is linked, with preview environment variables configured. Live registration/email links, SMTP delivery, authenticated end-to-end translation, and cross-device history still require acceptance testing. The default Supabase email sender may restrict delivery to organization members until custom SMTP is configured.

Native device/emulator smoke tests have not run. This environment has Xcode Command Line Tools but no configured full Xcode installation; Android device tooling was not configured. Bundle export is not a signed native build or a device test.

## Dependency audit limitation

The online npm audit reports **32 advisories: 21 high and 11 moderate** in dependency chains involving Expo CLI, Metro, Jest tooling, xcode/uuid, node-forge, braces, and sprintf-js. Compatible `npm audit fix` was attempted; these advisories remain. npm's proposed forced changes include Expo 44 or React Native 0.88, outside this Expo 55 application's supported version set. No forced downgrade or incompatible framework upgrade was applied.

Recheck and resolve these advisories against the supported Expo dependency matrix before production release. The subsequent offline lockfile synchronization reported zero vulnerabilities because audit data was unavailable offline; that is not a clean security audit.

## Android cloud build

Expo build `7b95979e-f636-4541-a844-f5d5eaa4df23` was started for the preview environment and Android APK distribution. The user approved creating the signing keystore, which Expo generated and stores. Backend secrets are excluded from the source upload. A live direct Gemini test returned a completed English-to-Malayalam translation. This does not yet verify the complete authenticated mobile flow.

## Completed Android APK

Expo build `7b95979e-f636-4541-a844-f5d5eaa4df23` finished successfully. APK: https://expo.dev/artifacts/eas/YiyaPzsc_ez2KTnPu8xxlVM5XCJfAwOCx5U-nY3udbE.apk

APK ZIP container header verification: passed. The Expo artifact endpoint rejected a HEAD request. Device smoke testing and the full authenticated mobile flow remain outstanding.

The first cloud build reported duplicate copies of `expo-constants` at the same version. The duplicates were removed by making expo-constants an explicit dependency and deduplicating the installation. Expo Doctor subsequently passed all 20 checks. Corrected cloud build: `708cd1cd-18d6-41e3-8c04-e9999e7968b6`. The first APK is superseded.

The database assertions in `tests/database.sql` also completed successfully against hosted Supabase through its SQL editor. All fixtures ran inside a transaction ending in ROLLBACK.

## Final recommended Android download

Corrected build `708cd1cd-18d6-41e3-8c04-e9999e7968b6` finished successfully. All 20 Expo Doctor checks passed locally before submission. Final APK: https://expo.dev/artifacts/eas/TaEKszGyvpGe7KrObvmnoTpb9f0TXknu8dx_Uvb2V_M.apk

The final artifact returned a successful partial GET and its ZIP/APK container header was verified. Native device acceptance testing remains outstanding. This is a preview build; custom SMTP is still needed for general-public email signup delivery beyond Supabase’s default sender restrictions.

## Verified branded APK

- Download: https://expo.dev/artifacts/eas/S1ZjADLrXqWeMqLAAUYAh2BPi2fJsOM97-up6g7X1E0.apk
- Build completed successfully; Expo Doctor passed all 20 checks.
- Downloaded the APK and inspected it with Google’s official aapt2. The compiled package reports application-label `Vaylo`, versionName `1.0.1`, versionCode `2`, and package `com.threewords.translator`.
- Extracted and visually inspected the APK’s actual launcher icon; it matches the Vaylo speech-shape design.
- Retained the existing signing key and package identifier for an in-place upgrade.
- Updated Expo’s project display name and icon to match.
- APK SHA-256: `ff559990864454fc515bc581060dad7e9916778ed905f2b37bb2ebaa577fa7a5`.
- These checks verify package contents; on-device UI and email acceptance tests remain outstanding.
