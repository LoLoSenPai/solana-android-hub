import { describe, expect, it } from "vitest";
import { installErrorMessage } from "./errors";

describe("installErrorMessage", () => {
  it("hides native bridge wording from users", () => {
    expect(installErrorMessage(new Error("Call to function 'AppInstaller.prepareInstall' has been rejected → APK_PERMISSIONS_MISMATCH")))
      .toBe("This app asks for a permission its publisher did not list. Nothing was installed.");
  });

  it("uses a safe generic fallback", () => {
    expect(installErrorMessage(new Error("unexpected native detail")))
      .toBe("The app could not be prepared for installation. Please try again.");
  });
});
