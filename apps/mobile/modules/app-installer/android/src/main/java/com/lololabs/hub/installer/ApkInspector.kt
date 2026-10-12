package com.lololabs.hub.installer

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import com.android.apksig.ApkVerifier
import java.io.File
import java.security.MessageDigest

internal data class InspectedApk(
  val packageName: String,
  val versionCode: Long,
  val versionName: String?,
  val minSdk: Int,
  val certificateSha256: String,
  val permissions: List<String>,
  val implicitlyAddedPermissions: List<String> = emptyList()
)

internal object ApkInspector {
  fun inspectAndValidate(context: Context, file: File, expected: ExpectedReleaseRecord): InspectedApk {
    val verification = try {
      ApkVerifier.Builder(file).build().verify()
    } catch (error: Exception) {
      throw InstallerException("APK_SIGNATURE_INVALID", "AOSP apksig could not parse the APK", error)
    }
    if (!verification.isVerified || verification.errors.isNotEmpty()) {
      throw InstallerException("APK_SIGNATURE_INVALID", "AOSP apksig rejected the APK signature")
    }
    if (verification.signerCertificates.size != 1) {
      throw InstallerException("APK_SIGNER_UNSUPPORTED", "Exactly one current APK signer is required")
    }

    val info = packageArchiveInfo(context.packageManager, file)
      ?: throw InstallerException("APK_MANIFEST_INVALID", "Android could not inspect the APK manifest")
    val applicationInfo = info.applicationInfo
      ?: throw InstallerException("APK_MANIFEST_INVALID", "APK application metadata is missing")
    val signer = currentSigner(info)
    val certificateSha256 = MessageDigest.getInstance("SHA-256").digest(signer.toByteArray()).toHex()
    val permissions = (info.requestedPermissions ?: emptyArray()).toSet().sorted()
    val inspected = InspectedApk(
      packageName = info.packageName,
      versionCode = info.longVersionCode,
      versionName = info.versionName,
      minSdk = applicationInfo.minSdkVersion,
      certificateSha256 = certificateSha256,
      permissions = permissions,
      implicitlyAddedPermissions = ApkPermissionPolicy.implicitlyAddedPermissions(
        info.requestedPermissions, info.requestedPermissionsFlags, Build.VERSION.SDK_INT
      )
    )
    ApkIdentityPolicy.validateExpected(inspected, expected)
    validateInstalledEdition(context.packageManager, inspected)
    return inspected
  }

  fun installedPackageInfo(packageManager: PackageManager, packageName: String): Map<String, Any?>? {
    val info = try {
      installedInfo(packageManager, packageName)
    } catch (_: PackageManager.NameNotFoundException) {
      return null
    }
    val signer = currentSigner(info)
    return mapOf(
      "status" to "installed",
      "packageName" to info.packageName,
      "versionCode" to info.longVersionCode.toString(),
      "versionName" to info.versionName,
      "certificateSha256" to MessageDigest.getInstance("SHA-256").digest(signer.toByteArray()).toHex()
    )
  }

  private fun validateInstalledEdition(packageManager: PackageManager, target: InspectedApk) {
    val installed = try {
      installedInfo(packageManager, target.packageName)
    } catch (_: PackageManager.NameNotFoundException) {
      return
    }
    val signer = currentSigner(installed)
    val signerSha256 = MessageDigest.getInstance("SHA-256").digest(signer.toByteArray()).toHex()
    ApkIdentityPolicy.validateInstalledEdition(target, installed.longVersionCode, signerSha256)
  }

  private fun currentSigner(info: PackageInfo) = info.signingInfo?.apkContentsSigners?.singleOrNull()
    ?: throw InstallerException("APK_SIGNER_UNSUPPORTED", "Exactly one current APK signer is required")

  private fun packageArchiveInfo(packageManager: PackageManager, file: File): PackageInfo? {
    val flags = PackageManager.GET_SIGNING_CERTIFICATES or PackageManager.GET_PERMISSIONS
    return if (Build.VERSION.SDK_INT >= 33) {
      packageManager.getPackageArchiveInfo(file.absolutePath, PackageManager.PackageInfoFlags.of(flags.toLong()))
    } else {
      @Suppress("DEPRECATION")
      packageManager.getPackageArchiveInfo(file.absolutePath, flags)
    }
  }

  private fun installedInfo(packageManager: PackageManager, packageName: String): PackageInfo {
    val flags = PackageManager.GET_SIGNING_CERTIFICATES
    return if (Build.VERSION.SDK_INT >= 33) {
      packageManager.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(flags.toLong()))
    } else {
      @Suppress("DEPRECATION")
      packageManager.getPackageInfo(packageName, flags)
    }
  }

}
