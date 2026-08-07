package com.lololabs.hub.installer

import android.content.Context
import org.json.JSONObject

internal object InstallOperationStore {
  private const val PREFERENCES = "hub_installer_operations"
  private const val TIMEOUT_MS = 10 * 60 * 1000L

  fun put(
    context: Context,
    operationId: String,
    packageName: String,
    status: String,
    statusMessage: String?
  ) {
    val value = JSONObject()
      .put("operationId", operationId)
      .put("packageName", packageName)
      .put("status", status)
      .put("statusMessage", statusMessage)
      .put("updatedAt", System.currentTimeMillis())
    context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
      .edit()
      .putString(operationId, value.toString())
      .apply()
  }

  fun get(context: Context, operationId: String): Map<String, Any?>? {
    val encoded = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(operationId, null) ?: return null
    val value = JSONObject(encoded)
    val updatedAt = value.getLong("updatedAt")
    if (value.getString("status") == "submitted" && System.currentTimeMillis() - updatedAt > TIMEOUT_MS) {
      put(context, operationId, value.getString("packageName"), "timeout", "Android did not return an install result in time")
      return get(context, operationId)
    }
    return mapOf(
      "operationId" to operationId,
      "packageName" to value.getString("packageName"),
      "status" to value.getString("status"),
      "statusMessage" to if (value.isNull("statusMessage")) null else value.getString("statusMessage"),
      "updatedAt" to updatedAt.toDouble()
    )
  }
}
