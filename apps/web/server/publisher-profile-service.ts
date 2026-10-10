import type { PublisherProfileDto } from "@hub/api-client";
import { PublisherProfileRepository, type PublisherProfileUpdate, type SessionRecord } from "@hub/database";
import { database, hubConfig } from "./runtime";

const repository = new PublisherProfileRepository(database);

export function getPublisherProfile(session: SessionRecord): Promise<PublisherProfileDto | null> {
  return repository.getById(session.publisherId);
}

export function updatePublisherProfile(session: SessionRecord, input: PublisherProfileUpdate): Promise<PublisherProfileDto | null> {
  return repository.update(session.publisherId, input);
}

export function getPublicPublisherProfile(slug: string): Promise<PublisherProfileDto | null> {
  return repository.getPublicBySlug(slug.trim().toLowerCase());
}

export function publisherProfilePublicUrl(profile: PublisherProfileDto): string {
  return new URL(`/publishers/${profile.slug}`, hubConfig.hubOrigin).toString();
}
