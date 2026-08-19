export function installErrorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  const normalized = message.toUpperCase();

  if (normalized.includes("APK_PERMISSIONS_MISMATCH")) {
    return "This app asks for a permission its publisher did not list. Nothing was installed.";
  }
  if (normalized.includes("APK_HASH_MISMATCH") || normalized.includes("APK_SIGNATURE_INVALID") || normalized.includes("APK_CERTIFICATE_MISMATCH")) {
    return "The downloaded app file could not be verified. Nothing was installed.";
  }
  if (normalized.includes("APK_DOWNLOAD") || normalized.includes("APK_SIZE") || normalized.includes("NETWORK") || normalized.includes("TIMEOUT")) {
    return "The download could not be completed. Please try again.";
  }
  if (normalized.includes("INSTALLED_EDITION_CONFLICT") || normalized.includes("CONFLICT")) {
    return "A different edition of this app is already installed. Dapport did not replace it.";
  }
  if (normalized.includes("APK_DOWNGRADE_REJECTED")) {
    return "A newer version is already installed. Dapport will not replace it with an older one.";
  }
  if (normalized.includes("CANCEL")) return "The installation was cancelled.";

  return "The app could not be prepared for installation. Please try again.";
}
