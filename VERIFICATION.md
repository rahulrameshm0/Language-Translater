# LingoBridge 1.6.2 verification

Version 1.6.2 / build 10 guards audio lifecycle cleanup, selects more natural installed voices, restores speech rate to 0.95 and adds the reference-inspired full-screen speaking layout.

- TypeScript and 42 automated tests pass, including installed-voice ranking. Android/iOS exports pass.
- Audio-player hook source confirms automatic release on unmount; the extra unguarded cleanup pause was removed. Recorder cleanup now handles synchronous released-object errors as well as promise rejection.
- Actual components were visually checked in an isolated phone-width harness with synthetic chat data. Reply review, feedback, follow-up and microphone dock render correctly. Harness fixtures are excluded from the repository and native APK.
- No physical-device crash log or native reproduction was available. Crash resolution, actual microphone playback and perceived voice naturalness require phone acceptance testing; browser TTS output failed in the harness.

## Previous 1.6.1 verification

Speaking now uses one selected conversation language for recording transcription, AI replies and feedback. AI/read-aloud speech rate is 0.8; recorded-reply replay is unchanged. TypeScript and Android/iOS Hermes exports pass. Existing 1.6 authentication, provider and database tests are unchanged. Physical-device speech speed and output still need acceptance testing.

## Previous 1.6 verification

Version 1.6.0 / build 8 adds a real AI language Assistant and conversational speaking with recorded replies, attached feedback and follow-up questions.

- TypeScript, backend checks, 41 automated tests and embedded PostgreSQL checks pass. Android/iOS Hermes exports pass.
- Live Gemini checks with synthetic Spanish text returned an opening, correction, specific feedback and a contextual follow-up. Full authenticated mobile audio end-to-end testing remains outstanding.
- The conversation migration and rolled-back cross-account read/update/delete/insert and anonymous-access assertions passed on hosted Supabase. The updated function is deployed.
- Actual React Native screens were reviewed at constrained phone width in a temporary web harness. Its synthetic provider fixtures are outside the repo/APK. Browser TTS reported an output error; physical-device recording/TTS, audio routing and background behavior still require acceptance.
- Conversation audio is replayable during the current screen session and is not persisted to Supabase. Saved chats retain text/feedback only.
- No new paid service or in-app updater. Existing SMTP, dependency advisory and iOS distribution limitations below remain.

## Previous 1.5 verification

Version 1.5.0 / native build 7 adds the reference-inspired charcoal interface, earphone turn translation, private vocabulary study and guided speaking practice. The package ID and signing key are retained.

- TypeScript, formatting, backend checks, 37 automated tests and PostgreSQL/PGlite migration tests pass. Expo Doctor passes 20/20. Android and iOS Hermes exports pass.
- The learning/speaking migration was applied to hosted Supabase. Rolled-back hosted assertions passed for owner reads/writes, cross-account isolation, protected scheduling/progress and anonymous RPC denial.
- Practice tests cover Unicode, locale-aware matching, Chinese/Japanese characters, scenario catalog and phrase limits. Recognition feedback compares text, not acoustic pronunciation.
- Earphone playback uses OS-selected media output with real installed voices; phone recognition produces the editable transcript. Hardware routing, speech delivery, permissions, background handling and keyboard behavior require Android/iOS physical-device acceptance. No native device/emulator test was performed here.
- Visual checks use the actual React Native components in an isolated web harness. Preview auth/data fixtures stay outside the repo and APK.
- No new paid provider or update mechanism was added. Free plan quotas still apply. Existing custom SMTP and iOS distribution requirements remain.
- Known dependency audit: 26 advisories (21 high, 5 moderate); no incompatible forced framework upgrades were applied.

## Previous 1.4 verification

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
