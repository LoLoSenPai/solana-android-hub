import { z } from "zod";

const base58Address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;
export const PRODUCTION_ORIGIN = "https://dapport.app";

export const appEnvironmentSchema = z.enum(["local", "staging", "production"]);
export const publicationGateSchema = z.enum(["device_only_preview", "server_and_device"]);

const environmentSchema = z
  .object({
    APP_ENV: appEnvironmentSchema.default("local"),
    HUB_ORIGIN: z.url().default("http://localhost:3000"),
    SOLANA_NETWORK: z.literal("mainnet-beta").default("mainnet-beta"),
    RELEASE_PUBLICATION_GATE: publicationGateSchema.default("device_only_preview"),
    ALLOWED_PREVIEW_APP_MINTS: z.string().default(""),
    CONSENT_TERMS_VERSION: z.string().min(1).default("dev-1"),
    DATABASE_URL: z.string().min(1).optional(),
    HELIUS_API_KEY: z.string().min(1).optional(),
    SESSION_PEPPER: z.string().min(16).optional(),
    ADMIN_WALLETS: z.string().default(""),
    CRON_SECRET: z.string().min(16).optional(),
    GITHUB_REPOSITORY: z.string().regex(/^[^/\s]+\/[^/\s]+$/u).optional(),
    GITHUB_ACTIONS_TOKEN: z.string().min(1).optional(),
    GITHUB_VALIDATOR_REF: z.string().min(1).default("main"),
    GITHUB_OIDC_AUDIENCE: z.string().min(1).default("solana-android-hub-apk-validator")
  })
  .superRefine((value, context) => {
    const origin = new URL(value.HUB_ORIGIN);
    const previewMints = splitAddressList(value.ALLOWED_PREVIEW_APP_MINTS);
    const adminWallets = splitAddressList(value.ADMIN_WALLETS);

    for (const [field, addresses] of [
      ["ALLOWED_PREVIEW_APP_MINTS", previewMints],
      ["ADMIN_WALLETS", adminWallets]
    ] as const) {
      for (const address of addresses) {
        if (!base58Address.test(address)) {
          context.addIssue({ code: "custom", path: [field], message: `Invalid base58 address: ${address}` });
        }
      }
    }

    if (value.APP_ENV !== "local" && origin.protocol !== "https:") {
      context.addIssue({ code: "custom", path: ["HUB_ORIGIN"], message: "Staging and production origins must use HTTPS" });
    }

    if (value.APP_ENV === "local" && origin.protocol !== "http:" && origin.protocol !== "https:") {
      context.addIssue({ code: "custom", path: ["HUB_ORIGIN"], message: "Local origin must use HTTP or HTTPS" });
    }

    if (value.APP_ENV === "production") {
      if (origin.origin !== PRODUCTION_ORIGIN) {
        context.addIssue({ code: "custom", path: ["HUB_ORIGIN"], message: `Production origin must be ${PRODUCTION_ORIGIN}` });
      }
      if (value.RELEASE_PUBLICATION_GATE !== "server_and_device") {
        context.addIssue({ code: "custom", path: ["RELEASE_PUBLICATION_GATE"], message: "Production requires server_and_device" });
      }
      if (/^(dev|local|staging)(-|$)/iu.test(value.CONSENT_TERMS_VERSION)) {
        context.addIssue({ code: "custom", path: ["CONSENT_TERMS_VERSION"], message: "Production terms may not use a development version" });
      }
      if (!value.DATABASE_URL || !value.HELIUS_API_KEY || !value.SESSION_PEPPER || !value.CRON_SECRET) {
        context.addIssue({ code: "custom", message: "Production database, Helius, session, and cron secrets are required" });
      }
      if (!value.GITHUB_REPOSITORY || !value.GITHUB_ACTIONS_TOKEN) {
        context.addIssue({ code: "custom", message: "Production GitHub validator repository and dispatch token are required" });
      }
      if (adminWallets.length === 0) {
        context.addIssue({ code: "custom", path: ["ADMIN_WALLETS"], message: "At least one production admin wallet is required" });
      }
    }
  });

function splitAddressList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;
export type PublicationGate = z.infer<typeof publicationGateSchema>;

export interface HubConfig {
  appEnvironment: AppEnvironment;
  hubOrigin: string;
  solanaNetwork: "mainnet-beta";
  publicationGate: PublicationGate;
  allowedPreviewAppMints: ReadonlySet<string>;
  consentTermsVersion: string;
  databaseUrl?: string;
  heliusApiKey?: string;
  sessionPepper?: string;
  adminWallets: ReadonlySet<string>;
  cronSecret?: string;
  githubRepository?: string;
  githubActionsToken?: string;
  githubValidatorRef: string;
  githubOidcAudience: string;
}

export function parseHubConfig(input: NodeJS.ProcessEnv | Record<string, string | undefined>): HubConfig {
  const parsed = environmentSchema.parse(input);
  return {
    appEnvironment: parsed.APP_ENV,
    hubOrigin: new URL(parsed.HUB_ORIGIN).origin,
    solanaNetwork: parsed.SOLANA_NETWORK,
    publicationGate: parsed.RELEASE_PUBLICATION_GATE,
    allowedPreviewAppMints: new Set(splitAddressList(parsed.ALLOWED_PREVIEW_APP_MINTS)),
    consentTermsVersion: parsed.CONSENT_TERMS_VERSION,
    ...(parsed.DATABASE_URL ? { databaseUrl: parsed.DATABASE_URL } : {}),
    ...(parsed.HELIUS_API_KEY ? { heliusApiKey: parsed.HELIUS_API_KEY } : {}),
    ...(parsed.SESSION_PEPPER ? { sessionPepper: parsed.SESSION_PEPPER } : {}),
    adminWallets: new Set(splitAddressList(parsed.ADMIN_WALLETS)),
    ...(parsed.CRON_SECRET ? { cronSecret: parsed.CRON_SECRET } : {}),
    ...(parsed.GITHUB_REPOSITORY ? { githubRepository: parsed.GITHUB_REPOSITORY } : {}),
    ...(parsed.GITHUB_ACTIONS_TOKEN ? { githubActionsToken: parsed.GITHUB_ACTIONS_TOKEN } : {}),
    githubValidatorRef: parsed.GITHUB_VALIDATOR_REF,
    githubOidcAudience: parsed.GITHUB_OIDC_AUDIENCE
  };
}

export function publicRuntimeConfig(config: HubConfig) {
  return {
    appEnvironment: config.appEnvironment,
    defaultCatalogChannel: "trusted" as const,
    previewEnabled: config.appEnvironment !== "production" && config.publicationGate === "device_only_preview",
    solanaNetwork: config.solanaNetwork
  };
}
