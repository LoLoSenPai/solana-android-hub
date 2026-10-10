import type { CatalogAppDto } from "@hub/api-client";
import { CatalogRepository, type CatalogAppRecord } from "@hub/database";
import {
  isAppEligible,
  isReleaseEligible,
  selectLatestRelease,
  type CatalogCategory,
  type CatalogChannel,
  type CatalogSort,
  type GameGenre
} from "@hub/domain";
import { database, hubConfig } from "./runtime";

const repository = new CatalogRepository(database);

export async function listCatalog(input: {
  channel: CatalogChannel;
  publisherId?: string;
  query?: string;
  category?: CatalogCategory;
  sort?: CatalogSort;
  androidSdk?: number;
  genre?: GameGenre;
}): Promise<readonly CatalogAppDto[]> {
  const records = await repository.listReleaseCandidates(hubConfig.appEnvironment, input.query, undefined, input.publisherId);
  const grouped = new Map<string, CatalogAppRecord[]>();
  for (const record of records) {
    const existing = grouped.get(record.id) ?? [];
    existing.push(record);
    grouped.set(record.id, existing);
  }
  const results: CatalogAppDto[] = [];
  for (const appRecords of grouped.values()) {
    const app = appRecords[0];
    if (!app || !isAppEligible(app.eligibility, hubConfig.appEnvironment)) continue;
    const selected = selectLatestRelease(appRecords.map((record) => record.release), {
      environment: hubConfig.appEnvironment,
      channel: input.channel,
      allowedPreviewAppMints: hubConfig.allowedPreviewAppMints
    });
    const selectedRecord = appRecords.find((record) => record.release.id === selected?.id);
    if (!selectedRecord || !selected) continue;
    if (input.category !== undefined && selectedRecord.category !== input.category) continue;
    if (input.androidSdk !== undefined && selectedRecord.binary.minSdk > input.androidSdk) continue;
    if (input.genre !== undefined && !selectedRecord.genres.includes(input.genre)) continue;
    results.push(toDto(selectedRecord));
  }
  return results.toSorted((left, right) => {
    if (input.sort === "recently_updated") {
      const byUpdatedAt = Date.parse(right.releaseUpdatedAt ?? "") - Date.parse(left.releaseUpdatedAt ?? "");
      if (Number.isFinite(byUpdatedAt) && byUpdatedAt !== 0) return byUpdatedAt;
    }
    return left.name.localeCompare(right.name);
  });
}

export async function getCatalogApp(slug: string, channel: CatalogChannel): Promise<CatalogAppDto | undefined> {
  return (await listCatalog({ channel })).find((app) => app.slug === slug);
}

export async function listCatalogReleases(appId: string, channel: CatalogChannel): Promise<readonly CatalogAppDto["latestRelease"][]> {
  const records = await repository.listReleaseCandidates(hubConfig.appEnvironment);
  const context = {
    environment: hubConfig.appEnvironment,
    channel,
    allowedPreviewAppMints: hubConfig.allowedPreviewAppMints
  };
  return records.filter((record) => record.id === appId && isAppEligible(record.eligibility, hubConfig.appEnvironment)
      && isReleaseEligible(record.release, context))
    .toSorted((left, right) => left.release.versionCode > right.release.versionCode ? -1 : 1)
    .map((record) => toDto(record).latestRelease);
}

export async function listCatalogChanges(channel: CatalogChannel, changedAfter: Date) {
  const records = await repository.listReleaseCandidates(hubConfig.appEnvironment, undefined, changedAfter);
  const changedApps = new Set(records.map((record) => record.id));
  const current = await listCatalog({ channel });
  return current.filter((app) => changedApps.has(app.id)).map((app) => ({ ...app, changedAt: new Date().toISOString() }));
}

function toDto(record: CatalogAppRecord): CatalogAppDto {
  const isPreview = record.release.validationStatus !== "server_binary_valid" || record.release.publicationStatus === "preview";
  return {
    id: record.id,
    publisher: record.publisher ?? null,
    slug: record.slug,
    appMint: record.appMint,
    name: record.name,
    shortDescription: record.shortDescription,
    description: record.description,
    iconUrl: record.iconUri,
    screenshots: [...record.screenshots],
    bannerUrl: record.bannerUri,
    featureGraphicUrl: record.featureGraphicUri,
    category: record.category,
    genres: [...record.genres],
    publisherLinks: record.publisherLinks,
    solanaMobileRating: record.solanaMobileRating ? {
      averageRating: record.solanaMobileRating.averageRating,
      reviewCount: record.solanaMobileRating.reviewsByRating.reduce((total, count) => total + count, 0),
      reviewsByRating: [...record.solanaMobileRating.reviewsByRating]
    } : null,
    releaseUpdatedAt: record.releaseUpdatedAt.toISOString(),
    latestRelease: {
      id: record.release.id,
      releaseMint: record.release.releaseMint,
      packageName: record.release.packageName,
      versionName: record.release.versionName,
      versionCode: record.release.versionCode.toString(),
      apkUrl: record.binary.apkUri,
      apkSize: record.binary.apkSize,
      apkSha256: record.binary.apkSha256,
      certificateSha256: record.release.certificateSha256,
      minSdk: record.binary.minSdk,
      targetSdk: record.binary.targetSdk,
      permissions: [...record.release.permissions],
      previewOnly: isPreview,
      trust: {
        publisherControl: "verified",
        distributionConsent: "active",
        releaseAuthenticity: isPreview ? "development_preview" : "server_binary_valid",
        solanaMobileApproval: record.release.approvalStatus
      }
    }
  };
}
