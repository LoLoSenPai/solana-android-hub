import { PublisherOperationsRepository, type SessionRecord } from "@hub/database";
import { database, hubConfig } from "./runtime";

const repository = new PublisherOperationsRepository(database);

export function listPublisherApps(session: SessionRecord) {
  return repository.listApps(session.publisherId, hubConfig.appEnvironment);
}

export function listPublisherReleases(session: SessionRecord, appId: string) {
  return repository.listReleases(appId, session.publisherId);
}

export function revokePublisherDistribution(session: SessionRecord, appId: string, reason: string) {
  return repository.revokeDistribution(appId, session.publisherId, hubConfig.appEnvironment, reason);
}

export function ignorePublisherRelease(session: SessionRecord, releaseId: string) {
  return repository.ignoreRelease(releaseId, session.publisherId);
}

export function requestPublisherApproval(session: SessionRecord, releaseId: string, evidence: Record<string, unknown>) {
  return repository.requestApproval(releaseId, session.publisherId, session.publisherWalletId, JSON.stringify(evidence));
}
