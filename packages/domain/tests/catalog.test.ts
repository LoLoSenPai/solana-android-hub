import { describe, expect, it } from "vitest";
import {
  buildAuthenticationMessage,
  buildDistributionConsentMessage,
  computeUpdateDecision,
  diffPermissions,
  normalizeCatalogCategory,
  normalizeGameGenres,
  quarantineReason,
  selectLatestRelease,
  type ReleaseCandidate
} from "../src/index.js";

describe("catalog categories", () => {
  it("normalizes publishing aliases into the stable public taxonomy", () => {
    expect(normalizeCatalogCategory("DeFi & Trading")).toBe("defi");
    expect(normalizeCatalogCategory("AI & Agents")).toBe("ai-agents");
    expect(normalizeCatalogCategory("Gaming")).toBe("games");
  });

  it("keeps missing and unrecognized categories visible under other", () => {
    expect(normalizeCatalogCategory(undefined)).toBe("other");
    expect(normalizeCatalogCategory("Experimental category")).toBe("other");
  });

  it("keeps only stable game genres and removes duplicates", () => {
    expect(normalizeGameGenres(["Puzzle", "puzzle", "RPG", "unknown", 7])).toEqual(["puzzle", "rpg"]);
  });
});

const base: ReleaseCandidate = {
  id: "release-1",
  releaseMint: "release-mint-1",
  appMint: "app-mint",
  packageName: "com.example.app",
  versionName: "1.0",
  versionCode: 1n,
  certificateSha256: "AA:BB",
  permissions: [],
  validationStatus: "server_binary_valid",
  publicationStatus: "published",
  approvalStatus: "unknown"
};

describe("catalog selection", () => {
  it("selects the latest trusted release independently of approval", () => {
    const latest = { ...base, id: "release-2", releaseMint: "release-mint-2", versionCode: 2n };
    expect(selectLatestRelease([base, latest], {
      environment: "production",
      channel: "trusted",
      allowedPreviewAppMints: new Set()
    })?.versionCode).toBe(2n);
  });

  it("filters approved releases independently", () => {
    const approved = { ...base, approvalStatus: "verified_approved" as const };
    const newerTrusted = { ...base, id: "release-2", releaseMint: "release-mint-2", versionCode: 2n };
    expect(selectLatestRelease([approved, newerTrusted], {
      environment: "production",
      channel: "approved",
      allowedPreviewAppMints: new Set()
    })?.versionCode).toBe(1n);
  });

  it("allows preview only for an allowlisted non-production app", () => {
    const preview = { ...base, validationStatus: "metadata_valid" as const, publicationStatus: "preview" as const };
    expect(selectLatestRelease([preview], {
      environment: "staging",
      channel: "trusted",
      allowedPreviewAppMints: new Set(["app-mint"])
    })).toBeDefined();
    expect(selectLatestRelease([preview], {
      environment: "production",
      channel: "trusted",
      allowedPreviewAppMints: new Set(["app-mint"])
    })).toBeUndefined();
  });
});

describe("update decisions", () => {
  it("never downgrades a newer installed release", () => {
    expect(computeUpdateDecision(base, {
      visibility: "visible",
      versionCode: 2n,
      certificateSha256: "aabb"
    })).toMatchObject({ kind: "newer_than_channel", installedVersionCode: 2n });
  });

  it("reports an incompatible edition", () => {
    expect(computeUpdateDecision(base, {
      visibility: "visible",
      versionCode: 1n,
      certificateSha256: "ccdd"
    }).kind).toBe("different_edition");
  });

  it("keeps package visibility uncertainty explicit", () => {
    expect(computeUpdateDecision(base, { visibility: "unknown" }).kind).toBe("compatibility_unknown");
  });
});

describe("release quarantine", () => {
  it("quarantines certificate changes and later version regressions", () => {
    expect(quarantineReason(base, { ...base, certificateSha256: "CC:DD", versionCode: 2n })).toBe("certificate_changed");
    expect(quarantineReason({ ...base, versionCode: 2n }, base)).toBe("version_regression");
  });
});

describe("permission diffs", () => {
  it("reports additions and removals deterministically", () => {
    expect(diffPermissions(["CAMERA", "INTERNET"], ["INTERNET", "LOCATION"]))
      .toEqual({ added: ["LOCATION"], removed: ["CAMERA"] });
  });
});

describe("canonical signed messages", () => {
  const common = {
    environment: "staging" as const,
    origin: "https://hub-staging.example.com",
    wallet: "11111111111111111111111111111111",
    nonce: "nonce",
    issuedAt: "2026-08-07T10:00:00Z",
    expiresAt: "2026-08-07T10:05:00Z"
  };

  it("builds authentication bytes with no trailing newline", () => {
    const message = buildAuthenticationMessage(common);
    expect(message.startsWith("Dapport Authentication\n")).toBe(true);
    expect(message).toContain("Purpose: Publisher sign-in");
    expect(message.endsWith("\n")).toBe(false);
  });

  it("binds consent to app, policy, environment, and terms", () => {
    const message = buildDistributionConsentMessage({
      ...common,
      appMint: "22222222222222222222222222222222",
      releasePolicy: "automatic",
      termsVersion: "staging-1"
    });
    expect(message).toContain("App Mint: 22222222222222222222222222222222");
    expect(message.startsWith("Dapport Distribution Consent\n")).toBe(true);
    expect(message).toContain("Release Policy: automatic");
    expect(message).toContain("Terms Version: staging-1");
  });
});
