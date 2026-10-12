import type { CatalogAppDto } from "@hub/api-client";
import type { DownloadProgressEvent, ExpectedRelease, InstallCapability, InstalledPackageInfo, InstallOperation, PreparedApk } from "@hub/app-installer";
import type { LocalInstallRecord } from "../../storage/database";
import { installErrorMessage } from "./errors";

export type PackageVisibility = "loading" | "installed" | "not_installed" | "visibility_unknown";
export interface AppInstallState {
  installedPackage: InstalledPackageInfo | null;
  installedPermissions: readonly string[] | undefined;
  visibility: PackageVisibility;
  stage: "idle" | "permission" | "downloading" | "checking" | "submitted" | "error";
  detail: string;
  fraction: number;
  busy: boolean;
}

export interface InstallDependencies {
  getInstallCapability: () => Promise<InstallCapability>;
  getInstalledPackageInfo: (packageName: string) => Promise<InstalledPackageInfo | { status: "not_installed" | "visibility_unknown" }>;
  openUnknownSourcesSettings: () => Promise<void>;
  openInstalledApp: (packageName: string) => Promise<void>;
  prepareInstall: (operationId: string, expected: ExpectedRelease) => Promise<PreparedApk>;
  installPrepared: (preparedId: string) => Promise<unknown>;
  getInstallOperation: (operationId: string) => Promise<InstallOperation | null>;
  discardPrepared: (preparedId: string) => Promise<void>;
  addListener: (eventName: "onDownloadProgress", listener: (event: DownloadProgressEvent) => void) => { remove(): void };
  listInstalledApps: () => Promise<readonly LocalInstallRecord[]>;
  saveInstalledApp: (record: LocalInstallRecord) => Promise<void>;
  wait: () => Promise<void>;
  now: () => number;
}

export const emptyInstallState: AppInstallState = {
  installedPackage: null, installedPermissions: undefined, visibility: "loading",
  stage: "idle", detail: "", fraction: 0, busy: false,
};
const pendingMessage = "Android has not confirmed the installation yet. Return after confirming or cancelling it.";

