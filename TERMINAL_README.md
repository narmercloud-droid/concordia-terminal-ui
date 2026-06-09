# Concordia Terminal (Sunmi / Android APK)

Kitchen terminal app for receiving website orders, setting prep time, and triggering kitchen print.

## Location

- App source: `concordia-terminal-ui/`
- Backend API: `Concordia-Backend/src/routes/terminal/`

## Production API

The APK is built against:

`https://concordia-backend-web.onrender.com`

Set `VITE_API_URL` in `.env.production` before rebuilding if the backend URL changes.

## First-time setup (developer)

Requirements on Windows:

- Node.js 20+
- Android Studio (includes Android SDK)
- JDK 17 (Android Studio bundled JDK is fine)

```powershell
cd concordia-terminal-ui
npm install
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npx cap add android
```

## Build APK for Sunmi (recommended)

**Use this for kitchen terminals.** Debug APKs (`app-debug.apk`) are marked *debuggable* and Sunmi devices often block them with **“Security error: debugging is enabled”**.

Requires Android Studio (JDK + SDK). On Windows, `npm run apk:sunmi` sets `JAVA_HOME` automatically.

```powershell
cd concordia-terminal-ui
npm run apk:sunmi
```

Output APK:

`android/app/build/outputs/apk/release/app-release.apk`

## Build debug APK (developer testing only)

```powershell
npm run apk:debug
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk` — do **not** install this on production Sunmi terminals.

## Build release APK (for production install)

1. Create a keystore (once):

```powershell
keytool -genkey -v -keystore concordia-terminal.keystore -alias concordia -keyalg RSA -keysize 2048 -validity 10000
```

2. Add signing config in `android/app/build.gradle` (or use Android Studio **Build → Generate Signed Bundle / APK**).

3. Build:

```powershell
npm run apk:release
```

Output:

`android/app/build/outputs/apk/release/app-release.apk`

## Install on Sunmi terminal

1. Copy `app-release.apk` from `npm run apk:sunmi` to the device (USB, email, or cloud).
2. On the Sunmi, enable **Install unknown apps** for your file manager.
3. Open the APK and install.
4. Open **Concordia Terminal**.
5. Enter branch code **KEMPEN** and tap **Connect terminal**.

The device stays connected and receives new orders in real time.

## Daily use (staff)

1. New orders appear on the **Pending orders** list (today only).
2. A tone plays when a new order arrives.
3. Tap an order → review items.
4. Set prep time (default 45 min delivery / 15 min pickup).
5. Tap **Confirm time & Print** — backend prints kitchen tickets on the Sunmi.
6. Open **Tagesabschluss** for today's revenue summary (Lieferando-style).
7. When shutting down for the day, open **Tagesabschluss** and tap **Bericht drucken** (manual only).

## Troubleshooting

| Problem | Fix |
|--------|-----|
| **Security error: debugging is enabled** | You installed a **debug** APK. Rebuild with `npm run apk:sunmi` and install `app-release.apk`. On the Sunmi, turn off **USB debugging** (Settings → Developer options) if it stays on. |
| "Invalid branch code" | Use `KEMPEN` (must exist in backend seed). |
| Orders not loading | Check Wi‑Fi; backend may be waking from sleep (first request can take ~30s on Render free tier). |
| No live updates | Status should show **Live updates on**; reconnect Wi‑Fi or restart app. |
| Print does not run | Printing is server-side on confirm; check Sunmi printer paper and backend logs. |

## Rebuild after code changes

```powershell
npm run apk:sunmi
```

Reinstall `android/app/build/outputs/apk/release/app-release.apk` on the terminal.
