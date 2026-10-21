# Vaylo

![Vaylo icon](assets/icon.png)

[Download the latest Android APK](https://github.com/rahulrameshm0/vaylo-downloads/releases/latest)

Android and iOS text and voice translator for English, Spanish, Armenian, and German. Includes light, dark, and system themes, a keyboard-aware translation workspace, and manual APK installation. Expo + TypeScript, Supabase Auth/PostgreSQL, and Gemini 3.5 Flash-Lite on its free API tier. There is no demo login, local database substitute, or fake translation fallback.

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

The function accepts `{text, sourceLanguage, targetLanguage}` and returns `{originalText, translatedText, historyRecordId, warning}`. Voice requests use `{audioBase64, mimeType, sourceLanguage, targetLanguage}` instead of text, with MP4/M4A audio bounded to 2.1 MB in the client and base64 length 2,800,000 on the server. Language codes are `en`, `es`, `hy`, and `de`. Malayalam is no longer offered for new translations; previous Malayalam history remains readable and deletable. Empty text, identical languages, and inputs exceeding 5,000 Unicode code points are rejected. Each verified user gets 30 requests per UTC calendar minute, including failed provider requests. Limits are atomic across function instances and reset at the next minute boundary. Gemini requests time out after 45 seconds. Failed history writes return the translation with a warning and a null history ID.

Text and submitted voice recordings are sent to Google Gemini for translation and the source transcript plus translation are saved to the user's Supabase history. Audio is not stored in PostgreSQL. Recordings stop at 30 seconds; they are sent only after tapping Translate voice, retained locally for retry after errors, and deleted after success or discard. Read-aloud uses installed device voices; some devices have no Armenian voice. Google's Gemini free-tier content may be used to improve its products; avoid sensitive text. AI translations can be inaccurate, so test all four languages’ quality before relying on them. Users can delete individual records. Choose service regions, retention, and privacy terms appropriate to your deployment before public distribution.

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
3. Translate in all twelve directions, including Armenian input/output and emoji. Copy results, swap languages, and reopen a history record.
4. Create more than 20 records; load more and refresh. Delete a record. Confirm the other account sees none of the first account's history.
5. Disable networking; confirm input survives failures. Exercise a provider error, the minute limit, and a failed history write in a development environment; verify the result remains visible for the latter.
6. Check keyboard behavior, large system text, screen-reader labels, and Armenian glyph rendering on both Android and iOS.

Live authentication, email delivery, Gemini translation quality, hosted database tests, and device smoke tests require configured services/toolchains; see [VERIFICATION.md](VERIFICATION.md) for checks performed locally.

## This deployment

The configured hosted project is `mejnwvewnrdkzkagqxdc`; its initial SQL migration was applied through the dashboard, not the CLI. Before a future CLI migration push to this existing project, link it and mark versions `202610210001` and `202610210002` as applied with `supabase migration repair 202610210001 202610210002 --status applied`, using authorized database credentials, so the initial tables are not recreated.

## Branding

The app is now named Vaylo. The launcher icon is in `assets/icon.png`; see [BRANDING.md](BRANDING.md) for the design prompt and asset details. Existing Expo project slug, native application IDs, and `threewords://` authentication callbacks are retained for compatibility. Vaylo 1.0.1 (Android version code 2) includes this name and icon. Earlier download links point to older builds and do not update automatically. Install the latest APK over the existing app.

## Manual updates and free services

The app does not check for updates or show update/download buttons. Download a newer APK from the public releases page and install it manually over Vaylo. Keep the package ID and signing key unchanged, and increase the Android version code for each release.

Builds remain on Expo’s free tier, which may queue before compiling. Supabase and Gemini remain on their configured free tiers; usage is limited by their quotas. No paid plan or fallback is enabled. The historical app_releases database table is unused by the app.
