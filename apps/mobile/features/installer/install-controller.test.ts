import { describe, expect, it, vi } from "vitest";
import type { CatalogAppDto } from "@hub/api-client";
import type { InstallDependencies } from "./install-controller";
import { createInstallController } from "./install-controller";

const app = {
  id: "app", slug: "example", name: "Example",
  latestRelease: {
    id: "release", packageName: "com.example", versionCode: "2", versionName: "2.0",
    certificateSha256: "cert", permissions: ["permission"], apkUrl: "https://example.com/app.apk",
    apkSize: 123, apkSha256: "hash", minSdk: 26,
  },
} as CatalogAppDto;
const installed = {
  status: "installed" as const, packageName: "com.example", versionCode: "2",
  versionName: "2.0", certificateSha256: "cert",
};

function harness(timeout = 3000) {
  let now = 0;
  const remove = vi.fn();
  const deps: InstallDependencies = {
    getInstallCapability: vi.fn(() => Promise.resolve({ supported: true, canRequestPackageInstalls: true, requiresUnknownSourcesSettings: false })),
    getInstalledPackageInfo: vi.fn(() => Promise.resolve({ status: "not_installed" as const })),
    openUnknownSourcesSettings: vi.fn(() => Promise.resolve()),
    openInstalledApp: vi.fn(() => Promise.resolve()),
    prepareInstall: vi.fn((operationId: string) => Promise.resolve({ preparedId: "prepared", operationId, ...installed, sha256: "hash", permissions: ["permission"], byteSize: 123 })),
    installPrepared: vi.fn(() => Promise.resolve()),
    getInstallOperation: vi.fn((operationId: string) => Promise.resolve({ operationId, packageName: "com.example", status: "success" as const, statusMessage: null, updatedAt: now })),
    discardPrepared: vi.fn(() => Promise.resolve()),
    cancel: vi.fn(() => Promise.resolve()),
    addListener: vi.fn(() => ({ remove })),
    listInstalledApps: vi.fn(() => Promise.resolve([])),
    saveInstalledApp: vi.fn(() => Promise.resolve()),
    wait: () => { now += 1000; return Promise.resolve(); }, now: () => now,
  };
  return { deps, remove, controller: createInstallController("com.example", deps, timeout) };
}

