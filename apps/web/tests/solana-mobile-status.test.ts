import { describe, expect, it } from "vitest";
import { solanaMobileStatus } from "../app/components/solana-mobile-status";

const release = { versionCode: "9", previewOnly: false, trust: { solanaMobileApproval: "unknown" as const } };
const visible = { status: "visible" as const, versionCode: "10" };

describe("Solana Mobile status", () => {
  it("shows a listed app while distinguishing a different, unconfirmed APK", () => {
    const status = solanaMobileStatus({ solanaMobileStore: visible, latestRelease: release });
    expect(status.label).toBe("On Solana Mobile");
    expect(status.releaseDescription).toContain("different version");
    expect(status.releaseDescription).toContain("not confirmed");
  });
  it("describes absence without implying rejection", () => {
    const status = solanaMobileStatus({ solanaMobileStore: { status: "not_visible", versionCode: null }, latestRelease: release });
    expect(status.label).toBe("Not on Solana Mobile");
    expect(status.visibilityDescription).toContain("does not mean it was rejected");
  });
  it("does not turn an unavailable check into a refusal", () => {
    expect(solanaMobileStatus({ solanaMobileStore: null, latestRelease: release }).label).toBe("Solana Mobile availability unverified");
  });
  it("retains the preview state alongside visibility", () => {
    const status = solanaMobileStatus({ solanaMobileStore: visible, latestRelease: { ...release, previewOnly: true } });
    expect(status.preview).toBe(true);
    expect(status.visibility).toBe("visible");
  });
  it("supports old verified DTOs but gives explicit store status precedence", () => {
    const verified = { ...release, trust: { solanaMobileApproval: "verified_approved" as const } };
    expect(solanaMobileStatus({ latestRelease: verified }).label).toBe("On Solana Mobile");
    expect(solanaMobileStatus({ solanaMobileStore: { status: "not_visible", versionCode: null }, latestRelease: verified }).label).toBe("Not on Solana Mobile");
  });
});
