import type { AppEnvironment, ReleasePolicy } from "./types";

export interface AuthenticationMessageInput {
  environment: AppEnvironment;
  origin: string;
  wallet: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

export interface ConsentMessageInput extends AuthenticationMessageInput {
  appMint: string;
  releasePolicy: ReleasePolicy;
  termsVersion: string;
}

export const DISTRIBUTION_SCOPES = [
  "facilitate_apk_installation",
  "list_app",
  "monitor_future_releases",
  "use_public_metadata"
] as const;

function canonicalOrigin(origin: string): URL {
  const url = new URL(origin);
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("Origin must not include credentials, path, query, or fragment");
  }
  return url;
}

export function buildAuthenticationMessage(input: AuthenticationMessageInput): string {
  const origin = canonicalOrigin(input.origin);
  return [
    "Dapport Authentication",
    "Version: 1",
    `Environment: ${input.environment}`,
    `Domain: ${origin.host.toLowerCase()}`,
    `URI: ${origin.origin}`,
    "Network: solana:mainnet-beta",
    `Wallet: ${input.wallet}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expires At: ${input.expiresAt}`,
    "Purpose: Publisher sign-in"
  ].join("\n");
}

export function buildDistributionConsentMessage(input: ConsentMessageInput): string {
  const origin = canonicalOrigin(input.origin);
  return [
    "Dapport Distribution Consent",
    "Version: 1",
    `Environment: ${input.environment}`,
    `Domain: ${origin.host.toLowerCase()}`,
    `URI: ${origin.origin}`,
    "Network: solana:mainnet-beta",
    `Publisher: ${input.wallet}`,
    `App Mint: ${input.appMint}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expires At: ${input.expiresAt}`,
    `Scopes: ${DISTRIBUTION_SCOPES.join(",")}`,
    `Release Policy: ${input.releasePolicy}`,
    `Terms Version: ${input.termsVersion}`
  ].join("\n");
}
