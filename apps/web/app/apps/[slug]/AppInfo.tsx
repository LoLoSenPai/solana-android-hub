import type { CatalogAppDto } from "@hub/api-client";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import Link from "next/link";
import type { ReactNode } from "react";
import { solanaMobileStatus } from "../../components/solana-mobile-status";
import { categoryLabel } from "../../components/catalog-config";
import { DetailAnchors } from "./DetailAnchors";
import styles from "./page.module.css";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

export function AppInfo({ app }: { app: CatalogAppDto }) {
  const release = app.latestRelease;
  const { trust } = release;
  const status = solanaMobileStatus(app);
  const store = app.solanaMobileStore;
  const versionName = androidVersions[release.minSdk];
  const size = new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(release.apkSize / 1e6);
  return <aside className={styles.info} aria-labelledby="app-info-title">
    <DetailAnchors />
    <h2 id="app-info-title">App info</h2>
    <dl>
      <Fact label="Category">{categoryLabel(app.category)}</Fact>
      <Fact label="Version">{release.versionName}</Fact>
      <Fact label="Download size">{size} MB</Fact>
      <Fact label="Requires Android">{versionName ? versionName + " or later" : "API " + release.minSdk + "+"}</Fact>
    </dl>
    <details id="permissions">
      <summary>Requested permissions <span className={styles.count}>{release.permissions.length}</span></summary>
      {release.permissions.length > 0 ? <>
        <p>Version {release.versionName} declares these permissions in its Android manifest. Android asks for permission when required.</p>
        <ul className={styles.permissions}>
          {release.permissions.map(permission => <li key={permission}>
            <strong>{permissionNames[permission] ?? (permission.endsWith(".DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION") ? "Protect internal Android event receivers" : "Additional manifest permission")}</strong>
            <code>{permission}</code>
          </li>)}
        </ul>
      </> : <p>This version declares no permissions in its Android manifest.</p>}
      <Link href="/security#app-permissions">How app permissions work</Link>
    </details>
    <details id="technical">
      <summary>Verification &amp; APK details</summary>
      <p>Checks for version {release.versionName}</p>
      <dl>
        <Fact label="Publisher control">Dapport verified the publisher’s authority to manage this app.</Fact>
        <Fact label="Distribution consent">{app.publisher?.displayName || "The publisher"} authorized distribution through Dapport.</Fact>
        <Fact label="Dapport file check">{trust.releaseAuthenticity === "server_binary_valid" ? "Passed. The APK matches its published identity and signing certificate." : "Development preview. A completed file check is unconfirmed for this APK."}</Fact>
        <Fact label="Official Solana Mobile listing">{status.visibilityDescription}{store?.status === "visible" && store.versionCode ? ` Official version code ${store.versionCode}.` : ""}</Fact>
        <Fact label="Solana Mobile approval for this APK">{trust.solanaMobileApproval === "rejected" ? "Rejected for this APK." : status.releaseDescription}</Fact>
      </dl>
      <h3>APK identifiers</h3>
      <dl className={styles.identifiers}>
        <Fact label="Package">{release.packageName}</Fact>
        <Fact label="Version code">{release.versionCode}</Fact>
        {release.targetSdk && <Fact label="Target SDK">API {release.targetSdk}</Fact>}
        <Fact label="APK SHA-256">{release.apkSha256}</Fact>
        <Fact label="Signing certificate SHA-256">{release.certificateSha256}</Fact>
      </dl>
      <Link href="/security#release-checks">How Dapport checks APKs</Link>
    </details>
    <details id="install">
      <summary>How to install</summary>
      <p>Get Dapport on your Android phone, then open this app’s listing in Dapport to install it.</p>
      <Link href="/security#android-permission">Allowing Dapport to install apps</Link>
      <div className={styles.direct}>
        <p id="direct-apk-note">A direct download skips Dapport’s final on-device checks, including the APK identity, signer and downgrade checks. Android still handles the installation.</p>
        <a href={release.apkUrl} target="_blank" rel="noreferrer nofollow" referrerPolicy="no-referrer" aria-describedby="direct-apk-note">
          Download APK directly <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      </div>
    </details>
  </aside>;
}

const androidVersions: Record<number, string> = {
  21: "5", 22: "5.1", 23: "6", 24: "7", 25: "7.1", 26: "8", 27: "8.1", 28: "9", 29: "10",
  30: "11", 31: "12", 32: "12L", 33: "13", 34: "14", 35: "15", 36: "16"
};

const permissionNames: Record<string, string> = {
    "android.permission.ACCESS_ADSERVICES_AD_ID": "Advertising ID",
    "android.permission.ACCESS_ADSERVICES_ATTRIBUTION": "Ad attribution",
    "android.permission.ACCESS_ADSERVICES_TOPICS": "Ad interest topics",
    "android.permission.ACCESS_FINE_LOCATION": "Precise location",
    "android.permission.ACCESS_NETWORK_STATE": "View network status",
    "android.permission.ACCESS_NOTIFICATION_POLICY": "Manage Do Not Disturb access",
    "android.permission.AUDIO_CAPTURE": "Audio capture",
    "android.permission.CAMERA": "Camera",
    "android.permission.FOREGROUND_SERVICE": "Run an ongoing task",
    "android.permission.FOREGROUND_SERVICE_DATA_SYNC": "Run an ongoing sync task",
    "android.permission.FOREGROUND_SERVICE_REMOTE_MESSAGING": "Run an ongoing messaging task",
    "android.permission.FOREGROUND_SERVICE_SPECIAL_USE": "Run an ongoing task for a special use",
    "android.permission.INTERNET": "Internet access",
    "android.permission.MODIFY_AUDIO_SETTINGS": "Change audio settings",
    "android.permission.POST_NOTIFICATIONS": "Send notifications",
    "android.permission.READ_BASIC_PHONE_STATE": "Read basic phone state",
    "android.permission.READ_MEDIA_AUDIO": "Read audio files",
    "android.permission.READ_MEDIA_IMAGES": "Read photos",
    "android.permission.READ_MEDIA_VIDEO": "Read videos",
    "android.permission.RECEIVE_BOOT_COMPLETED": "Receive a signal when Android starts",
    "android.permission.RECORD_AUDIO": "Microphone",
    "android.permission.REORDER_TASKS": "Reorder app tasks",
    "android.permission.REQUEST_INSTALL_PACKAGES": "Request app installation",
    "android.permission.VIBRATE": "Vibrate the device",
    "android.permission.VIDEO_CAPTURE": "Video capture",
    "android.permission.WAKE_LOCK": "Keep the device awake",
    "android.webkit.resource.AUDIO_CAPTURE": "Web content audio capture",
    "android.webkit.resource.VIDEO_CAPTURE": "Web content video capture",
    "com.google.android.gms.permission.AD_ID": "Google Play services advertising ID"
  };
