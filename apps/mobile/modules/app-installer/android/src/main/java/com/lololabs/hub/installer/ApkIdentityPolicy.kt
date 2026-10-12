package com.lololabs.hub.installer

internal object ApkIdentityPolicy {
  fun validateExpected(actual: InspectedApk, expected: ExpectedReleaseRecord) {
    val expectedVersion = expected.versionCode.toLongOrNull()
      ?: throw InstallerException("EXPECTED_RELEASE_INVALID", "Expected version code is invalid")
    if (actual.packageName != expected.packageName) throw InstallerException("APK_PACKAGE_MISMATCH", "APK package does not match Release metadata")
    if (actual.versionCode != expectedVersion) throw InstallerException("APK_VERSION_MISMATCH", "APK version does not match Release metadata")
    if (actual.minSdk != expected.minSdk) throw InstallerException("APK_MIN_SDK_MISMATCH", "APK minSdk does not match Release metadata")
    if (actual.certificateSha256 != normalizeDigest(expected.certificateSha256)) {
      throw InstallerException("APK_CERTIFICATE_MISMATCH", "APK signer does not match Release metadata")
    }
    val unlistedPermissions = actual.permissions.toSet() - actual.implicitlyAddedPermissions.toSet() - expected.permissions.toSet()
    if (unlistedPermissions.isNotEmpty()) {
      throw InstallerException("APK_PERMISSIONS_MISMATCH", "APK requests permissions not listed in Release metadata")
    }
  }

  fun validateInstalledEdition(target: InspectedApk, installedVersionCode: Long, installedCertificateSha256: String) {
    if (normalizeDigest(installedCertificateSha256) != target.certificateSha256) {
      throw InstallerException("INSTALLED_EDITION_CONFLICT", "The visible installed edition uses a different signer")
    }
    if (target.versionCode < installedVersionCode) {
      throw InstallerException("APK_DOWNGRADE_REJECTED", "Downgrades are not allowed")
    }
  }

  private fun normalizeDigest(value: String): String = value.replace(":", "").trim().lowercase()
}
