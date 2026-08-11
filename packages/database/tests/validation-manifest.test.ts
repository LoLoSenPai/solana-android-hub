import { describe, expect, it } from "vitest";
import { decodeBinaryValidationManifest } from "../src/index.js";

const storedManifest = {
  runId: "stored-run-id",
  apkUrl: "https://downloads.example.com/app.apk",
  expectedSize: 123,
  expectedSha256: "a".repeat(64),
  packageName: "com.example.app",
  versionCode: "2",
  certificateSha256: "b".repeat(64),
  minSdk: 26,
  permissions: ["android.permission.INTERNET"]
};

describe("binary validation manifest storage", () => {
  it("restores a JSON object and pins the database correlation id", () => {
    expect(decodeBinaryValidationManifest(storedManifest, "database-run-id")).toEqual({
      ...storedManifest,
      runId: "database-run-id"
    });
  });

  it("repairs manifests created by the legacy double-encoding bug", () => {
    expect(decodeBinaryValidationManifest(JSON.stringify(storedManifest), "database-run-id")).toEqual({
      ...storedManifest,
      runId: "database-run-id"
    });
  });

  it("rejects malformed stored values", () => {
    expect(decodeBinaryValidationManifest("not-json", "database-run-id")).toBeNull();
    expect(decodeBinaryValidationManifest({ ...storedManifest, apkUrl: null }, "database-run-id")).toBeNull();
  });
});
