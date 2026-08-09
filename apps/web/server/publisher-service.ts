import { createHash, randomBytes } from "node:crypto";
import { AuthRepository, PublisherRepository, type PublisherAppRecord, type SessionRecord } from "@hub/database";
import { buildDistributionConsentMessage, DISTRIBUTION_SCOPES, type ReleasePolicy } from "@hub/domain";
import type { CatalogCategory, GameGenre } from "@hub/domain";
import {
  createHeliusFinalizedAccountReader,
  createHeliusReleaseDiscovery,
  fetchHardenedJson,
  FinalizedMetadataVerifier,
  verifyWalletSignature
} from "@hub/solana";
import { appJsonMetadataSchema, publisherJsonMetadataSchema } from "@hub/validation";
import { database, hubConfig } from "./runtime";

const publisherRepository = new PublisherRepository(database);
const authRepository = new AuthRepository(database);

export interface DiscoveredPublisherApp {
  appMint: string;
  publisherCollectionMint: string | null;
  name: string;
  packageName: string;
  iconUrl: string;
  authorityPath: "metadata_update_authority" | "collection_authority";
}

export async function discoverPublisherApps(session: SessionRecord): Promise<readonly DiscoveredPublisherApp[]> {
  const { discovery, verifier } = solanaServices();
  const candidates = await discovery.discoverWalletCandidates(session.walletAddress);
  const output: DiscoveredPublisherApp[] = [];
  for (const candidate of candidates.slice(0, 50)) {
    try {
      if (candidate.burnt || candidate.compression !== "uncompressed") continue;
      const proof = await verifier.verifyAppAuthority({ wallet: session.walletAddress, appMint: candidate.mint });
      const app = appJsonMetadataSchema.parse(await fetchHardenedJson(proof.appMetadata.metadataUri));
      if (proof.publisherMetadata !== null) {
        publisherJsonMetadataSchema.parse(await fetchHardenedJson(proof.publisherMetadata.metadataUri));
      }
      output.push({
        appMint: candidate.mint,
        publisherCollectionMint: proof.publisherCollectionMint,
        name: app.name,
        packageName: app.extensions.solana_dapp_store.android_package,
        iconUrl: app.image,
        authorityPath: proof.path
      });
    } catch {
      // Discovery is advisory: non-App NFTs and stale index entries are intentionally omitted.
    }
  }
  return output;
}

export async function claimPublisherApp(session: SessionRecord, appMint: string): Promise<PublisherAppRecord> {
  const { verifier } = solanaServices();
  const proof = await verifier.verifyAppAuthority({ wallet: session.walletAddress, appMint });
  const appJson = appJsonMetadataSchema.parse(await fetchHardenedJson(proof.appMetadata.metadataUri));
  const publisherJson = proof.publisherMetadata === null
    ? null
    : publisherJsonMetadataSchema.parse(await fetchHardenedJson(proof.publisherMetadata.metadataUri));
  const packageName = appJson.extensions.solana_dapp_store.android_package;
  const sourceSnapshot = {
    schemaRevision: appJson.schema_version,
    appMetadata: appJson,
    ...(publisherJson === null ? {} : { publisherMetadata: publisherJson }),
    authority: { ...proof, finalizedSlot: proof.finalizedSlot.toString() }
  };
  const sourceSnapshotJson = canonicalJson(sourceSnapshot);
  const evidenceHash = sha256Hex(canonicalJson(sourceSnapshot.authority));
  const slug = `${slugify(appJson.name)}-${appMint.slice(0, 7).toLowerCase()}`;
  return publisherRepository.saveVerifiedClaim({
    publisherId: session.publisherId,
    publisherWalletId: session.publisherWalletId,
    proof,
    packageName,
    slug,
    name: appJson.name,
    shortDescription: null,
    description: null,
    iconUri: appJson.image,
    screenshots: [],
    metadataUri: proof.appMetadata.metadataUri,
    sourceSnapshotJson,
    sourceSnapshotHash: sha256Hex(sourceSnapshotJson),
    evidenceHash
  });
}

