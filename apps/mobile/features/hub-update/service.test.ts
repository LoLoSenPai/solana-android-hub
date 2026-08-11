import { beforeEach, describe, expect, it, vi } from "vitest";

const nativeInstaller = vi.hoisted(() => ({
  getCurrentAppInfo: undefined as undefined | (() => Promise<never>)
}));

vi.mock("@hub/app-installer", () => ({ AppInstaller: nativeInstaller }));
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        hubUpdater: {
          enabled: true,
          manifestUrl: "https://dapport.app/api/v1/hub/releases/latest",
          packageName: "com.lololabs.solanaandroidhub",
          releaseCertificateSha256: "a".repeat(64)
        }
      }
    }
  }
}));
vi.mock("@/storage/database", () => ({
  getHubUpdateCache: vi.fn(),
  setHubUpdateCache: vi.fn()
}));

import { checkForHubUpdate } from "./service";

describe("Hub update native compatibility", () => {
  beforeEach(() => {
    nativeInstaller.getCurrentAppInfo = undefined;
  });

  it("explains how to recover when an installed binary lacks the native updater bridge", async () => {
    await expect(checkForHubUpdate({ force: true })).resolves.toEqual({
      status: "error",
      message: "This Dapport build cannot update itself. Download the latest signed APK once from dapport.app to enable future in-app updates."
    });
  });
});
