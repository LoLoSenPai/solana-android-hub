import type { ExpoConfig } from "expo/config";

const appEnvironment = environmentVariable("APP_ENV") ?? "local";
const production = appEnvironment === "production";
const publicWebsiteOrigin = "https://solana-hub.lololabs.xyz";
const hubOrigin = environmentVariable("EXPO_PUBLIC_HUB_ORIGIN") ?? "http://10.0.2.2:3000";
const publicationGate = environmentVariable("RELEASE_PUBLICATION_GATE") ?? "device_only_preview";
const version = environmentVariable("HUB_APP_VERSION_NAME") ?? "0.3.1";
const versionCode = positiveIntegerEnvironmentVariable("HUB_APP_VERSION_CODE") ?? 4;
const productionPackageName = "com.lololabs.solanaandroidhub";
const releaseCertificateSha256 = "02F204B9CBED11E59F85B2A6DBCB34AD6F0A4658C639D58B2C27FB3BE2AD0E09";

if (production) {
  if (new URL(hubOrigin).protocol !== "https:") throw new Error("Production mobile builds require an HTTPS Hub origin");
  if (publicationGate !== "server_and_device") throw new Error("Production mobile builds require server_and_device publication");
}

const config: ExpoConfig = {
  name: production ? "Solana Android Hub" : "Solana Android Hub Dev",
  slug: "solana-android-hub",
  version,
  icon: "./assets/icon.png",
  orientation: "portrait",
  scheme: "solanaandroidhub",
  userInterfaceStyle: "dark",
  android: {
    package: production ? productionPackageName : "com.lololabs.solanaandroidhub.dev",
    versionCode,
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#091018"
    }
  },
  plugins: [
    "expo-router",
    "expo-sqlite",
    "./plugins/with-release-signing",
    ["expo-build-properties", { android: { compileSdkVersion: 36, targetSdkVersion: 36, minSdkVersion: 26 } }]
  ],
  experiments: { typedRoutes: true },
  extra: {
    hubOrigin,
    publicWebsiteOrigin,
    publicationGate,
    hubUpdater: {
      enabled: production,
      manifestUrl: `${hubOrigin}/api/v1/hub/releases/latest`,
      packageName: productionPackageName,
      releaseCertificateSha256
    }
  }
};

export default config;

function environmentVariable(key: string): string | undefined {
  const value: unknown = process.env[key];
  return typeof value === "string" ? value : undefined;
}

function positiveIntegerEnvironmentVariable(key: string): number | undefined {
  const value = environmentVariable(key);
  if (!value) return undefined;
  if (!/^[1-9][0-9]*$/u.test(value)) throw new Error(`${key} must be a positive integer`);
  return Number(value);
}
