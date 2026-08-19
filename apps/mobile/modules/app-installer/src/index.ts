import { requireNativeModule } from "expo-modules-core";

export interface InstallCapability {
  supported: boolean;
  canRequestPackageInstalls: boolean;
  requiresUnknownSourcesSettings: boolean;
}

export interface InstalledPackageInfo {
  status: "installed";
  packageName: string;
  versionCode: string;
  versionName: string | null;
  certificateSha256: string;
}

export interface ExpectedRelease {
  downloadUrl: string;
  byteSize: number;
  sha256: string;
  packageName: string;
  versionCode: string;
  minSdk: number;
  certificateSha256: string;
  permissions: readonly string[];
}

export interface PreparedApk {
  preparedId: string;
  operationId: string;
  packageName: string;
  versionCode: string;
  versionName: string | null;
  sha256: string;
  certificateSha256: string;
  permissions: readonly string[];
  byteSize: number;
}

export interface InstallSubmission {
  operationId: string;
  preparedId: string;
  sessionId: number;
  status: "submitted";
}

export interface InstallOperation {
  operationId: string;
  packageName: string;
  status: "submitted" | "success" | "cancelled" | "blocked" | "invalid" | "incompatible" | "conflict" | "storage" | "timeout" | "failure";
  statusMessage: string | null;
  updatedAt: number;
}

export interface DownloadProgressEvent {
  operationId: string;
  downloadedBytes: number;
  totalBytes: number;
  fraction: number;
}

interface NativeAppInstallerModule {
  // Optional at runtime so a mismatched legacy binary can fail with a useful
  // recovery message instead of throwing "undefined is not a function".
  getCurrentAppInfo?: () => Promise<InstalledPackageInfo>;
  getInstallCapability(): Promise<InstallCapability>;
  openUnknownSourcesSettings(): Promise<void>;
  getInstalledPackageInfo(packageName: string): Promise<InstalledPackageInfo | { status: "not_installed" } | { status: "visibility_unknown" }>;
  prepareInstall(operationId: string, expected: ExpectedRelease): Promise<PreparedApk>;
  installPrepared(preparedId: string): Promise<InstallSubmission>;
  getInstallOperation(operationId: string): Promise<InstallOperation | null>;
  cancel(operationId: string): Promise<void>;
  discardPrepared(preparedId: string): Promise<void>;
  addListener(eventName: "onDownloadProgress", listener: (event: DownloadProgressEvent) => void): { remove(): void };
}

export const AppInstaller = requireNativeModule<NativeAppInstallerModule>("AppInstaller");
