[CmdletBinding()]
param(
  [string]$VersionName = "0.4.0",
  [int]$VersionCode = 5,
  [string]$ShortWorkspace = "C:\hubb03"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$keystorePath = "C:\Users\loicd\Documents\SigningKeys\solana-android-hub-release.keystore"
$credentialPath = Join-Path $env:APPDATA "SolanaAndroidHub\release-signing-password.clixml"
$artifactDirectory = Join-Path $workspaceRoot ".artifacts\android-production"
$artifactPath = Join-Path $artifactDirectory "Dapport-v$VersionName.apk"
$expectedPackage = "com.lololabs.solanaandroidhub"
$expectedCertificate = "02F204B9CBED11E59F85B2A6DBCB34AD6F0A4658C639D58B2C27FB3BE2AD0E09"
$buildTools = Join-Path $env:ANDROID_HOME "build-tools\36.0.0"
$apksigner = Join-Path $buildTools "apksigner.bat"
$aapt = Join-Path $buildTools "aapt.exe"
$zipalign = Join-Path $buildTools "zipalign.exe"
$passwordPointer = [IntPtr]::Zero

function Assert-Path([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label was not found at $Path"
  }
}

function Sync-Directory([string]$Source, [string]$Destination, [string[]]$ExcludedDirectories) {
  $arguments = @($Source, $Destination, "/MIR", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/XF", ".env", ".env.*")
  if ($ExcludedDirectories.Count -gt 0) {
    $arguments += "/XD"
    $arguments += $ExcludedDirectories
  }
  & robocopy @arguments | Out-Null
  if ($LASTEXITCODE -ge 8) {
    throw "Could not synchronize $Source to $Destination (robocopy exit $LASTEXITCODE)"
  }
}

try {
  Assert-Path $keystorePath "Dapport release keystore"
  Assert-Path $credentialPath "DPAPI signing credential"
  Assert-Path $apksigner "apksigner"
  Assert-Path $aapt "aapt"
  Assert-Path $zipalign "zipalign"

  Assert-Path $ShortWorkspace "Persistent short Android build workspace"
  Assert-Path (Join-Path $ShortWorkspace "node_modules\.modules.yaml") "Short-workspace pnpm installation"

  foreach ($rootFile in @("package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json", "tsconfig.base.json")) {
    Copy-Item -LiteralPath (Join-Path $workspaceRoot $rootFile) -Destination (Join-Path $ShortWorkspace $rootFile) -Force
  }
  Copy-Item -LiteralPath (Join-Path $workspaceRoot "apps\web\package.json") -Destination (Join-Path $ShortWorkspace "apps\web\package.json") -Force
  Sync-Directory (Join-Path $workspaceRoot "apps\mobile") (Join-Path $ShortWorkspace "apps\mobile") @("android", "ios", "node_modules", ".expo", ".turbo")
  Sync-Directory (Join-Path $workspaceRoot "packages") (Join-Path $ShortWorkspace "packages") @("node_modules", "dist", ".turbo")

  $securePassword = Import-Clixml -LiteralPath $credentialPath
  if ($securePassword -isnot [Security.SecureString]) {
    throw "The DPAPI signing credential is not a SecureString"
  }
  $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)

  $env:NODE_ENV = "production"
  $env:APP_ENV = "production"
  $env:EXPO_PUBLIC_HUB_ORIGIN = "https://dapport.app"
  $env:RELEASE_PUBLICATION_GATE = "server_and_device"
  $env:HUB_APP_VERSION_NAME = $VersionName
  $env:HUB_APP_VERSION_CODE = $VersionCode.ToString()
  $env:HUB_RELEASE_STORE_FILE = $keystorePath
  $env:HUB_RELEASE_STORE_PASSWORD = $plainPassword
  $env:HUB_RELEASE_KEY_ALIAS = "solana-android-hub"
  $env:HUB_RELEASE_KEY_PASSWORD = $plainPassword

  Push-Location $ShortWorkspace
  try {
    pnpm install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "Short-workspace dependency installation failed" }
  } finally {
    Pop-Location
  }

  Push-Location (Join-Path $ShortWorkspace "apps\mobile")
  try {
    pnpm exec expo prebuild --platform android --clean --no-install
    if ($LASTEXITCODE -ne 0) { throw "Expo production prebuild failed" }

    Push-Location "android"
    try {
      .\gradlew.bat assembleRelease --no-daemon
      if ($LASTEXITCODE -ne 0) { throw "Gradle production release build failed" }
    } finally {
      Pop-Location
    }
  } finally {
    Pop-Location
  }

  $builtApk = Join-Path $ShortWorkspace "apps\mobile\android\app\build\outputs\apk\release\app-release.apk"
  Assert-Path $builtApk "Signed release APK"
  New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
  Copy-Item -LiteralPath $builtApk -Destination $artifactPath -Force

  $badging = & $aapt dump badging $artifactPath
  if ($LASTEXITCODE -ne 0) { throw "aapt could not inspect the APK" }
  $badgingText = $badging -join "`n"
  if ($badgingText -notmatch "package: name='$([regex]::Escape($expectedPackage))'") { throw "Unexpected Android package" }
  if ($badgingText -notmatch "versionCode='$VersionCode'") { throw "Unexpected Android versionCode" }
  if ($badgingText -notmatch "versionName='$([regex]::Escape($VersionName))'") { throw "Unexpected Android versionName" }

  $signature = & $apksigner verify --verbose --print-certs $artifactPath
  if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed" }
  $certificateLine = $signature | Where-Object { $_ -match "Signer #1 certificate SHA-256 digest:" } | Select-Object -First 1
  $actualCertificate = ($certificateLine -split ":", 2)[1].Trim().Replace(":", "").ToUpperInvariant()
  if ($actualCertificate -ne $expectedCertificate) { throw "Unexpected release signing certificate" }

  & $zipalign -c -P 16 -v 4 $artifactPath | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "APK zip alignment verification failed" }

  $hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $artifactPath).Hash
  $file = Get-Item -LiteralPath $artifactPath
  [pscustomobject]@{
    Artifact = $file.FullName
    Bytes = $file.Length
    Sha256 = $hash
    Package = $expectedPackage
    VersionName = $VersionName
    VersionCode = $VersionCode
    CertificateSha256 = $actualCertificate
  } | Format-List
} finally {
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  $plainPassword = $null
  foreach ($name in @(
    "HUB_RELEASE_STORE_PASSWORD",
    "HUB_RELEASE_KEY_PASSWORD",
    "HUB_RELEASE_STORE_FILE",
    "HUB_RELEASE_KEY_ALIAS"
  )) {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
  }
}
