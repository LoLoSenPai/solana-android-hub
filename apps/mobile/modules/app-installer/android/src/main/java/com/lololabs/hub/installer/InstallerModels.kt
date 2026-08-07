package com.lololabs.hub.installer

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord

@OptimizedRecord
data class ExpectedReleaseRecord(
  @Field val downloadUrl: String,
  @Field val byteSize: Long,
  @Field val sha256: String,
  @Field val packageName: String,
  @Field val versionCode: String,
  @Field val minSdk: Int,
  @Field val certificateSha256: String,
  @Field val permissions: List<String>
) : Record

internal data class PreparedApkRecord(
  val preparedId: String,
  val operationId: String,
  val filePath: String,
  val expected: ExpectedReleaseRecord,
  val versionName: String?,
  val actualSha256: String,
  val certificateSha256: String,
  val permissions: List<String>
)
