const permissionMessage = "This app asks for a permission its publisher did not list. Nothing was installed.";
const verificationMessage = "The downloaded app file could not be verified. Nothing was installed.";
const downloadMessage = "The download could not be completed. Please try again.";
const conflictMessage = "A different edition of this app is already installed. Dapport did not replace it.";
const downgradeMessage = "A newer version is already installed. Dapport will not replace it with an older one.";
const cancelledMessage = "The installation was cancelled.";

const codeMessages: Record<string, string> = {
  APK_PERMISSIONS_MISMATCH: permissionMessage,
  APK_HASH_MISMATCH: verificationMessage,
  APK_SIGNATURE_INVALID: verificationMessage,
  APK_CERTIFICATE_MISMATCH: verificationMessage,
  APK_PACKAGE_MISMATCH: verificationMessage,
  APK_VERSION_MISMATCH: verificationMessage,
  APK_MIN_SDK_MISMATCH: verificationMessage,
  APK_MANIFEST_INVALID: verificationMessage,
  APK_SIGNER_UNSUPPORTED: verificationMessage,
  PREPARED_APK_CHANGED: verificationMessage,
  APK_SIZE_MISMATCH: downloadMessage,
  APK_SIZE_INVALID: downloadMessage,
  APK_TOO_LARGE: downloadMessage,
  APK_DOWNLOAD_HTTP: downloadMessage,
  APK_URL_NOT_HTTPS: downloadMessage,
  APK_URL_UNSAFE: downloadMessage,
  APK_ADDRESS_UNSAFE: downloadMessage,
  APK_REDIRECT_LIMIT: downloadMessage,
  APK_REDIRECT_INVALID: downloadMessage,
  INSTALLED_EDITION_CONFLICT: conflictMessage,
  APK_DOWNGRADE_REJECTED: downgradeMessage,
  APK_DOWNLOAD_CANCELLED: cancelledMessage,
};

export function installErrorMessage(cause: unknown): string {
  const error = typeof cause === "object" && cause !== null ? cause as Record<string, unknown> : undefined;
  const code = typeof error?.code === "string" ? error.code.toUpperCase() : "";
  // Expo bridge errors carry the native code separately from their human-readable message.
  if (Object.hasOwn(codeMessages, code)) return codeMessages[code]!;

  const message = typeof error?.message === "string" ? error.message : typeof cause === "string" ? cause : "";
  const normalized = message.toUpperCase();

  if (normalized.includes("CANCEL")) return cancelledMessage;

  for (const [knownCode, userMessage] of Object.entries(codeMessages)) {
    if (normalized.includes(knownCode)) return userMessage;
  }
  if (normalized.includes("APK_DOWNLOAD") || normalized.includes("APK_SIZE") || normalized.includes("NETWORK") || normalized.includes("TIMEOUT")) {
    return downloadMessage;
  }
  if (normalized.includes("INSTALLED_EDITION_CONFLICT") || normalized.includes("CONFLICT")) {
    return conflictMessage;
  }

  return "The app could not be prepared for installation. Please try again.";
}