// Owned by the package store, not by a screen: navigation never cancels the download.
export function createInstallController(packageName: string, deps: InstallDependencies, resultTimeoutMs = 300_000) {
  let state = emptyInstallState;
  let refreshVersion = 0;
  let pending: { app: CatalogAppDto; operationId: string } | null = null;
  let reconcilePromise: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const patch = (value: Partial<AppInstallState>) => {
    state = { ...state, ...value };
    listeners.forEach((listener) => listener());
  };
  const fail = (cause: unknown) => patch({ stage: "error", detail: installErrorMessage(cause) });

  async function reconcile() {
    if (!pending) return;
    if (reconcilePromise) return reconcilePromise;
    const attempt = pending;
    reconcilePromise = (async () => {
      const operation = await deps.getInstallOperation(attempt.operationId);
      if (!operation || operation.status === "submitted") return;
      pending = null;
      if (operation.status !== "success") {
        throw new Error(operation.statusMessage ?? `Android install ${operation.status}`);
      }
      const app = attempt.app;
      await deps.saveInstalledApp({
        packageName, appId: app.id, slug: app.slug, appName: app.name,
        releaseId: app.latestRelease.id, versionCode: app.latestRelease.versionCode,
        versionName: app.latestRelease.versionName, certificateSha256: app.latestRelease.certificateSha256,
        permissions: app.latestRelease.permissions, installedAt: deps.now(),
      });
      patch({ stage: "idle", detail: `${app.name} is installed.`, fraction: 1 });
    })();
    try { await reconcilePromise; } finally { reconcilePromise = null; }
  }

  async function refresh() {
    const version = ++refreshVersion;
    // A cancelled update still leaves the previous version installed.
    try { await reconcile(); } catch (cause) { if (version === refreshVersion) fail(cause); }
    try {
      const [installed, records] = await Promise.all([
        deps.getInstalledPackageInfo(packageName), deps.listInstalledApps().catch(() => []),
      ]);
      if (version !== refreshVersion) return;
      // SQLite supplies permission history only. Android is the source of truth for Open/Update.
      const record = records.find((item) => item.packageName === packageName);
      patch({
        visibility: installed.status,
        installedPackage: installed.status === "installed" ? installed : null,
        installedPermissions: installed.status === "installed" && record?.versionCode === installed.versionCode
          && record.certificateSha256 === installed.certificateSha256 ? record.permissions : undefined,
      });
      if (state.stage === "permission") {
        const capability = await deps.getInstallCapability();
        if (version === refreshVersion && capability.canRequestPackageInstalls) {
          patch({ stage: "idle", detail: "Ready to download." });
        }
      }
    } catch (cause) {
      if (version === refreshVersion) {
        patch({ installedPackage: null, installedPermissions: undefined, visibility: "visibility_unknown" });
        fail(cause);
      }
    }
  }

  async function install(app: CatalogAppDto) {
    if (state.busy) return;
    // Set before the first await so two taps cannot both submit an Android session.
    patch({ busy: true });
    let preparedId: string | undefined;
    let progress: { remove(): void } | undefined;
    try {
      await reconcile();
      if (pending) {
        patch({ stage: "error", detail: pendingMessage });
        return;
      }
      const capability = await deps.getInstallCapability();
      if (!capability.supported) throw new Error("Installation is unsupported on this device");
      if (!capability.canRequestPackageInstalls) {
        patch({ stage: "permission", detail: "Allow installs from Dapport once, then return here." });
        await deps.openUnknownSourcesSettings();
        return;
      }
      const release = app.latestRelease;
      const operationId = `install_${deps.now()}_${Math.random().toString(36).slice(2)}`;
      patch({ stage: "downloading", detail: "Downloading app…", fraction: 0 });
      progress = deps.addListener("onDownloadProgress", (event) => {
        if (event.operationId !== operationId) return;
        const fraction = Number.isFinite(event.fraction) ? Math.min(1, Math.max(0, event.fraction)) : 0;
        patch({ fraction, ...(fraction >= 1 ? { stage: "checking", detail: "Download complete. Checking the app…" } : {}) });
      });
      const prepared = await deps.prepareInstall(operationId, {
        downloadUrl: release.apkUrl, byteSize: release.apkSize, sha256: release.apkSha256,
        packageName: release.packageName, versionCode: release.versionCode, minSdk: release.minSdk,
        certificateSha256: release.certificateSha256, permissions: release.permissions,
      });
      preparedId = prepared.preparedId;
      patch({ stage: "checking", detail: "App is ready. Opening Android…" });
      await deps.installPrepared(prepared.preparedId);
      pending = { app, operationId };
      patch({ stage: "submitted", detail: "Confirm the installation in Android." });
      const deadline = deps.now() + resultTimeoutMs;
      while (pending && deps.now() < deadline) {
        await deps.wait();
        await reconcile();
      }
      if (pending) patch({ stage: "error", detail: pendingMessage });
    } catch (cause) {
      fail(cause);
    } finally {
      progress?.remove();
      if (preparedId) await deps.discardPrepared(preparedId).catch(() => undefined);
      await refresh();
      patch({ busy: false });
    }
  }

  async function open() {
    if (state.busy) return;
    patch({ busy: true });
    try {
      await refresh();
      if (state.installedPackage) {
        await deps.openInstalledApp(packageName);
      } else {
        patch({ stage: "error", detail: state.visibility === "not_installed"
          ? "This app is no longer installed. Install it to continue."
          : "Android could not confirm this app is installed. Try opening it from your home screen." });
      }
    } catch (cause) { fail(cause); }
    finally { patch({ busy: false }); }
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    install, open, refresh,
  };
}
