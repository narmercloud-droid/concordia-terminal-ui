# Build Concordia Terminal release APK for Sunmi (debugging disabled)
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$javaHome = "C:\Program Files\Android\Android Studio\jbr"
$androidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"

if (-not (Test-Path $javaHome)) {
  Write-Error "Android Studio JDK not found at $javaHome. Install Android Studio or set JAVA_HOME."
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidSdk
$env:PATH = "$javaHome\bin;$androidSdk\platform-tools;$env:PATH"

Push-Location $root
try {
  npm run build
  npx cap sync android
  Push-Location android
  .\gradlew.bat assembleRelease
  $apk = "app\build\outputs\apk\release\app-release.apk"
  if (Test-Path $apk) {
    Write-Host ""
    Write-Host "APK ready (release, debugging disabled): $(Join-Path (Get-Location) $apk)" -ForegroundColor Green
    Write-Host "Copy this file to the Sunmi and install it (not app-debug.apk)." -ForegroundColor Cyan
  }
} finally {
  Pop-Location
  Pop-Location
}
