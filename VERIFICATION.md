# Vaylo 1.2 verification

Current work adds a redesigned React Native workspace and live speech recognition with editable transcript review and explicit Confirm & translate. Android build 4, version 1.2.0. This requires a new native install; the previous APK cannot gain the speech-recognition module through a JavaScript refresh.

- TypeScript, Edge Function checks, formatting, and PostgreSQL migration/RLS tests pass.
- Twenty automated tests cover backend validation/auth/rate limits/provider handling and transcript interim replacement, continuous segments, empty finals, stop preservation, repeated phrases, Unicode and review edits. Native speech events are not exercised by these pure tests.
- No paid API or billing plan was added. Recognition uses the device speech service; only confirmed text goes to the existing Gemini translation endpoint.
- The backend is unchanged; the bounded audio endpoint remains for older APKs.
- Expo Doctor passes all 20 checks, and both Android/iOS Hermes bundles export successfully.
- Native Android/iOS microphone, actual partial-result delivery, speech language availability, keyboard layout and physical-device appearance still need acceptance testing. Armenian recognition depends on installed services/models. Speech permissions must be tested on both platforms.
- Prior account/email acceptance testing limitations remain: Supabase custom SMTP is needed for general-public signup delivery. iOS device distribution requires Apple signing credentials.
- npm reports 26 dependency advisories (21 high, 5 moderate). No incompatible forced framework changes were applied. Review supported upstream updates before production release.

See README.md for the device acceptance checklist and DESIGN.md for the visual design.
