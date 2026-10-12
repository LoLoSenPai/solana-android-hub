import { describe, expect, it } from "vitest";
import { installErrorMessage } from "./errors";

describe("installErrorMessage", () => {
  it("reads the native code carried separately by an Expo bridge Error", () => {
    // Same Error + code shape as expo-modules-core's CodedError and native Promise rejection.
    const cause = Object.assign(new Error("APK requests permissions not listed in Release metadata"), {
      code: "APK_PERMISSIONS_MISMATCH",
    });
    expect(installErrorMessage(cause))
      .toBe("This app asks for a permission its publisher did not list. Nothing was installed.");
  });

  it("reads plain bridge objects and gives known codes precedence over message wording", () => {
    expect(installErrorMessage({ code: "APK_PERMISSIONS_MISMATCH", message: "Network timeout" }))
      .toBe("This app asks for a permission its publisher did not list. Nothing was installed.");
    expect(installErrorMessage({ code: "INSTALLED_EDITION_CONFLICT", message: "APK_HASH_MISMATCH" }))
      .toBe("A different edition of this app is already installed. Dapport did not replace it.");
  });

  it.each([
    "APK_HASH_MISMATCH", "APK_SIGNATURE_INVALID", "APK_CERTIFICATE_MISMATCH",
    "APK_PACKAGE_MISMATCH", "APK_VERSION_MISMATCH", "APK_MIN_SDK_MISMATCH",
    "APK_MANIFEST_INVALID", "APK_SIGNER_UNSUPPORTED", "PREPARED_APK_CHANGED",
  ])("explains failed APK verification for %s", (code) => {
    const expected = "The downloaded app file could not be verified. Nothing was installed.";
    expect(installErrorMessage({ code, message: "Private native detail" })).toBe(expected);
    expect(installErrorMessage(new Error(`Native rejection: ${code}`))).toBe(expected);
  });

  it("does not mistake download cancellation for a download failure", () => {
    expect(installErrorMessage({ code: "APK_DOWNLOAD_CANCELLED", message: "APK download was cancelled" }))
      .toBe("The installation was cancelled.");
    expect(installErrorMessage("APK_DOWNLOAD_CANCELLED")).toBe("The installation was cancelled.");
  });

  it("explains downgrade rejection", () => {
    expect(installErrorMessage({ code: "APK_DOWNGRADE_REJECTED" }))
      .toBe("A newer version is already installed. Dapport will not replace it with an older one.");
  });

  it("retains message fallback for unknown and malformed bridge codes", () => {
    expect(installErrorMessage({ code: "UNKNOWN", message: "NETWORK timeout" }))
      .toBe("The download could not be completed. Please try again.");
    expect(installErrorMessage({ code: 123, message: "INSTALLED_EDITION_CONFLICT" }))
      .toBe("A different edition of this app is already installed. Dapport did not replace it.");
  });

  it("hides native bridge wording from users", () => {
    expect(installErrorMessage(new Error("Call to function 'AppInstaller.prepareInstall' has been rejected → APK_PERMISSIONS_MISMATCH")))
      .toBe("This app asks for a permission its publisher did not list. Nothing was installed.");
  });

  it("uses a safe generic fallback", () => {
    expect(installErrorMessage(new Error("unexpected native detail")))
      .toBe("The app could not be prepared for installation. Please try again.");
  });

  it.each([null, undefined, 123, {}, { code: {}, message: [] }, { code: "toString", message: "Private detail" }])(
    "uses a safe fallback for malformed causes: %j", (cause) => {
      expect(installErrorMessage(cause))
        .toBe("The app could not be prepared for installation. Please try again.");
    },
  );
});
