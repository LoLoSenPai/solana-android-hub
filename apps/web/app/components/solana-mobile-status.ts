type StoreStatusInput = {
  solanaMobileStore?: { status: "visible" | "not_visible"; versionCode: string | null } | null;
  latestRelease: {
    versionCode: string;
    previewOnly: boolean;
    trust: { solanaMobileApproval: "unknown" | "verified_approved" | "rejected" };
  };
};

export function solanaMobileStatus(app: StoreStatusInput) {
  const store = app.solanaMobileStore;
  const approval = app.latestRelease.trust.solanaMobileApproval;
  const visibility = store?.status ?? (approval === "verified_approved" ? "visible" : "unknown");
  const label = visibility === "visible" ? "On Solana Mobile" : visibility === "not_visible" ? "Not on Solana Mobile" : "Solana Mobile availability unverified";
  let releaseDescription: string;
  if (store?.status === "visible" && store.versionCode !== null && store.versionCode !== app.latestRelease.versionCode) {
    releaseDescription = "The official store lists a different version. Approval of the APK offered here is not confirmed.";
  } else if (approval === "verified_approved") {
    releaseDescription = "This APK version is verified against the official Solana Mobile release.";
  } else {
    releaseDescription = "Approval of the APK offered here is not confirmed.";
  }
  const visibilityDescription = visibility === "visible"
    ? "This app is listed on Solana Mobile."
    : visibility === "not_visible"
      ? "This app was not found on Solana Mobile. This does not mean it was rejected."
      : "Solana Mobile availability could not be verified.";
  return { visibility, label, visibilityDescription, releaseDescription, preview: app.latestRelease.previewOnly };
}
