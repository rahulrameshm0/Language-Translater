# LingoBridge

![LingoBridge icon](assets/lingobridge-icon.png)

Android APKs are distributed from this app’s [Expo builds page](https://expo.dev/accounts/rahulrameshm0-threewords/projects/three-words-translator/builds). Open a completed Android preview build and choose Install / Download.

Android and iOS text and voice translator with 30 languages. Includes light, dark, and system themes, a keyboard-aware translation workspace, and manual APK installation. Expo + TypeScript, Supabase Auth/PostgreSQL, and Gemini 3.5 Flash-Lite on its free API tier. There is no demo login, local database substitute, or fake translation fallback.

## Start

Requirements: Node 22 LTS or newer, npm, Deno 2 for backend tests, Supabase CLI for deployment, and Xcode/Android Studio for local native builds.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and fill in your Supabase project URL and publishable key from the project Connect dialog. Only these public values belong in the app.
3. Run `npx expo install --check`, then `npm start`.
4. For full email-link authentication use a development build: `npm run ios` or `npm run android`. Expo Go does not register this app's custom URL scheme.

The unconfigured app displays a setup message. It does not pretend to authenticate or translate. App text remains in memory until a successful translation is saved. No offline translation is supported.

## Supabase: real PostgreSQL and authentication

1. Create a Supabase account and hosted project on the **Free** plan; save the database password securely.
2. Install the Supabase CLI using its official installation instructions. Run `supabase login`, `supabase link --project-ref YOUR_PROJECT_REF`, then `supabase db push` from this directory. The migration creates history, ownership policies, and an atomic per-user rate limiter.
3. In Authentication → Providers enable email/password, require email confirmation, and set the minimum password length to 8 or higher.
4. In Authentication → URL Configuration set the site URL to `threewords://auth/callback` and allow both `threewords://auth/callback` and `threewords://auth/reset`. These settings must be applied to the hosted project; the local config does not update hosted Auth settings automatically.
5. Keep confirmation/recovery email templates using Supabase's `{{ .ConfirmationURL }}` links. PKCE links must open on the device that requested the email. A reset email redirects to `/auth/reset`; confirmation redirects to `/auth/callback`.
6. For production, configure a custom SMTP sender and verified domain in Authentication → SMTP Settings. Configure SPF/DKIM with your email service and test confirmation/reset delivery. Supabase's default sender is for initial testing and has delivery restrictions.

Auth owns user credentials. The public history table references `auth.users`; it stores no passwords. Authenticated clients have SELECT/DELETE permission only, scoped by `auth.uid()`. Inserts and the rate-limit RPC are restricted to the backend service role. The Edge Function verifies each bearer token with Supabase Auth before any translation API request. Gateway JWT verification is disabled intentionally to support publishable keys; this never bypasses the function's explicit user-token verification.

## Free-tier Gemini setup and deployment

1. Open [Google AI Studio](https://aistudio.google.com/apikey) and create a Gemini API key for a **Free-tier project without a linked paid billing account**. Do not enable Google Cloud Translation or upgrade billing for this setup. Free-tier eligibility and quotas depend on your account/region.
2. Copy `supabase/.env.example` to `supabase/.env` and replace the placeholder with your Gemini key. This file is ignored by Git. Never use an `EXPO_PUBLIC_` variable for this secret.
3. Run `supabase secrets set --env-file supabase/.env`, then `supabase functions deploy translate`. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically.
4. Configure the two public Supabase values in the root `.env`, start the app, and test a translation. No paid translation-provider fallback is configured. A depleted free quota returns a retry-later message.
5. If switching an already deployed version, remove the unused previous key with `supabase secrets unset GOOGLE_TRANSLATE_API_KEY` after deploying, and revoke that old key in Google Cloud if no other app uses it.

The backend uses the [Gemini generateContent REST API](https://ai.google.dev/api/generate-content), with a separate translation instruction and JSON output schema. It rejects blocked, truncated, malformed, and empty output before saving history. The fixed model is `gemini-3.5-flash-lite`, currently listed with free input/output on [Google's pricing page](https://ai.google.dev/gemini-api/docs/pricing). Recheck model availability and free-tier eligibility when deploying; the API cannot tell this app whether you have enabled paid billing. Keep the project on the Free tier to prevent paid API usage. Supabase also has free-plan limits; check [its pricing](https://supabase.com/pricing) before public release.

The function accepts `{text, sourceLanguage, targetLanguage}` and returns `{originalText, translatedText, historyRecordId, warning}`. Voice requests use `{audioBase64, mimeType, sourceLanguage, targetLanguage}` instead of text, with MP4/M4A audio bounded to 2.1 MB in the client and base64 length 2,800,000 on the server. The 30 language codes are defined in `src/languages.ts`; automated tests verify they match the backend allowlist. Malayalam is no longer offered for new translations; previous Malayalam history remains readable and deletable. Empty text, identical languages, and inputs exceeding 5,000 Unicode code points are rejected. Each verified user gets 30 requests per UTC calendar minute, including failed provider requests. Limits are atomic across function instances and reset at the next minute boundary. Gemini requests time out after 45 seconds. Failed history writes return the translation with a warning and a null history ID.

In version 1.2, reviewed text is sent to Google Gemini and the source text plus translation are saved to the user's Supabase history. Live speech uses the phone's recognition service; see the live-speech section below. The legacy audio endpoint remains available for older clients. Audio is not stored in PostgreSQL. Read-aloud uses installed device voices; some devices have no Armenian voice. Google's Gemini free-tier content may be used to improve its products; avoid sensitive text. AI translations can be inaccurate, so test your chosen languages’ quality before relying on them. Users can delete individual records. Choose service regions, retention, and privacy terms appropriate to your deployment before public distribution.

## Builds

The default application identifiers are `com.threewords.translator`. Change both identifiers in `app.json` to identifiers you own before distribution.

- Local: `npm run ios` (macOS + Xcode) or `npm run android` (Android SDK + emulator/device).
- EAS preview: `npx eas-cli login`, `npx eas-cli build:configure`, then `npx eas-cli build --profile preview --platform android` or `--platform ios`. iOS device builds require Apple signing credentials.
- Supply the two `EXPO_PUBLIC_SUPABASE_*` variables in the EAS environment used for the build (`preview` for the preview profile). They are compiled into the application. The build hook rejects missing or placeholder configuration so the download does not open a setup-only app. Android preview builds explicitly produce an installable APK. Backend files and secrets are excluded from build uploads via `.easignore`.
- The optional EAS development profile requires `npx expo install expo-dev-client` before use. Preview builds do not require it.

App-store submission and service-account provisioning are not automated by this repository.

## Verification

- `npm run typecheck`
- `npm test`: input validation plus backend HTTP integration tests with mocked external Auth, database, and Google responses. These do not claim to verify hosted services.
- `npm run check:function`
- `npm run test:database`: executes the actual migration and SQL assertions on embedded PostgreSQL (PGlite), with minimal Supabase Auth schema/roles supplied by the harness.
- `npx expo export --platform ios --platform android`: bundles both native targets without signing.
- Database integration: start a local Supabase stack with `supabase start`, apply migrations with `supabase db reset`, then run `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/database.sql` using the local PostgreSQL connection from `supabase status`. Fixtures and assertions run in a rolled-back transaction. Use a development database, not production.

Device acceptance checklist after service configuration:

1. Register two accounts; confirm email links on the requesting device. Confirm unverified users cannot sign in.
2. Sign in, restart the app, and confirm the session restores. Send a password reset, open the link, update the password, sign out, and sign in using the new password. Test expired links.
3. Translate in all 870 directions, including Armenian input/output and emoji. Copy results, swap languages, and reopen a history record.
4. Create more than 20 records; load more and refresh. Delete a record. Confirm the other account sees none of the first account's history.
5. Disable networking; confirm input survives failures. Exercise a provider error, the minute limit, and a failed history write in a development environment; verify the result remains visible for the latter.
6. Check keyboard behavior, large system text, screen-reader labels, and Armenian glyph rendering on both Android and iOS.

Live authentication, email delivery, Gemini translation quality, hosted database tests, and device smoke tests require configured services/toolchains; see [VERIFICATION.md](VERIFICATION.md) for checks performed locally.

## This deployment

The configured hosted project is `mejnwvewnrdkzkagqxdc`; its initial SQL migration was applied through the dashboard, not the CLI. Before a future CLI migration push to this existing project, link it and mark versions `202610210001` and `202610210002` as applied with `supabase migration repair 202610210001 202610210002 --status applied`, using authorized database credentials, so the initial tables are not recreated.

## Branding

The app is now named LingoBridge. The launcher icon is in `assets/lingobridge-icon.png`; see [BRANDING.md](BRANDING.md) for the design prompt and asset details. Existing Expo project slug, native application IDs, and `threewords://` authentication callbacks are retained for compatibility. Vaylo 1.0.1 (Android version code 2) includes this name and icon. Earlier download links point to older builds and do not update automatically. Install the latest APK over the existing app.

## Manual updates and free services

The app does not check for updates or show update/download buttons. Download a newer APK from a completed Expo preview build and install it manually over the existing app. Keep the package ID and signing key unchanged, and increase the Android version code for each release.

Builds remain on Expo’s free tier, which may queue before compiling. Supabase and Gemini remain on their configured free tiers; usage is limited by their quotas. No paid plan or fallback is enabled. The historical app_releases database table is unused by the app.

## Live speech and transcript review (1.2)

The redesigned voice workspace uses `expo-speech-recognition` 3.1.3, the published `sdk-55` release. It uses Android SpeechRecognizer / iOS SFSpeechRecognizer and requires a new native APK or development build; Expo Go and the old APK cannot load this module.

Tap Speak, choose the source language, and tap the microphone. Interim words appear while you speak. Tap Stop (or wait for the speech service to finish), then edit the transcript. **Confirm & translate** sends the reviewed text to the existing authenticated translation function. Recording never submits a translation automatically. Record again asks before replacing your draft. Speech stops at 60 seconds or when the app backgrounds; recognized words remain available for review. Permission, network, unavailable-language, and no-speech failures offer typing as a fallback.

Speech recognition uses the phone's installed recognition service and may send audio to Apple/Google depending on device settings. No paid speech API or server transcription loop was added. Device/language support varies, particularly Armenian. Android 12 and earlier may finish after an utterance; tap the microphone again to start a fresh draft. This version does not persist audio clips. Only confirmed text is sent to Gemini and stored with its translation in Supabase. The backend retains its older bounded audio endpoint for older clients.

Device acceptance: test your chosen source languages on Android and iOS; verify partial words update without duplication, stop retains the last words, edit corrections, confirm before translation, retry after network failure without losing edits, deny permissions, background while listening, and test a missing speech language. Native microphone and service behavior cannot be established by JavaScript tests alone.

## Vaylo 1.3

Thirty languages: English, Spanish, Armenian, German, French, Italian, Portuguese, Russian, Ukrainian, Polish, Dutch, Swedish, Norwegian, Danish, Finnish, Greek, Turkish, Arabic, Hebrew, Persian, Hindi, Bengali, Tamil, Telugu, Kannada, Japanese, Korean, Chinese, Indonesian, and Vietnamese.

The searchable picker matches English/native names and codes, with accent-insensitive Latin search. Arabic, Hebrew and Persian text aligns right. Device speech/read-aloud availability varies by language and phone; typing remains available for all 30. The refreshed UI bundles Outfit fonts and introduces a cobalt language cover, native-script tiles, integrated controls and a contrasting floating navigation bar.

Migration `202610220001` expands history constraints and retains old Malayalam records. It was applied through the dashboard; include it when repairing migration history before a future CLI push. Web rendering dependencies are development tools for isolated visual checks, not simulated services in the native app.

## LingoBridge 1.4 translation studio

The app is now LingoBridge with a translation-card launcher icon, new heading and five tools. All 30 languages, authentication, private PostgreSQL history, light/dark appearance and manual APK updates remain. Native identifiers and signing key are retained.

- Text and Live: type or see speech appear live, review and confirm.
- Docs: import PDF, DOCX or UTF-8 TXT. DOCX/TXT text is extracted locally. PDF extraction uses the authenticated backend and Gemini. The translated output is plain text; layout, images and document formatting are not reproduced.
- Audio: record a voice clip up to 60 seconds or import M4A/MP3/WAV/AAC/OGG/FLAC. Preview audio, transcribe, edit and confirm.
- Calls: import an existing call recording in those formats. The app does not capture calls or access the phone call stream. AMR needs conversion to a supported format before import.
- Completed results offer Copy, Listen and Export TXT via the native share sheet.

Files are limited to 8 MB, and extracted/confirmed text to 5,000 Unicode characters per item. Longer items are rejected with split/trim guidance rather than shortened. PDF/audio bytes are sent to Gemini only after Extract/Transcribe; they are never stored in Supabase. Only reviewed text, translated text, input kind and source filename enter history after confirmation. Local imported/recorded cache files are removed on discard, source/tool reset or sign-out. Exported TXT copies remain in app cache until OS cleanup. Keep files you need in the phone's Files app.

Deploy migration 202610220002 before updating the translate function. It adds input_kind and source_name while retaining RLS. The same function accepts action=extract with kind, sourceLanguage, mimeType and fileBase64, verifies the user and consumes the shared 30-request/minute limit. It validates decoded size and file headers, rejects blocked/incomplete/empty/overlong extraction, and never inserts history at the extraction step. It uses the existing free-tier Gemini key with no paid fallback. DOCX decompression is restricted to word/document.xml with expansion bounds.

Acceptance testing: native file picker, audio permissions/recording, playback, PDF scans, DOCX tables/paragraphs, TXT encoding, import call recording, interrupted uploads, editing/retry, source labels in history, account isolation and native TXT sharing. Service quotas and device speech availability still apply.

## Learning, speaking and earphones (1.5)

The charcoal home screen includes tool cards, real recent history and a compact composer. Translate, Learn, Speak and Tools are the four main tabs; Account and theme controls are in the header. Existing document, recording and imported call-recording tools remain available.

- Earphones: connect wired/Bluetooth earphones and select them as the phone’s media output. Start a turn, review/edit recognized text, then confirm translation and playback. The app uses the OS-selected route; it does not detect headphones, split left/right channels, capture calls or listen in the background.
- Learn: save a word/phrase (up to 300 characters per side) from a translation/history or add one manually. Choose 5/10/20 daily words, reveal flashcards, then grade Again/Good/Easy. Private PostgreSQL cards, scheduled due dates and distinct reviewed-card counts persist across sessions. Deleting a card also removes its review records. Device timezone sets the learning day.
- Speak: select native/practice languages, level and social/work/study/travel scenario. Choose an actual installed device voice, listen to a translated prompt, speak, edit the transcript and check matching words (characters for Chinese/Japanese). Feedback compares recognized text; it is not an acoustic pronunciation assessment or an AI conversation partner. Attempts save privately in PostgreSQL; failed saves can be retried.

Apply `supabase/migrations/202610220003_learning_speaking.sql` for these features. It creates owned cards/settings/reviews/attempts and the owner-checking review RPC. RLS isolates accounts, and clients cannot directly forge review scheduling/progress. This migration was applied to the configured hosted project through its SQL editor. Before using CLI migration pushes there, repair already-applied migration history with authorized database credentials.

Device acceptance: test wired and Bluetooth output, stopping playback/navigation/backgrounding, live recognition and denied permissions, all speaking setup choices, transcript edits and save retry; save a word, restart/sign in, grade it and check the local-day goal; verify a second account cannot see cards or attempts. Installed recognition/TTS support varies by device and language. No new paid service, subscription, multiplayer opponent or generated success statistic is included.

## AI Assistant and conversational speaking (1.6)

Assistant is now a dedicated tab for translation help, word explanations, writing improvements and summaries of text supplied in the chat. It has no web search or automatic access to files/history. Speak now offers 32 topics across Social, Work, Study and Travel, with three learner levels and real installed device voices.

The AI opens the conversation aloud. Record a reply (up to 60 seconds / 2 MB), stop to upload it for transcription, review/edit the words, then confirm to send the transcript and audio for feedback and a contextual follow-up. Text-only replies are also supported. Replay controls use actual local recordings or installed TTS for AI messages. Feedback is shown under your reply with a suggested natural sentence. Audio-based observations are AI guidance, not a validated pronunciation assessment; no fabricated scores are displayed.

Conversations and feedback save privately in PostgreSQL using `202610220004_conversations.sql`. History reopens the latest 20 chats. Audio files are session-local cache files, cleaned when the conversation screen unmounts; only text and feedback persist. A conversation is bounded to 15 replies, with 5,000 characters per message and a 30,000-character submitted context limit. New chats reset the context. Save failures preserve the answer and offer Retry save; provider failures preserve your draft/recording.

Deploy the updated `translate` function including `assistant.ts`. All AI/transcription requests require validated Supabase user tokens and share the existing 30 requests/user/minute limit and configured free Gemini quota. No paid fallback is enabled. Test recording permissions, replay/pause, Bluetooth output, backgrounding, transcript editing, interrupted networks, saved-chat restoration and two-account isolation on physical Android/iOS devices before production release.
