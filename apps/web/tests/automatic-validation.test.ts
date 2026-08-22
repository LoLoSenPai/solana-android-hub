import { describe, expect, it } from "vitest";
import type { SavedRelease } from "@hub/database";
import { shouldRequestAutomaticValidation } from "../server/automatic-validation";

const release: SavedRelease = {
  id: "release-id",
  releaseMint: "release-mint",
  validationStatus: "metadata_valid",
  publicationStatus: "unpublished",
  quarantineCode: null
};

describe("automatic release validation", () => {
  it("requests checks for a new clean release under the automatic policy", () => {
    expect(shouldRequestAutomaticValidation("automatic", release)).toBe(true);
  });

  it("does not request checks for manual, active, published, or quarantined releases", () => {
    expect(shouldRequestAutomaticValidation("manual", release)).toBe(false);
    expect(shouldRequestAutomaticValidation("automatic", { ...release, validationStatus: "validating_binary" })).toBe(false);
    expect(shouldRequestAutomaticValidation("automatic", { ...release, validationStatus: "server_binary_valid", publicationStatus: "published" })).toBe(false);
    expect(shouldRequestAutomaticValidation("automatic", { ...release, validationStatus: "quarantined", quarantineCode: "certificate_changed" })).toBe(false);
  });
});
