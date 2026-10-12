package com.lololabs.hub.installer

import android.app.PendingIntent
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.IntentSender
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

class AppInstallerModule : Module() {
  private val prepared = ConcurrentHashMap<String, PreparedApkRecord>()
  private val cancellations = ConcurrentHashMap<String, AtomicBoolean>()
  private val targetedFixturePackages = setOf("com.lololabs.hubfixture")

  override fun definition() = ModuleDefinition {
    Name("AppInstaller")
    Events("onDownloadProgress")

    AsyncFunction("getCurrentAppInfo") {
      val context = requireContext()
      ApkInspector.installedPackageInfo(context.packageManager, context.packageName)
        ?: throw InstallerException("CURRENT_APP_INFO_MISSING", "Android could not inspect the current Hub installation")
    }

    AsyncFunction("getInstallCapability") {
      val context = requireContext()
      val canInstall = Build.VERSION.SDK_INT < 26 || context.packageManager.canRequestPackageInstalls()
      mapOf(
        "supported" to (Build.VERSION.SDK_INT >= 26),
        "canRequestPackageInstalls" to canInstall,
        "requiresUnknownSourcesSettings" to !canInstall
      )
    }

    AsyncFunction("openUnknownSourcesSettings") {
      val context = requireContext()
      val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    AsyncFunction("getInstalledPackageInfo") { packageName: String ->
      requireValidPackageName(packageName)
      val info = ApkInspector.installedPackageInfo(requireContext().packageManager, packageName)
      info ?: mapOf(
        "status" to if (Build.VERSION.SDK_INT < 30 || packageName in targetedFixturePackages) "not_installed" else "visibility_unknown"
      )
    }

    AsyncFunction("openInstalledApp") { packageName: String ->
      requireValidPackageName(packageName)
      val context = requireContext()
      try {
        if (Build.VERSION.SDK_INT >= 33) {
          // This exact-package launcher is not filtered by package visibility.
          // It does not supply installed-state evidence; that remains the
          // responsibility of getInstalledPackageInfo.
          context.packageManager.getLaunchIntentSenderForPackage(packageName)
            .sendIntent(context, 0, null, null, null)
        } else {
          val intent = context.packageManager.getLaunchIntentForPackage(packageName)
            ?: throw InstallerException(
              "APP_LAUNCH_UNAVAILABLE",
              "Android could not find a visible launch activity for this package"
            )
          context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
      } catch (error: IntentSender.SendIntentException) {
        throw InstallerException("APP_LAUNCH_UNAVAILABLE", "The package has no available launch activity", error)
      } catch (error: ActivityNotFoundException) {
        throw InstallerException("APP_LAUNCH_UNAVAILABLE", "The package launch activity is no longer available", error)
      } catch (error: SecurityException) {
        throw InstallerException("APP_OPEN_BLOCKED", "Android blocked opening this application", error)
      } catch (error: InstallerException) {
        throw error
      } catch (error: RuntimeException) {
        throw InstallerException("APP_OPEN_FAILED", "Android could not open this application", error)
      }
      Unit
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("prepareInstall") Coroutine { operationId: String, expected: ExpectedReleaseRecord ->
      require(operationId.matches(Regex("^[A-Za-z0-9_-]{8,80}$"))) { "OPERATION_ID_INVALID" }
      requireValidPackageName(expected.packageName)
      val context = requireContext()
      val cancellation = AtomicBoolean(false)
      cancellations[operationId] = cancellation
      val destination = File(context.cacheDir, "hub-prepared-${UUID.randomUUID()}.apk")
      try {
        // Downloads and APK validation block; keep Expo's shared module queue
        // available for catalogue/SQLite reads and cancellation during preparation.
        withContext(Dispatchers.IO) {
          val downloaded = SecureApkDownloader.download(
            expected.downloadUrl,
            destination,
            expected.byteSize,
            cancellation
          ) { downloadedBytes, totalBytes ->
            sendEvent(
              "onDownloadProgress",
              mapOf(
                "operationId" to operationId,
                "downloadedBytes" to downloadedBytes.toDouble(),
                "totalBytes" to totalBytes.toDouble(),
                "fraction" to downloadedBytes.toDouble().div(totalBytes.toDouble()).coerceIn(0.0, 1.0)
              )
            )
          }
          if (downloaded.byteSize != expected.byteSize) throw InstallerException("APK_SIZE_MISMATCH", "APK size does not match Release metadata")
          if (downloaded.sha256 != normalizeDigest(expected.sha256)) throw InstallerException("APK_HASH_MISMATCH", "APK SHA-256 does not match Release metadata")
          val inspected = ApkInspector.inspectAndValidate(context, destination, expected)
          val preparedId = UUID.randomUUID().toString()
          val record = PreparedApkRecord(
            preparedId = preparedId,
            operationId = operationId,
            filePath = destination.absolutePath,
            expected = expected,
            versionName = inspected.versionName,
            actualSha256 = downloaded.sha256,
            certificateSha256 = inspected.certificateSha256,
            permissions = inspected.permissions
          )
          prepared[preparedId] = record
          mapOf(
            "preparedId" to preparedId,
            "operationId" to operationId,
            "packageName" to inspected.packageName,
            "versionCode" to inspected.versionCode.toString(),
            "versionName" to inspected.versionName,
            "sha256" to downloaded.sha256,
            "certificateSha256" to inspected.certificateSha256,
            "permissions" to inspected.permissions,
            "byteSize" to downloaded.byteSize.toDouble()
          )
        }
      } catch (error: Throwable) {
        destination.delete()
        throw error
      } finally {
        cancellations.remove(operationId)
      }
    }

    AsyncFunction("installPrepared") Coroutine { preparedId: String ->
      val record = prepared[preparedId] ?: throw InstallerException("PREPARED_APK_NOT_FOUND", "Prepared APK is missing or expired")
      val context = requireContext()
      val file = File(record.filePath)
      if (!file.isFile) throw InstallerException("PREPARED_APK_NOT_FOUND", "Prepared APK file is missing")
      val actualHash = sha256(file)
      if (file.length() != record.expected.byteSize || actualHash != record.actualSha256) {
        file.delete()
        prepared.remove(preparedId)
        throw InstallerException("PREPARED_APK_CHANGED", "Prepared APK changed after validation")
      }
      ApkInspector.inspectAndValidate(context, file, record.expected)
      val packageInstaller = context.packageManager.packageInstaller
      val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
        setAppPackageName(record.expected.packageName)
        setSize(file.length())
        if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED)
      }
      val sessionId = packageInstaller.createSession(params)
      try {
        packageInstaller.openSession(sessionId).use { session ->
          FileInputStream(file).use { input ->
            session.openWrite("base.apk", 0, file.length()).use { output ->
              input.copyTo(output)
              session.fsync(output)
            }
          }
          val resultIntent = Intent(context, InstallResultReceiver::class.java).apply {
            putExtra(InstallResultReceiver.EXTRA_OPERATION_ID, record.operationId)
            putExtra(InstallResultReceiver.EXTRA_PACKAGE_NAME, record.expected.packageName)
          }
          val flags = PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
          val pending = PendingIntent.getBroadcast(context, sessionId, resultIntent, flags)
          InstallOperationStore.put(context, record.operationId, record.expected.packageName, "submitted", null)
          session.commit(pending.intentSender)
        }
      } catch (error: Throwable) {
        packageInstaller.abandonSession(sessionId)
        throw InstallerException("PACKAGE_INSTALLER_SUBMISSION_FAILED", "PackageInstaller rejected the session", error)
      } finally {
        file.delete()
        prepared.remove(preparedId)
      }
      mapOf(
        "operationId" to record.operationId,
        "preparedId" to preparedId,
        "sessionId" to sessionId,
        "status" to "submitted"
      )
    }

    AsyncFunction("getInstallOperation") { operationId: String ->
      InstallOperationStore.get(requireContext(), operationId)
    }

    AsyncFunction("cancel") { operationId: String ->
      cancellations[operationId]?.set(true)
      Unit
    }

    AsyncFunction("discardPrepared") { preparedId: String ->
      prepared.remove(preparedId)?.let { File(it.filePath).delete() }
      Unit
    }
  }

  private fun requireContext() = appContext.reactContext
    ?: throw InstallerException("ANDROID_CONTEXT_MISSING", "Android context is unavailable")

  private fun requireValidPackageName(packageName: String) {
    if (!packageName.matches(Regex("^[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+$"))) {
      throw InstallerException("PACKAGE_NAME_INVALID", "Android package name is invalid")
    }
  }

  private fun normalizeDigest(value: String): String = value.replace(":", "").trim().lowercase()

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        digest.update(buffer, 0, count)
      }
    }
    return digest.digest().toHex()
  }
}
