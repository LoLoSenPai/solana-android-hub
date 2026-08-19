package com.lololabs.hub.installer

import org.junit.Assert.assertThrows
import org.junit.Test

class ApkIdentityPolicyTest {
  private val certificate = "ab".repeat(32)
  private val actual = InspectedApk(
    packageName = "com.example.fixture",
    versionCode = 2,
    versionName = "2.0.0",
    minSdk = 26,
    certificateSha256 = certificate,
    permissions = listOf("android.permission.INTERNET")
  )
  private val expected = ExpectedReleaseRecord(
    downloadUrl = "https://example.com/fixture.apk",
    byteSize = 100,
    sha256 = "cd".repeat(32),
    packageName = actual.packageName,
    versionCode = actual.versionCode.toString(),
    minSdk = actual.minSdk,
    certificateSha256 = certificate,
    permissions = actual.permissions
  )

  @Test fun exactIdentityPasses() {
    ApkIdentityPolicy.validateExpected(actual, expected)
    ApkIdentityPolicy.validateInstalledEdition(actual, 1, certificate)
  }

  @Test fun packageMismatchBlocks() = assertFailure("APK package") {
    ApkIdentityPolicy.validateExpected(actual, expected.copy(packageName = "com.example.other"))
  }

  @Test fun versionMismatchBlocks() = assertFailure("APK version") {
    ApkIdentityPolicy.validateExpected(actual, expected.copy(versionCode = "3"))
  }

  @Test fun minSdkMismatchBlocks() = assertFailure("minSdk") {
    ApkIdentityPolicy.validateExpected(actual, expected.copy(minSdk = 24))
  }

  @Test fun certificateMismatchBlocks() = assertFailure("signer") {
    ApkIdentityPolicy.validateExpected(actual, expected.copy(certificateSha256 = "ef".repeat(32)))
  }

  @Test fun permissionMismatchBlocks() = assertFailure("permissions") {
    ApkIdentityPolicy.validateExpected(actual, expected.copy(permissions = emptyList()))
  }

  @Test fun legacyMetadataPermissionSupersetPasses() {
    ApkIdentityPolicy.validateExpected(
      actual,
      expected.copy(permissions = actual.permissions + "android.permission.READ_EXTERNAL_STORAGE")
    )
  }

  @Test fun unlistedApkPermissionBlocks() = assertFailure("permissions") {
    ApkIdentityPolicy.validateExpected(
      actual.copy(permissions = actual.permissions + "android.permission.CAMERA"),
      expected
    )
  }

  @Test fun installedDifferentEditionBlocks() = assertFailure("different signer") {
    ApkIdentityPolicy.validateInstalledEdition(actual, 1, "ef".repeat(32))
  }

  @Test fun downgradeBlocks() = assertFailure("Downgrades") {
    ApkIdentityPolicy.validateInstalledEdition(actual, 3, certificate)
  }

  private fun assertFailure(message: String, action: () -> Unit) {
    assertThrows(InstallerException::class.java, action).also { error ->
      check(error.message?.contains(message) == true)
    }
  }
}
