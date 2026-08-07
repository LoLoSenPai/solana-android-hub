package com.lololabs.hub.installer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

class InstallResultReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val operationId = intent.getStringExtra(EXTRA_OPERATION_ID) ?: return
    val packageName = intent.getStringExtra(EXTRA_PACKAGE_NAME) ?: "unknown"
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)

    if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
      val confirmation = if (Build.VERSION.SDK_INT >= 33) {
        intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
      } else {
        @Suppress("DEPRECATION")
        intent.getParcelableExtra(Intent.EXTRA_INTENT)
      }
      confirmation?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if (confirmation != null) context.startActivity(confirmation)
      return
    }

    val normalized = when (status) {
      PackageInstaller.STATUS_SUCCESS -> "success"
      PackageInstaller.STATUS_FAILURE_ABORTED -> "cancelled"
      PackageInstaller.STATUS_FAILURE_BLOCKED -> "blocked"
      PackageInstaller.STATUS_FAILURE_INVALID -> "invalid"
      PackageInstaller.STATUS_FAILURE_INCOMPATIBLE -> "incompatible"
      PackageInstaller.STATUS_FAILURE_CONFLICT -> "conflict"
      PackageInstaller.STATUS_FAILURE_STORAGE -> "storage"
      else -> "failure"
    }
    InstallOperationStore.put(context, operationId, packageName, normalized, message)
  }

  companion object {
    const val EXTRA_OPERATION_ID = "hub.operation_id"
    const val EXTRA_PACKAGE_NAME = "hub.package_name"
  }
}
