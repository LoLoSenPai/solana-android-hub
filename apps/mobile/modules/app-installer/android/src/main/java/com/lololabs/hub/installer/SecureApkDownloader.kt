package com.lololabs.hub.installer

import java.io.File
import java.net.Inet4Address
import java.net.Inet6Address
import java.net.InetAddress
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean
import javax.net.ssl.HttpsURLConnection

internal data class DownloadedApk(val file: File, val sha256: String, val byteSize: Long)

internal object SecureApkDownloader {
  private const val MAX_REDIRECTS = 3
  private const val CONNECT_TIMEOUT_MS = 10_000
  private const val READ_TIMEOUT_MS = 30_000

  fun download(
    initialUrl: String,
    destination: File,
    expectedBytes: Long,
    cancelled: AtomicBoolean
  ): DownloadedApk {
    require(expectedBytes in 1..(500L * 1024L * 1024L)) { "APK_SIZE_INVALID" }
    var current = URL(initialUrl)
    repeat(MAX_REDIRECTS + 1) { redirectCount ->
      validatePublicHttpsUrl(current)
      val connection = current.openConnection() as? HttpsURLConnection
        ?: throw InstallerException("APK_URL_NOT_HTTPS", "APK downloads require HTTPS")
      connection.instanceFollowRedirects = false
      connection.connectTimeout = CONNECT_TIMEOUT_MS
      connection.readTimeout = READ_TIMEOUT_MS
      connection.setRequestProperty("Accept", "application/vnd.android.package-archive, application/octet-stream")
      try {
        val status = connection.responseCode
        if (status in listOf(301, 302, 303, 307, 308)) {
          if (redirectCount == MAX_REDIRECTS) throw InstallerException("APK_REDIRECT_LIMIT", "APK redirect limit exceeded")
          val location = connection.getHeaderField("Location")
            ?: throw InstallerException("APK_REDIRECT_INVALID", "APK redirect is missing a destination")
          current = URL(current, location)
          return@repeat
        }
        if (status !in 200..299) throw InstallerException("APK_DOWNLOAD_HTTP", "APK download returned HTTP $status")
        val contentLength = connection.contentLengthLong
        if (contentLength > expectedBytes) throw InstallerException("APK_TOO_LARGE", "APK exceeds the expected byte size")

        val digest = MessageDigest.getInstance("SHA-256")
        var total = 0L
        connection.inputStream.use { input ->
          destination.outputStream().buffered().use { output ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
              if (cancelled.get()) throw InstallerException("APK_DOWNLOAD_CANCELLED", "APK download was cancelled")
              val count = input.read(buffer)
              if (count < 0) break
              total += count
              if (total > expectedBytes) throw InstallerException("APK_TOO_LARGE", "APK exceeds the expected byte size")
              digest.update(buffer, 0, count)
              output.write(buffer, 0, count)
            }
          }
        }
        return DownloadedApk(destination, digest.digest().toHex(), total)
      } finally {
        connection.disconnect()
      }
    }
    throw InstallerException("APK_REDIRECT_INVALID", "APK redirect could not be resolved")
  }

  private fun validatePublicHttpsUrl(url: URL) {
    if (url.protocol != "https" || url.userInfo != null || (url.port != -1 && url.port != 443)) {
      throw InstallerException("APK_URL_UNSAFE", "APK URL must be credential-free HTTPS on port 443")
    }
    val addresses = InetAddress.getAllByName(url.host)
    if (addresses.isEmpty() || addresses.any(::isNonPublicAddress)) {
      throw InstallerException("APK_ADDRESS_UNSAFE", "APK URL resolves to a non-public network")
    }
  }

  private fun isNonPublicAddress(address: InetAddress): Boolean {
    if (address.isAnyLocalAddress || address.isLoopbackAddress || address.isLinkLocalAddress ||
      address.isSiteLocalAddress || address.isMulticastAddress) return true
    return when (address) {
      is Inet4Address -> {
        val octets = address.address.map { it.toInt() and 0xff }
        val first = octets[0]
        val second = octets[1]
        first == 0 || first == 127 || first >= 224 ||
          (first == 100 && second in 64..127) || (first == 169 && second == 254) ||
          (first == 198 && second in 18..19)
      }
      is Inet6Address -> {
        val bytes = address.address
        (bytes[0].toInt() and 0xfe) == 0xfc ||
          ((bytes[0].toInt() and 0xff) == 0xfe && (bytes[1].toInt() and 0xc0) == 0x80) ||
          (bytes[0].toInt() and 0xff) == 0xff
      }
      else -> true
    }
  }
}

internal fun ByteArray.toHex(): String = joinToString("") { "%02x".format(it) }