export async function createDistributionConsentChallenge(
  session: SessionRecord,
  appId: string,
  releasePolicy: ReleasePolicy
) {
  const app = await requirePublisherApp(session, appId);
  await reverifyAuthority(session, app);
  const nonce = randomBytes(32).toString("base64url");
  const issuedAt = floorToSecond(new Date());
  const expiresAt = new Date(issuedAt.getTime() + 10 * 60_000);
  const message = buildDistributionConsentMessage({
    environment: hubConfig.appEnvironment,
    origin: hubConfig.hubOrigin,
    wallet: session.walletAddress,
    appMint: app.appMint,
    nonce,
    issuedAt: toRfc3339Seconds(issuedAt),
    expiresAt: toRfc3339Seconds(expiresAt),
    releasePolicy,
    termsVersion: hubConfig.consentTermsVersion
  });
  const challenge = await authRepository.createChallenge({
    walletAddress: session.walletAddress,
    purpose: "distribution_consent",
    environment: hubConfig.appEnvironment,
    nonceHash: createHash("sha256").update(nonce).digest(),
    message,
    expiresAt
  });
  return { challengeId: challenge.id, message, expiresAt: expiresAt.toISOString() };
}

export async function recordDistributionConsent(input: {
  session: SessionRecord;
  appId: string;
  challengeId: string;
  signatureBase64Url: string;
  releasePolicy: ReleasePolicy;
}): Promise<string | null> {
  const app = await requirePublisherApp(input.session, input.appId);
  await reverifyAuthority(input.session, app);
  return publisherRepository.recordConsent({
    app,
    publisherWalletId: input.session.publisherWalletId,
    walletAddress: input.session.walletAddress,
    challengeId: input.challengeId,
    environment: hubConfig.appEnvironment,
    signature: input.signatureBase64Url,
    releasePolicy: input.releasePolicy,
    termsVersion: hubConfig.consentTermsVersion,
    scopes: DISTRIBUTION_SCOPES,
    verify: (wallet, message) => isConsentBound(message, {
      wallet,
      appMint: app.appMint,
      releasePolicy: input.releasePolicy
    }) && verifyWalletSignature({ wallet, message, signatureBase64Url: input.signatureBase64Url })
  });
}

export async function updatePublisherClassification(input: {
  session: SessionRecord;
  appId: string;
  category: CatalogCategory;
  genres: readonly GameGenre[];
}): Promise<boolean> {
  const app = await requirePublisherApp(input.session, input.appId);
  await reverifyAuthority(input.session, app);
  return publisherRepository.saveClassification({
    appId: app.id,
    publisherId: input.session.publisherId,
    walletAddress: input.session.walletAddress,
    category: input.category,
    genres: input.category === "games" ? input.genres : []
  });
}

async function requirePublisherApp(session: SessionRecord, appId: string): Promise<PublisherAppRecord> {
  const app = await publisherRepository.getAppForPublisher(appId, session.publisherId);
  if (!app || app.claimStatus !== "verified") throw new Error("PUBLISHER_APP_NOT_FOUND");
  return app;
}

async function reverifyAuthority(session: SessionRecord, app: PublisherAppRecord): Promise<void> {
  await solanaServices().verifier.verifyAppAuthority({
    wallet: session.walletAddress,
    appMint: app.appMint
  });
}

function solanaServices() {
  if (!hubConfig.heliusApiKey) throw new Error("HELIUS_NOT_CONFIGURED");
  return {
    discovery: createHeliusReleaseDiscovery(hubConfig.heliusApiKey),
    verifier: new FinalizedMetadataVerifier(createHeliusFinalizedAccountReader(hubConfig.heliusApiKey))
  };
}

function isConsentBound(message: string, expected: { wallet: string; appMint: string; releasePolicy: ReleasePolicy }): boolean {
  const origin = new URL(hubConfig.hubOrigin);
  const lines = message.split("\n");
  return lines.length === 14 &&
    lines[0] === "Solana Android Hub Distribution Consent" &&
    lines[1] === "Version: 1" &&
    lines[2] === `Environment: ${hubConfig.appEnvironment}` &&
    lines[3] === `Domain: ${origin.host.toLowerCase()}` &&
    lines[4] === `URI: ${origin.origin}` &&
    lines[5] === "Network: solana:mainnet-beta" &&
    lines[6] === `Publisher: ${expected.wallet}` &&
    lines[7] === `App Mint: ${expected.appMint}` &&
    lines[11] === `Scopes: ${DISTRIBUTION_SCOPES.join(",")}` &&
    lines[12] === `Release Policy: ${expected.releasePolicy}` &&
    lines[13] === `Terms Version: ${hubConfig.consentTermsVersion}`;
}

function slugify(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "app";
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).toSorted(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortJson(item)]));
  }
  return value;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function floorToSecond(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

function toRfc3339Seconds(date: Date): string {
  return date.toISOString().replace(".000Z", "Z");
}
