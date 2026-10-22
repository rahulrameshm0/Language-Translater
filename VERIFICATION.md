# LingoBridge 1.4 verification

Version 1.4.0 / native build 6 adds document/audio/call-recording import, voice clip recording, reviewed extraction, TXT export and new translation-related branding. Old package identifiers and signing key are retained.

- TypeScript, Edge Function checks, formatting, and PostgreSQL migration/RLS tests pass.
- Thirty-three automated tests cover backend validation/auth/rate limits/provider handling and transcript interim replacement, continuous segments, empty finals, stop preservation, repeated phrases, Unicode and review edits. Native speech events are not exercised by these pure tests.
- No paid API or billing plan was added. Recognition uses the device speech service; only confirmed text goes to the existing Gemini translation endpoint.
- The live backend allowlist and hosted database constraints support 30 languages (870 pairs). Legacy Malayalam history remains intact.
- Automated tests check catalog consistency, search, RTL detection and all 870 HTTP pairs using mocked provider output. Translation quality for every live pair is not verified.
- The actual React Native components were visually reviewed at 390×844 and 320×740 in an isolated temporary web harness. Arabic native-name search and selection work. Harness auth/voice fixtures are outside the repo and APK; native microphone tests remain outstanding.
- Expo Doctor passes all 20 checks, and both Android/iOS Hermes bundles export successfully.
- Native Android/iOS microphone, actual partial-result delivery, speech language availability, keyboard layout and physical-device appearance still need acceptance testing. Armenian recognition depends on installed services/models. Speech permissions must be tested on both platforms.
- Prior account/email acceptance testing limitations remain: Supabase custom SMTP is needed for general-public signup delivery. iOS device distribution requires Apple signing credentials.
- npm reports 26 dependency advisories (21 high, 5 moderate). No incompatible forced framework changes were applied. Review supported upstream updates before production release.

See README.md for the device acceptance checklist and DESIGN.md for the visual design.

New tests cover PDF/audio extraction without history writes, invalid authentication, shared rate limits, provider failures, oversized/empty/truncated results, file signatures and sizes, DOCX XML/entity extraction and decompression bounds, unsupported formats and source metadata validation. External provider responses are mocked. Native microphone, picker, playback and sharing need device acceptance tests. PDF/audio provider quality and full authenticated file upload still need live acceptance testing.

All 33 tests passed after adding source metadata. Expo Doctor passed 20/20 and Android/iOS Hermes bundle exports passed. The hosted source-history migration completed successfully.

The media-capable translate function has been deployed on hosted Supabase. Visual review covered Docs, Audio and Calls at phone size using an isolated component harness. The harness is not shipped in the native app.