describe("shared install controller", () => {
  it("blocks duplicate synchronous taps and saves only after Android success", async () => {
    const { deps, controller, remove } = harness();
    let finish!: () => void;
    vi.mocked(deps.installPrepared).mockImplementation(() => new Promise((resolve) => { finish = () => resolve(undefined); }));
    const first = controller.install(app);
    const second = controller.install(app);
    await vi.waitFor(() => expect(deps.installPrepared).toHaveBeenCalledTimes(1));
    expect(deps.saveInstalledApp).not.toHaveBeenCalled();
    finish();
    await Promise.all([first, second]);
    expect(deps.prepareInstall).toHaveBeenCalledTimes(1);
    expect(deps.saveInstalledApp).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().busy).toBe(false);
  });

  it("does not expose stale SQLite installations as installed", async () => {
    const { deps, controller } = harness();
    vi.mocked(deps.listInstalledApps).mockResolvedValue([{ packageName: "com.example", versionCode: "2", certificateSha256: "cert", permissions: ["permission"] } as never]);
    await controller.refresh();
    expect(controller.getSnapshot().installedPackage).toBeNull();
    expect(controller.getSnapshot().installedPermissions).toBeUndefined();
    await controller.open();
    expect(deps.openInstalledApp).not.toHaveBeenCalled();
    vi.mocked(deps.getInstalledPackageInfo).mockResolvedValue({ status: "visibility_unknown" });
    await controller.refresh();
    expect(controller.getSnapshot().visibility).toBe("visibility_unknown");
  });

  it("bounds result polling and prevents resubmission while the Android result is pending", async () => {
    const { deps, controller } = harness();
    vi.mocked(deps.getInstallOperation).mockResolvedValue(null);
    await controller.install(app);
    expect(controller.getSnapshot()).toMatchObject({ stage: "error", busy: false });
    expect(deps.saveInstalledApp).not.toHaveBeenCalled();
    await controller.install(app);
    expect(deps.installPrepared).toHaveBeenCalledTimes(1);
    vi.mocked(deps.getInstallOperation).mockImplementation((operationId) => Promise.resolve({ operationId, packageName: "com.example", status: "success", statusMessage: null, updatedAt: 4000 }));
    vi.mocked(deps.getInstalledPackageInfo).mockResolvedValue(installed);
    await controller.refresh();
    expect(controller.getSnapshot()).toMatchObject({ stage: "idle", installedPackage: installed });
    expect(deps.saveInstalledApp).toHaveBeenCalledTimes(1);
  });

  it("cleans the listener and prepared file on cancellation without recording a successful install", async () => {
    const { deps, controller, remove } = harness();
    vi.mocked(deps.getInstallOperation).mockImplementation((operationId) => Promise.resolve({ operationId, packageName: "com.example", status: "cancelled", statusMessage: "INSTALL_FAILED_ABORTED: User rejected permissions", updatedAt: 1000 }));
    await controller.install(app);
    expect(controller.getSnapshot()).toMatchObject({ stage: "error", busy: false, detail: "The installation was cancelled." });
    expect(deps.saveInstalledApp).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(deps.discardPrepared).toHaveBeenCalledWith("prepared");
  });

  it("opens settings before any download, then refreshes permission on return", async () => {
    const { deps, controller } = harness();
    vi.mocked(deps.getInstallCapability).mockResolvedValue({ supported: true, canRequestPackageInstalls: false, requiresUnknownSourcesSettings: true });
    await controller.install(app);
    expect(controller.getSnapshot().stage).toBe("permission");
    expect(deps.openUnknownSourcesSettings).toHaveBeenCalledTimes(1);
    expect(deps.prepareInstall).not.toHaveBeenCalled();
    vi.mocked(deps.getInstallCapability).mockResolvedValue({ supported: true, canRequestPackageInstalls: true, requiresUnknownSourcesSettings: false });
    await controller.refresh();
    expect(controller.getSnapshot().stage).toBe("idle");
  });

  it("keeps a download running when a screen unsubscribes", async () => {
    const { deps, controller, remove } = harness();
    let finish!: () => void;
    vi.mocked(deps.prepareInstall).mockImplementation((operationId) => new Promise((resolve) => {
      finish = () => resolve({ preparedId: "prepared", operationId, ...installed, sha256: "hash", permissions: [], byteSize: 123 });
    }));
    const unsubscribe = controller.subscribe(vi.fn());
    const attempt = controller.install(app);
    await vi.waitFor(() => expect(deps.prepareInstall).toHaveBeenCalled());
    unsubscribe();
    expect(remove).not.toHaveBeenCalled();
    finish();
    await attempt;
    expect(deps.saveInstalledApp).toHaveBeenCalledTimes(1);
  });

  it("filters progress by operation and removes listeners after a verification error", async () => {
    const { deps, controller, remove } = harness();
    vi.mocked(deps.prepareInstall).mockImplementation((operationId) => {
      const listener = vi.mocked(deps.addListener).mock.calls[0]![1];
      listener({ operationId: "other", fraction: 1, downloadedBytes: 123, totalBytes: 123 });
      expect(controller.getSnapshot().fraction).toBe(0);
      listener({ operationId, fraction: 0.5, downloadedBytes: 61, totalBytes: 123 });
      expect(controller.getSnapshot().fraction).toBe(0.5);
      return Promise.reject(Object.assign(new Error("APK_HASH_MISMATCH"), { code: "APK_HASH_MISMATCH" }));
    });
    await controller.install(app);
    expect(controller.getSnapshot()).toMatchObject({ stage: "error", busy: false });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(deps.installPrepared).not.toHaveBeenCalled();
    expect(deps.saveInstalledApp).not.toHaveBeenCalled();
  });

  it("rechecks the native package before Open and does not download or open twice", async () => {
    const { deps, controller } = harness();
    vi.mocked(deps.getInstalledPackageInfo).mockResolvedValue(installed);
    await Promise.all([controller.open(), controller.open()]);
    expect(deps.openInstalledApp).toHaveBeenCalledTimes(1);
    expect(deps.prepareInstall).not.toHaveBeenCalled();
    vi.mocked(deps.getInstalledPackageInfo).mockResolvedValue({ status: "not_installed" });
    await controller.open();
    expect(deps.openInstalledApp).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ stage: "error", installedPackage: null });
  });

  it("cancels an active native download without installing and ignores further progress", async () => {
    const { deps, controller, remove } = harness();
    let abort!: () => void;
    vi.mocked(deps.prepareInstall).mockImplementation(() => new Promise((_resolve, reject) => {
      abort = () => reject(Object.assign(new Error("APK_DOWNLOAD_CANCELLED"), { code: "APK_DOWNLOAD_CANCELLED" }));
    }));
    vi.mocked(deps.getInstalledPackageInfo).mockResolvedValue({ ...installed, versionCode: "1" });
    const attempt = controller.install(app);
    await vi.waitFor(() => expect(deps.prepareInstall).toHaveBeenCalledTimes(1));
    const operationId = vi.mocked(deps.prepareInstall).mock.calls[0]![0];
    await Promise.all([controller.cancel(), controller.cancel()]);
    expect(deps.cancel).toHaveBeenCalledExactlyOnceWith(operationId);
    expect(controller.getSnapshot()).toMatchObject({ stage: "cancelling", busy: true });
    const listener = vi.mocked(deps.addListener).mock.calls[0]![1];
    listener({ operationId, fraction: 1, downloadedBytes: 123, totalBytes: 123 });
    expect(controller.getSnapshot()).toMatchObject({ stage: "cancelling", fraction: 0 });
    abort();
    await attempt;
    expect(controller.getSnapshot()).toMatchObject({ stage: "idle", fraction: 0, busy: false,
      detail: "The download was cancelled.", installedPackage: { versionCode: "1" } });
    expect(deps.installPrepared).not.toHaveBeenCalled();
    expect(deps.saveInstalledApp).not.toHaveBeenCalled();
    expect(deps.discardPrepared).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("discards a preparation resolved after cancellation before making the action available again", async () => {
    const { deps, controller, remove } = harness();
    let finish!: () => void;
    let cleaned!: () => void;
    vi.mocked(deps.prepareInstall).mockImplementation((operationId) => new Promise((resolve) => {
      finish = () => resolve({ preparedId: "late-prepared", operationId, ...installed, sha256: "hash", permissions: [], byteSize: 123 });
    }));
    vi.mocked(deps.discardPrepared).mockImplementation(() => new Promise((resolve) => { cleaned = resolve; }));
    const attempt = controller.install(app);
    await vi.waitFor(() => expect(deps.prepareInstall).toHaveBeenCalled());
    await controller.cancel();
    finish();
    await vi.waitFor(() => expect(deps.discardPrepared).toHaveBeenCalledWith("late-prepared"));
    expect(controller.getSnapshot()).toMatchObject({ stage: "cancelling", busy: true });
    expect(deps.installPrepared).not.toHaveBeenCalled();
    expect(deps.saveInstalledApp).not.toHaveBeenCalled();
    cleaned();
    await attempt;
    expect(controller.getSnapshot()).toMatchObject({ stage: "idle", fraction: 0, busy: false });
    expect(remove).toHaveBeenCalledTimes(1);
    await controller.cancel();
    expect(deps.cancel).toHaveBeenCalledTimes(1);
  });
});
