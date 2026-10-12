[CmdletBinding()]
param(
  [string]$VersionName = "0.5.9",
  [int]$VersionCode = 16,
  [string]$ShortWorkspace = "C:\hubb03",
  [switch]$ReuseAndroidProject
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

function Assert-ApkDexContains([string]$ApkPath, [string[]]$Symbols) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [IO.Compression.ZipFile]::OpenRead($ApkPath)
  try {
    $dexText = [Text.StringBuilder]::new()
    foreach ($entry in $archive.Entries | Where-Object { $_.FullName -match '^classes[0-9]*\.dex$' }) {
      $stream = $entry.Open()
      try {
        $memory = [IO.MemoryStream]::new()
        try {
          $stream.CopyTo($memory)
          [void]$dexText.Append([Text.Encoding]::ASCII.GetString($memory.ToArray()))
        } finally {
          $memory.Dispose()
        }
      } finally {
        $stream.Dispose()
      }
    }
    foreach ($symbol in $Symbols) {
      if (-not $dexText.ToString().Contains($symbol)) {
        throw "Signed release APK is missing native AppInstaller API: $symbol"
      }
    }
  } finally {
    $archive.Dispose()
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
  $mobileSource = Join-Path $workspaceRoot "apps\mobile"
  $packagesSource = Join-Path $workspaceRoot "packages"
  Sync-Directory $mobileSource (Join-Path $ShortWorkspace "apps\mobile") @(
    (Join-Path $mobileSource "android"),
    (Join-Path $mobileSource "ios"),
    (Join-Path $mobileSource "node_modules"),
    (Join-Path $mobileSource ".expo"),
    (Join-Path $mobileSource ".turbo")
  )
  Sync-Directory $packagesSource (Join-Path $ShortWorkspace "packages") @(
    (Join-Path $packagesSource "node_modules"),
    (Join-Path $packagesSource "dist"),
    (Join-Path $packagesSource ".turbo")
  )

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
    if ($ReuseAndroidProject) {
      Assert-Path (Join-Path (Get-Location).Path "android\gradlew.bat") "Existing Android project for incremental prebuild"
      pnpm exec expo prebuild --platform android --no-clean --no-install
    } else {
      pnpm exec expo prebuild --platform android --clean --no-install
    }
    if ($LASTEXITCODE -ne 0) { throw "Expo production prebuild failed" }

    Push-Location "android"
    try {
      .\gradlew.bat :hub-app-installer:testDebugUnitTest assembleRelease --no-daemon
      if ($LASTEXITCODE -ne 0) { throw "Gradle production release tests or build failed" }
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
  Assert-ApkDexContains $artifactPath @(
    "getCurrentAppInfo",
    "openInstalledApp",
    "getInstallCapability",
    "onDownloadProgress",
    "prepareInstall",
    "installPrepared",
    "implicitlyAddedPermissions"
  )

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
