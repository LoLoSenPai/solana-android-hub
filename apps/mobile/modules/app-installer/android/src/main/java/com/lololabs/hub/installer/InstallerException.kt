package com.lololabs.hub.installer

import expo.modules.kotlin.exception.CodedException

internal class InstallerException(code: String, message: String, cause: Throwable? = null) :
  CodedException(code, message, cause)
