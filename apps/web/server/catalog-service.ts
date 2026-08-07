import type { CatalogAppDto } from "@hub/api-client";
import { CatalogRepository, type CatalogAppRecord } from "@hub/database";
import { isAppEligible, isReleaseEligible, selectLatestRelease, type CatalogChannel } from "@hub/domain";
import { database, hubConfig } from "./runtime";

const repository = new CatalogRepository(database);

export async function listCatalog(input: {
  channel: CatalogChannel;
  query?: string;
}): Promise<readonly CatalogAppDto[]> {
  const records = await repository.listReleaseCandidates(hubConfig.appEnvironment, input.query);
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
    results.push(toDto(selectedRecord));
  }
  return results.toSorted((left, right) => left.name.localeCompare(right.name));
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
    slug: record.slug,
    appMint: record.appMint,
    name: record.name,
    shortDescription: record.shortDescription,
    description: record.description,
    iconUrl: record.iconUri,
    screenshots: [...record.screenshots],
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
