# progress.io

A clean, local-first progress dashboard for making small habits visible.

## Run it

Run `npm install` then `npm run dev` and open the printed local URL.

## Included interactions

- Check off habits and mark all habits complete.
- Add goals from the modal; new goals appear in the habit list and activity feed.
- Search and remove recent activity.
- Toggle and remember light/dark mode.
- Responsive mobile navigation.
- Dedicated Overview, Performance, and Activity views with month/year trend charts.
- Edit the profile and workspace name from the account menu.
- Create separate local workspaces; each workspace remembers its own habits, activity, month history, and theme.
- Configure a daily reminder down to the minute; native reminders are rescheduled when the time changes.

Progress is persisted in browser `localStorage` under the `progress-*` keys. The account layer is intentionally local-first because this static starter has no server or authentication provider; the account records can be moved behind an API later without changing the dashboard model. `schema.sql` contains the SQLite schema for moving this local data to a hosted database later.

## Android and production sync

This project now includes Capacitor, Supabase integration, and the `progress.io` app identity. To run the local app:

```powershell
npm install
npm run dev
```

To configure cloud accounts, copy `.env.example` to `.env`, add your Supabase URL and anon key, then run the SQL in `schema.sql` in the Supabase SQL editor. Supabase Auth handles sign-up/sign-in and `user_workspaces` stores each user's workspace payload with row-level security.

Without Supabase variables, the sign-in screen uses a local browser account mode so the flow remains testable offline. Local accounts are device-only and are not suitable for production credentials; configure Supabase before publishing.

The notification setting supports one daily incomplete-habit reminder. The browser asks for notification permission when reminders are enabled or the notification button is pressed. In a normal browser build, the page must be open or running for the timer to fire; Android background delivery requires adding Capacitor Local Notifications before publishing the APK.

To generate/open the Android project, install Android Studio and an Android SDK, then run:

```powershell
npx cap add android
npm run cap:android
```

The APK is then built from Android Studio (`Build > Generate App Bundles or APKs`). The Capacitor app id is `io.progress.app`, and native daily reminders use Capacitor Local Notifications. Never ship the Supabase service-role key in the app; only the anon key belongs in `.env`.

## Build the APK (no Android Studio needed)

The `android/` project is already generated and `.github/workflows/android-apk.yml` builds the APK on GitHub for free and publishes it as a release.

1. Push this folder to a **public** GitHub repo (branch `main`) so anyone can download without a GitHub account.
2. Repo **Settings > Secrets and variables > Actions** > add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (anon key only, never the service-role key).
3. Wait for the **Build Android APK** run in the Actions tab to go green. Share this link:
   `https://github.com/<you>/<repo>/releases/download/latest/progress-io.apk`

Every push to `main` rebuilds and replaces the file at that same link. Locally with Android Studio: `npm run cap:android`.
