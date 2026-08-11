import { describe, expect, it } from "vitest";
import { parseHubConfig, publicRuntimeConfig } from "../src/index.js";

describe("parseHubConfig", () => {
  it("permits a fail-closed local preview configuration", () => {
    const config = parseHubConfig({ APP_ENV: "local", HUB_ORIGIN: "http://localhost:3000" });
    expect(config.publicationGate).toBe("device_only_preview");
    expect(publicRuntimeConfig(config).previewEnabled).toBe(true);
  });

  it("rejects preview publication in production", () => {
    expect(() => parseHubConfig({
      APP_ENV: "production",
      HUB_ORIGIN: "https://dapport.app",
      RELEASE_PUBLICATION_GATE: "device_only_preview",
      CONSENT_TERMS_VERSION: "1",
      DATABASE_URL: "postgresql://example",
      HELIUS_API_KEY: "key",
      SESSION_PEPPER: "1234567890123456",
      CRON_SECRET: "1234567890123456",
      ADMIN_WALLETS: "11111111111111111111111111111111"
    })).toThrow(/server_and_device/u);
  });

  it("rejects development terms and insecure origins in production", () => {
    expect(() => parseHubConfig({
      APP_ENV: "production",
      HUB_ORIGIN: "http://dapport.app",
      RELEASE_PUBLICATION_GATE: "server_and_device",
      CONSENT_TERMS_VERSION: "dev-1",
      DATABASE_URL: "postgresql://example",
      HELIUS_API_KEY: "key",
      SESSION_PEPPER: "1234567890123456",
      CRON_SECRET: "1234567890123456",
      ADMIN_WALLETS: "11111111111111111111111111111111"
    })).toThrow();
  });

  it("requires an operational GitHub server validator in production", () => {
    expect(() => parseHubConfig({
      APP_ENV: "production",
      HUB_ORIGIN: "https://dapport.app",
      RELEASE_PUBLICATION_GATE: "server_and_device",
      CONSENT_TERMS_VERSION: "1",
      DATABASE_URL: "postgresql://example",
      HELIUS_API_KEY: "key",
      SESSION_PEPPER: "1234567890123456",
      CRON_SECRET: "1234567890123456",
      ADMIN_WALLETS: "11111111111111111111111111111111"
    })).toThrow(/GitHub validator/u);
  });

  it("accepts only a complete fail-closed production configuration", () => {
    const config = parseHubConfig({
      APP_ENV: "production",
      HUB_ORIGIN: "https://dapport.app",
      RELEASE_PUBLICATION_GATE: "server_and_device",
      CONSENT_TERMS_VERSION: "1",
      DATABASE_URL: "postgresql://example",
      HELIUS_API_KEY: "key",
      SESSION_PEPPER: "1234567890123456",
      CRON_SECRET: "1234567890123456",
      ADMIN_WALLETS: "11111111111111111111111111111111",
      GITHUB_REPOSITORY: "example/solana-hub",
      GITHUB_ACTIONS_TOKEN: "secret"
    });
    expect(config.publicationGate).toBe("server_and_device");
    expect(publicRuntimeConfig(config).previewEnabled).toBe(false);
  });

  it("rejects a non-canonical production origin", () => {
    expect(() => parseHubConfig({
      APP_ENV: "production",
      HUB_ORIGIN: "https://legacy.example.com",
      RELEASE_PUBLICATION_GATE: "server_and_device",
      CONSENT_TERMS_VERSION: "1",
      DATABASE_URL: "postgresql://example",
      HELIUS_API_KEY: "key",
      SESSION_PEPPER: "1234567890123456",
      CRON_SECRET: "1234567890123456",
      ADMIN_WALLETS: "11111111111111111111111111111111",
      GITHUB_REPOSITORY: "example/solana-hub",
      GITHUB_ACTIONS_TOKEN: "secret"
    })).toThrow(/dapport\.app/u);
  });
});
