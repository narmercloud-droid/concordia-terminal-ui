# Publish a new Concordia Terminal APK for Wi‑Fi auto-update.
# 1) Builds release APK
# 2) Prints checksum + version for latest.json / GitHub Release
#
# Usage (from concordia-terminal-ui):
#   powershell -ExecutionPolicy Bypass -File scripts/publish-update.ps1

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$updatesRepo = Join-Path (Split-Path -Parent $root) "concordia-updates"
$javaHome = "C:\Program Files\Android\Android Studio\jbr"
$androidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"

if (-not (Test-Path $javaHome)) {
  Write-Error "Android Studio JDK not found at $javaHome."
}

$env:JAVA_HOME = $javaHome
$env:ANDROID_HOME = $androidSdk
$env:PATH = "$javaHome\bin;$androidSdk\platform-tools;$env:PATH"

Push-Location $root
try {
  $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
  $versionName = [string]$pkg.version
  $gradle = Get-Content "android\app\build.gradle" -Raw
  if ($gradle -notmatch 'versionCode\s+(\d+)') {
    Write-Error "Could not read versionCode from android/app/build.gradle"
  }
  $versionCode = [int]$Matches[1]

  Write-Host "Building terminal APK $versionName (versionCode $versionCode)..." -ForegroundColor Cyan
  npm run build
  npx cap sync android
  Push-Location android
  try {
    .\gradlew.bat assembleRelease
  } finally {
    Pop-Location
  }

  $apk = Join-Path $root "android\app\build\outputs\apk\release\app-release.apk"
  if (-not (Test-Path $apk)) {
    Write-Error "APK not found: $apk"
  }

  $hash = (Get-FileHash -Algorithm SHA256 -Path $apk).Hash.ToLowerInvariant()
  $releaseName = "app-production-release.apk"
  $apkUrl = "https://github.com/narmercloud-droid/concordia-updates/releases/latest/download/$releaseName"

  $manifest = @{
    versionCode = $versionCode
    versionName = $versionName
    apkUrl      = $apkUrl
    checksum    = $hash
  } | ConvertTo-Json

  if (Test-Path $updatesRepo) {
    $manifestPath = Join-Path $updatesRepo "latest.json"
    Set-Content -Path $manifestPath -Value $manifest -Encoding utf8
    Set-Content -Path (Join-Path $updatesRepo "checksum.sha256") -Value "$hash  $releaseName" -Encoding ascii
    Write-Host "Wrote $manifestPath" -ForegroundColor Green
  }

  Write-Host ""
  Write-Host "=== Publish steps ===" -ForegroundColor Yellow
  Write-Host "1. Upload this APK as GitHub Release asset named: $releaseName"
  Write-Host "   $apk"
  Write-Host "2. Tag/release version: v$versionName (versionCode $versionCode)"
  Write-Host "3. Commit+push concordia-updates latest.json (checksum $hash)"
  Write-Host "4. Terminals with auto-update will download on next check (app open / hourly)."
  Write-Host ""
  Write-Host $manifest
} finally {
  Pop-Location
}
