import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { configureReleaseSigning } = require("../plugins/with-release-signing.js") as {
  configureReleaseSigning(contents: string): string;
};

const template = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
        }
    }
}`;

describe("Android release signing plugin", () => {
  it("requires external signing variables for production builds", () => {
    const result = configureReleaseSigning(template);

    expect(result).toContain('System.getenv("HUB_RELEASE_STORE_FILE")');
    expect(result).toContain('System.getenv("HUB_RELEASE_STORE_PASSWORD")');
    expect(result).toContain('System.getenv("HUB_RELEASE_KEY_ALIAS")');
    expect(result).toContain('System.getenv("HUB_RELEASE_KEY_PASSWORD")');
    expect(result).toContain('hubReleaseSigningRequired && !hubReleaseSigningConfigured');
    expect(result).toContain("signingConfig hubReleaseSigningConfigured ? signingConfigs.release : signingConfigs.debug");
  });

  it("is idempotent", () => {
    const once = configureReleaseSigning(template);
    expect(configureReleaseSigning(once)).toBe(once);
  });

  it("fails when Expo's Gradle template changes unexpectedly", () => {
    expect(() => configureReleaseSigning("android {\n}")).toThrow(
      "Could not locate Expo's default Android signing configuration",
    );
  });
});

