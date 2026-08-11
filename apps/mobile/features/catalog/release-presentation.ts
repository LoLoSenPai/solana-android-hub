import type { CatalogAppDto } from "@hub/api-client";

type ApprovalStatus = CatalogAppDto["latestRelease"]["trust"]["solanaMobileApproval"];

const PERMISSION_NAMES: Readonly<Record<string, string>> = {
  "android.adservices.common.ACCESS_ADSERVICES_AD_ID": "Advertising identifier",
  "android.adservices.common.ACCESS_ADSERVICES_ATTRIBUTION": "Ad measurement",
  "android.adservices.common.ACCESS_ADSERVICES_TOPICS": "Interest-based advertising topics",
  "android.permission.ACCESS_ADSERVICES_AD_ID": "Advertising identifier",
  "android.permission.ACCESS_ADSERVICES_ATTRIBUTION": "Ad measurement",
  "android.permission.ACCESS_ADSERVICES_TOPICS": "Interest-based advertising topics",
  "android.permission.ACCESS_FINE_LOCATION": "Precise location",
  "android.permission.ACCESS_NETWORK_STATE": "Network connection status",
  "android.permission.CAMERA": "Camera",
  "android.permission.FOREGROUND_SERVICE": "Run tasks while the app is in use",
  "android.permission.INTERNET": "Internet access",
  "android.permission.POST_NOTIFICATIONS": "Notifications",
  "android.permission.READ_BASIC_PHONE_STATE": "Basic device information",
  "android.permission.READ_MEDIA_IMAGES": "Photos",
  "android.permission.RECORD_AUDIO": "Microphone",
  "android.permission.VIBRATE": "Vibration",
  "android.permission.WAKE_LOCK": "Keep the device awake",
  "com.google.android.gms.permission.AD_ID": "Advertising identifier"
};

export function approvalLabel(value: ApprovalStatus): string {
  if (value === "verified_approved") return "Approved";
  if (value === "rejected") return "Rejected";
  return "Not verified";
}

export function releaseBadgeLabel(previewOnly: boolean, approval: ApprovalStatus): string | null {
  if (approval === "verified_approved") return "Solana Mobile approved";
  if (previewOnly) return "Preview release";
  return null;
}

export function humanizePermission(permission: string): string {
  const knownName = PERMISSION_NAMES[permission];
  if (knownName) return knownName;
  if (permission.endsWith(".DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION")) return "Internal app component protection";
  const value = permission.split(".").at(-1) ?? permission;
  return value.toLocaleLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toLocaleUpperCase());
}

export function permissionSummary(permissions: readonly string[]): string {
  if (permissions.length === 0) return "No permissions declared for this release";
  return `${permissions.length} ${permissions.length === 1 ? "permission" : "permissions"} declared · Tap to review`;
}
