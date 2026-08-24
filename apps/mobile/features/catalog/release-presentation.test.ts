import { describe, expect, it } from "vitest";
import { approvalLabel, humanizePermission, permissionSummary, releaseBadgeLabel } from "./release-presentation";

describe("release presentation", () => {
  it("does not confuse a Hub preview with product early access", () => {
    expect(releaseBadgeLabel(true, "unknown")).toBe("Preview release");
    expect(releaseBadgeLabel(false, "unknown")).toBeNull();
    expect(releaseBadgeLabel(true, "verified_approved")).toBe("Solana Mobile approved");
  });

  it("presents approval without implying missing evidence is approval", () => {
    expect(approvalLabel("verified_approved")).toBe("Visible on Solana Mobile");
    expect(approvalLabel("unknown")).toBe("Not verified by Solana Mobile");
    expect(approvalLabel("rejected")).toBe("Not verified by Solana Mobile");
  });

  it("turns common Android permission identifiers into useful names", () => {
    expect(humanizePermission("android.permission.INTERNET")).toBe("Internet access");
    expect(humanizePermission("android.adservices.common.ACCESS_ADSERVICES_TOPICS")).toBe("Interest-based advertising topics");
    expect(humanizePermission("com.example.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION")).toBe("Internal app component protection");
  });

  it("summarizes permission counts", () => {
    expect(permissionSummary([])).toBe("No permissions declared for this release");
    expect(permissionSummary(["android.permission.INTERNET"])).toBe("1 permission declared · Tap to review");
    expect(permissionSummary(["a", "b"])).toBe("2 permissions declared · Tap to review");
  });
});
