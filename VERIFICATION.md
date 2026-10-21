# Verification — Vaylo 1.1.0

Upgrade: English, Spanish, Armenian, and German; text and voice translation; light/dark/system themes; keyboard-aware input; release notices and APK downloads.

## Passed

- TypeScript (`npm run typecheck`), formatting, and Edge Function type checking.
- All 17 Deno tests: twelve language directions, Unicode bounds, audio validation/transcription, silence/overlong transcripts, authentication, atomic rate-limit handling, provider errors/timeouts/quota, malformed/blocked/truncated responses, history-save warnings, and safe release URL/build-number handling. External Auth, database, and provider responses are mocked in these tests.
- PostgreSQL tests execute both actual migrations and RLS assertions in PGlite: account isolation, owner deletion, denied client history inserts and rate-limit RPC calls, the 30-request limit, Armenian/German history, anonymous release discovery, and denied release writes.
- Both migrations applied to hosted Supabase. New `tests/releases.sql` assertions also ran successfully in the hosted SQL editor in a rolled-back transaction. Earlier ownership/rate-limit SQL assertions passed on the hosted database.
- Updated authenticated text/audio Edge Function deployed through Supabase dashboard. Explicit user-token verification remains required; legacy gateway JWT verification remains disabled for publishable-key compatibility.
- Expo Doctor: 20/20 checks passed. Compatible Expo 55 dependencies installed and deduplicated.
- Android and iOS Hermes bundles exported successfully, including the voice/keyboard native-module JavaScript integrations.

## Live service checks

A real synthetic English recording was successfully transcribed by Gemini and translated into German: “Hallo, wie geht es dir heute?” A hosted request without a user token returned HTTP 401 with the function’s sign-in message. Direct Armenian text checks timed out on this connection, so live Armenian quality is not yet verified. These checks do not establish the complete authenticated mobile flow.

## Acceptance testing still needed

Physical Android/iOS testing is outstanding: keyboard visibility with each keyboard, microphone permission/recording lifecycle, speaker output, dark-mode appearance, large text, and native Armenian glyphs. Read-aloud depends on voices installed on the device; Armenian may be unavailable. An Android cloud build verifies compilation, not microphone or keyboard behavior.

Live registration, email confirmation/reset deep links, session restoration, authenticated mobile translation, and cross-device history need device acceptance testing. Supabase's default email sender restricts general-public delivery; configure custom SMTP before public signup. iOS signing/installable distribution needs Apple credentials and is not included in this Android delivery.

Voice recordings are capped at 30 seconds on-device and bounded by payload size server-side. Only source transcript and translated text are stored in PostgreSQL. The provider receives submitted audio. The app deletes its local recording after successful translation or discard, preserves it for retries after errors, and stops recording when backgrounded.

## Release process

Version 1.1.0 is Android build 3. The existing package ID and Expo-managed signing key are reused. The old 1.0.1 APK has no update checker; install 1.1.0 manually once. Later builds compare the hosted `app_releases.build_number` with the native build and offer a download. Android retains control of installation approval.

Only publish release metadata after verifying the APK download. Source remains private in `rahulrameshm0/vaylo`; APK releases are public in `rahulrameshm0/vaylo-downloads`.

## Dependency audit limitation

The existing online npm audit reports 32 advisories (21 high, 11 moderate) in Expo/Metro/tooling dependency chains. Compatible fixes were attempted earlier; forced Expo 44/React Native 0.88 changes would break the supported Expo 55 matrix and were not applied. Recheck supported upstream releases before production distribution. An offline audit result is not evidence that these advisories are resolved.
