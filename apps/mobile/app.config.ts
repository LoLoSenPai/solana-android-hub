import type { ExpoConfig } from "expo/config";

const appEnvironment = environmentVariable("APP_ENV") ?? "local";
const production = appEnvironment === "production";
const hubOrigin = environmentVariable("EXPO_PUBLIC_HUB_ORIGIN") ?? "http://10.0.2.2:3000";
const publicationGate = environmentVariable("RELEASE_PUBLICATION_GATE") ?? "device_only_preview";

if (production) {
  if (new URL(hubOrigin).protocol !== "https:") throw new Error("Production mobile builds require an HTTPS Hub origin");
  if (publicationGate !== "server_and_device") throw new Error("Production mobile builds require server_and_device publication");
}

const config: ExpoConfig = {
  name: production ? "Solana Android Hub" : "Solana Android Hub Dev",
  slug: "solana-android-hub",
  version: "0.1.0",
  orientation: "portrait",
  scheme: "solanaandroidhub",
  userInterfaceStyle: "dark",
  android: {
    package: production ? "com.lololabs.solanaandroidhub" : "com.lololabs.solanaandroidhub.dev",
    versionCode: 1
  },
  plugins: [
    "expo-router",
    "expo-sqlite",
    ["expo-build-properties", { android: { compileSdkVersion: 36, targetSdkVersion: 36, minSdkVersion: 26 } }]
  ],
  experiments: { typedRoutes: true },
  extra: {
    hubOrigin,
    publicationGate
  }
};

export default config;

function environmentVariable(key: string): string | undefined {
  const value: unknown = process.env[key];
  return typeof value === "string" ? value : undefined;
}
