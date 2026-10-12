package com.lololabs.hub.installer

import android.content.pm.PackageInfo

internal object ApkPermissionPolicy {
  fun implicitlyAddedPermissions(permissions: Array<String>?, flags: IntArray?, platformSdk: Int): List<String> {
    if (platformSdk < 34) return emptyList()
    // Android marks compatibility permissions it added itself. Missing flags
    // remain explicit, and an APK's own uses-permission declarations stay checked.
    return permissions?.filterIndexed { index, _ ->
      ((flags?.getOrNull(index) ?: 0) and PackageInfo.REQUESTED_PERMISSION_IMPLICIT) != 0
    } ?: emptyList()
  }
}
